import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import type { TenantContext } from '../../src/domain/ids.js';
import { executeAppointmentTool } from '../../src/modules/agent-core/appointment-tool.js';
import { createAppointmentTransactional, findSlots, holdSlot } from '../../src/modules/scheduling/postgres-scheduling.js';
import type { ServiceRequest } from '../../src/modules/scheduling/model.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = {
  tenantA: randomUUID(), tenantB: randomUUID(), workshopA: randomUUID(), workshopB: randomUUID(),
  customer: randomUUID(), vehicle: randomUUID(), user: randomUUID(),
};
const actorId = `agent-${randomUUID()}`;
const contextA: TenantContext = {
  tenantId: ids.tenantA as TenantContext['tenantId'], workshopId: ids.workshopA as TenantContext['workshopId'],
  correlationId: randomUUID(), actor: { type: 'voice_agent', id: actorId },
};
const contextB: TenantContext = {
  tenantId: ids.tenantB as TenantContext['tenantId'], workshopId: ids.workshopB as TenantContext['workshopId'],
  correlationId: randomUUID(), actor: { type: 'voice_agent', id: 'other-agent' },
};
const serviceRequest: ServiceRequest = {
  intent: 'oil_service', symptoms: ['maintenance due'], estimatedDurationMinutes: 60,
  capacityRequirements: [{ resourceType: 'mechanic', quantity: 1 }],
};
const openingHours = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index + 1), [{ start: '00:00', end: '23:59' }]]));
const window = () => {
  const from = new Date(Date.now() + 48 * 60 * 60_000);
  from.setUTCMinutes(Math.ceil(from.getUTCMinutes() / 15) * 15, 0, 0);
  return { from: from.toISOString(), to: new Date(from.getTime() + 6 * 60 * 60_000).toISOString() };
};

const principal: PrincipalContext = {
  kind: 'workshop_user', audience: 'workshop', userId: ids.user, issuer: 'test', subject: ids.user,
  sessionId: randomUUID(), authenticatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), assurance: 'single_factor',
};
const authentication: AuthenticationAdapter = {
  async authenticate(request) { return request.authorization === 'Bearer scheduling-user' ? principal : null; },
};
const app = buildApi(pool, { authentication, piiProtection: pii });

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Schedule A','pilot'),($2,'Schedule B','pilot')", [ids.tenantA, ids.tenantB]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active')", [ids.user]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'OWNER')", [ids.user, ids.tenantA]);
  await inTenantTransaction(pool, ids.tenantA, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours) VALUES($1,$2,'A','UTC',$3)", [ids.workshopA, ids.tenantA, JSON.stringify(openingHours)]);
    await client.query("INSERT INTO channel_endpoints(tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,'elevenlabs',$3,'vs02')", [ids.tenantA, ids.workshopA, actorId]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenantA, displayName: 'Aitor Etxeberria' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenantA, plate: '1489 KMR' });
    await client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)', [ids.tenantA, ids.customer, ids.vehicle]);
  });
  await inTenantTransaction(pool, ids.tenantB, (client) => client.query(
    "INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours) VALUES($1,$2,'B','UTC',$3)",
    [ids.workshopB, ids.tenantB, JSON.stringify(openingHours)],
  ));
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('VS02.1 real scheduling acquisition', () => {
  it('serializes overlapping holds, supports replay, expiry and tenant isolation', async () => {
    const slots = await findSlots(pool, contextA, { serviceRequest, window: window(), limit: 3 });
    expect(slots).toHaveLength(3);
    const [first, overlapping] = slots;
    const results = await Promise.allSettled([
      holdSlot(pool, contextA, first.token, 300),
      holdSlot(pool, contextA, overlapping.token, 300),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = results.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof holdSlot>>> => result.status === 'fulfilled')!.value;
    const candidate = winner.startAt === first.startAt ? first : overlapping;
    await expect(holdSlot(pool, contextA, candidate.token, 300)).resolves.toMatchObject({ token: winner.token });
    await expect(holdSlot(pool, contextB, candidate.token, 300)).rejects.toThrow('SLOT_CANDIDATE_NOT_AVAILABLE');
    const invalidCreation = (slotToken: string) => createAppointmentTransactional(pool, contextB, {
      slotToken, caseId: randomUUID(),
      identity: { resolution: 'verified' as const, customerId: randomUUID(), vehicleId: randomUUID() }, serviceRequest,
      confirmationEvidenceRef: 'test:confirmation', idempotencyKey: randomUUID(),
    }, pii);
    await expect(invalidCreation(winner.token)).rejects.toThrow('SLOT_NOT_AVAILABLE');

    await inTenantTransaction(pool, ids.tenantA, (client) => client.query(
      'UPDATE slot_holds SET expires_at=now()-interval \'1 second\' WHERE slot_token=$1', [winner.token],
    ));
    await expect(createAppointmentTransactional(pool, contextA, {
      slotToken: winner.token, caseId: randomUUID(),
      identity: { resolution: 'verified', customerId: ids.customer, vehicleId: ids.vehicle },
      serviceRequest, confirmationEvidenceRef: 'test:confirmation', idempotencyKey: randomUUID(),
    }, pii)).rejects.toThrow('SLOT_NOT_AVAILABLE');
    const availableAgain = await findSlots(pool, contextA, {
      serviceRequest, window: { from: winner.startAt, to: new Date(new Date(winner.endAt).getTime() + 60 * 60_000).toISOString() }, limit: 1,
    });
    expect(availableAgain[0]?.startAt).toBe(winner.startAt);
    const replacement = await holdSlot(pool, contextA, availableAgain[0].token, 300);
    expect(replacement.token).not.toBe(winner.token);
    await expect(holdSlot(pool, contextA, `${availableAgain[0].token}-tampered`, 300))
      .rejects.toThrow('SLOT_CANDIDATE_NOT_AVAILABLE');
    const reheld = await holdSlot(pool, contextA, availableAgain[0].token, 300);
    expect(reheld.token).not.toBe(winner.token);
    await inTenantTransaction(pool, ids.tenantA, (client) => client.query(
      'UPDATE slot_holds SET expires_at=now()-interval \'1 second\' WHERE slot_token=$1', [reheld.token],
    ));
  });

  it('runs find -> hold -> voice tool -> PostgreSQL -> authorized Workshop GET without seeding a hold', async () => {
    const slots = await findSlots(pool, contextA, { serviceRequest, window: window(), limit: 1 });
    const held = await holdSlot(pool, contextA, slots[0].token, 600);
    const providerCallId = `vs02-${randomUUID()}`;
    await expect(executeAppointmentTool(pool, contextA, {
      providerCallId: `tampered-${randomUUID()}`, customerName: 'Aitor Echeverria', plate: '1489 KMR', serviceIntent: 'oil_service',
      symptoms: ['maintenance due'], estimatedDurationMinutes: 60, slotToken: `${held.token}-tampered`,
      explicitConfirmation: true, confirmationTranscript: 'Sí, confirmo explícitamente la cita.',
    }, pii)).rejects.toThrow('SLOT_NOT_AVAILABLE');
    const result = await executeAppointmentTool(pool, contextA, {
      providerCallId, customerName: 'Aitor Echeverria', plate: '1489 KMR', serviceIntent: 'oil_service',
      symptoms: ['maintenance due'], estimatedDurationMinutes: 60, slotToken: held.token,
      explicitConfirmation: true, confirmationTranscript: 'Sí, confirmo explícitamente la cita.',
    }, pii);
    expect(result).toMatchObject({ ok: true, code: 'APPOINTMENT_CREATED' });
    if (!result.ok || !result.receipt?.value) throw new Error('Expected appointment receipt');
    expect(result.receipt.evidenceRef).toBe(`postgres:appointment:${result.receipt.value.id}`);

    const replay = await executeAppointmentTool(pool, contextA, {
      providerCallId, customerName: 'Aitor Echeverria', plate: '1489 KMR', serviceIntent: 'oil_service',
      symptoms: ['maintenance due'], estimatedDurationMinutes: 60, slotToken: held.token,
      explicitConfirmation: true, confirmationTranscript: 'Sí, confirmo explícitamente la cita.',
    }, pii);
    expect(replay.receipt?.value?.id).toBe(result.receipt.value.id);

    const response = await app.inject({
      url: `/v1/workshop/tenants/${ids.tenantA}/appointments`, headers: { authorization: 'Bearer scheduling-user' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.filter((row: { id: string }) => row.id === result.receipt!.value!.id)).toHaveLength(1);
  });

  it('allows only one non-idempotent creation to consume a hold and obeys lifecycle/kill control', async () => {
    const slot = (await findSlots(pool, contextA, { serviceRequest, window: window(), limit: 1 }))[0];
    const held = await holdSlot(pool, contextA, slot.token, 600);
    const setup = await inTenantTransaction(pool, ids.tenantA, async (client) => {
      const conversation = await client.query<{ id: string }>('INSERT INTO conversations(tenant_id,workshop_id) VALUES($1,$2) RETURNING id', [ids.tenantA, ids.workshopA]);
      return (await client.query<{ id: string }>(
        "INSERT INTO reception_cases(tenant_id,conversation_id,customer_id,vehicle_id,intent,status) VALUES($1,$2,$3,$4,'oil_service','ready_to_decide') RETURNING id",
        [ids.tenantA, conversation.rows[0].id, ids.customer, ids.vehicle],
      )).rows[0].id;
    });
    const command = (key: string) => ({
      slotToken: held.token, caseId: setup,
      identity: { resolution: 'verified' as const, customerId: ids.customer, vehicleId: ids.vehicle },
      serviceRequest, confirmationEvidenceRef: 'test:confirmation', idempotencyKey: key,
    });
    const attempts = await Promise.allSettled([
      createAppointmentTransactional(pool, contextA, command(randomUUID()), pii),
      createAppointmentTransactional(pool, contextA, command(randomUUID()), pii),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);

    await pool.query('UPDATE tenants SET kill_switch_enabled=true WHERE id=$1', [ids.tenantA]);
    await expect(findSlots(pool, contextA, { serviceRequest, window: window() })).rejects.toThrow('KILL_SWITCH_ENABLED');
    await pool.query('UPDATE tenants SET kill_switch_enabled=false,lifecycle_status=\'suspended\' WHERE id=$1', [ids.tenantA]);
    await expect(findSlots(pool, contextA, { serviceRequest, window: window() })).rejects.toThrow('TENANT_NOT_OPERATIONAL');
    await pool.query("UPDATE tenants SET lifecycle_status='pilot' WHERE id=$1", [ids.tenantA]);
  });
});
