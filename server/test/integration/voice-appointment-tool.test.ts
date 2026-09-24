import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeAppointmentTool, resolveVerifiedIdentityForProtectedAccess } from '../../src/modules/agent-core/appointment-tool.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import type { TenantContext } from '../../src/domain/ids.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool();
const pii = testPiiProtection();
const ids = {
  tenant: randomUUID(), workshop: randomUUID(), customer: randomUUID(), vehicle: randomUUID(),
  ambiguousVehicle: randomUUID(), ambiguousCustomerA: randomUUID(), ambiguousCustomerB: randomUUID(),
};
const accountId = `agent-${randomUUID()}`;
const slotToken = `slot-${randomUUID()}`;
const baseInput = {
  customerName: 'Aitor Echeverría', plate: '1489 KMR',
  serviceIntent: 'oil_service' as const, symptoms: ['cambio de aceite'], estimatedDurationMinutes: 60, slotToken,
  explicitConfirmation: true as const, confirmationTranscript: 'Sí, confirmo explícitamente la cita.',
};
const context: TenantContext = {
  tenantId: ids.tenant as TenantContext['tenantId'], workshopId: ids.workshop as TenantContext['workshopId'],
  correlationId: 'voice-test', actor: { type: 'voice_agent', id: accountId },
};

let holdOffset = 3;
async function createHold(): Promise<string> {
  const token = `slot-${randomUUID()}`;
  const offset = holdOffset++;
  await inTenantTransaction(pool, ids.tenant, (client) => client.query(
    `INSERT INTO slot_holds (tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at)
     VALUES ($1,$2,$3,now()+($4::int * interval '1 day'),now()+($4::int * interval '1 day')+interval '1 hour',
       '[{"resourceType":"mechanic","quantity":1}]',now()+interval '1 day')`,
    [ids.tenant, ids.workshop, token, offset],
  ));
  return token;
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants (id,name,operating_mode,lifecycle_status) VALUES ($1,'Voice tool tenant','pilot_supervised','pilot')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops (id,tenant_id,name) VALUES ($1,$2,'Voice workshop')", [ids.workshop, ids.tenant]);
    await client.query("INSERT INTO channel_endpoints (tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES ($1,$2,'elevenlabs',$3,'web-gate')", [ids.tenant, ids.workshop, accountId]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Aitor Etxeberria' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1489 KMR' });
    await client.query('INSERT INTO customer_vehicle_roles (tenant_id,customer_id,vehicle_id) VALUES ($1,$2,$3)', [ids.tenant, ids.customer, ids.vehicle]);
    await insertProtectedCustomer(client, pii, { id: ids.ambiguousCustomerA, tenantId: ids.tenant, displayName: 'Registro Uno' });
    await insertProtectedCustomer(client, pii, { id: ids.ambiguousCustomerB, tenantId: ids.tenant, displayName: 'Registro Dos' });
    await insertProtectedVehicle(client, pii, { id: ids.ambiguousVehicle, tenantId: ids.tenant, plate: '7777 AMB' });
    await client.query(
      `INSERT INTO customer_vehicle_roles (tenant_id,customer_id,vehicle_id) VALUES ($1,$2,$3),($1,$4,$3)`,
      [ids.tenant, ids.ambiguousCustomerA, ids.ambiguousVehicle, ids.ambiguousCustomerB],
    );
    await client.query("INSERT INTO slot_holds (tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at) VALUES ($1,$2,$3,now()+interval '2 days',now()+interval '2 days 1 hour','[{\"resourceType\":\"mechanic\",\"quantity\":1}]',now()+interval '1 day')", [ids.tenant, ids.workshop, slotToken]);
  });
});

afterAll(async () => { await pool.end(); });

describe('voice appointment tool identity and replay safety', () => {
  it('uses a strong plate match despite a name variant and replays to the same appointment', async () => {
    const providerCallId = `call-${randomUUID()}`;
    const first = await executeAppointmentTool(pool, context, { ...baseInput, providerCallId }, pii);
    const replay = await executeAppointmentTool(pool, context, { ...baseInput, providerCallId }, pii);
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok || !first.receipt || !replay.receipt) throw new Error('Expected succeeded receipts');
    expect(replay.receipt.value?.id).toBe(first.receipt.value?.id);
    expect(first.receipt.value?.customerId).toBe(ids.customer);
    expect(first.receipt.value?.vehicleId).toBe(ids.vehicle);

    const counts = await inTenantTransaction(pool, ids.tenant, async (client) => Promise.all([
      client.query('SELECT count(*)::int count FROM appointments WHERE idempotency_key=$1', [`voice-appointment:elevenlabs:${providerCallId}`]),
      client.query('SELECT count(*)::int count FROM action_intents WHERE idempotency_key=$1', [`voice-appointment:elevenlabs:${providerCallId}`]),
    ]));
    expect(counts.map((result) => result.rows[0].count)).toEqual([1, 1]);

    const minimized = await inTenantTransaction(pool, ids.tenant, async (client) => ({
      messages: (await client.query('SELECT content_legacy_jsonb,content_metadata_jsonb,content_ciphertext FROM messages')).rows,
      intents: (await client.query('SELECT input_jsonb FROM action_intents WHERE idempotency_key=$1', [`voice-appointment:elevenlabs:${providerCallId}`])).rows,
    }));
    const serialized = JSON.stringify(minimized);
    expect(serialized).not.toContain(baseInput.confirmationTranscript);
    expect(serialized).not.toContain(baseInput.symptoms[0]);
    expect(minimized.messages[0]).toMatchObject({ content_legacy_jsonb: null, content_metadata_jsonb: { kind: 'explicit_confirmation', explicitConfirmation: true } });
  });

  it('provisions a new identity as provisional and creates the appointment atomically', async () => {
    const providerCallId = `new-${randomUUID()}`;
    const result = await executeAppointmentTool(pool, context, {
      ...baseInput, providerCallId, slotToken: await createHold(), customerName: 'Marta Etxebarria', plate: '8421 LMK',
    }, pii);
    expect(result).toMatchObject({ ok: true, code: 'APPOINTMENT_CREATED', receipt: { value: { identityResolution: 'provisional_new' } } });
    const persisted = await inTenantTransaction(pool, ids.tenant, async (client) => client.query(
      `SELECT a.customer_id,a.vehicle_id,r.verification_status
       FROM appointments a JOIN customer_vehicle_roles r
         ON r.tenant_id=a.tenant_id AND r.customer_id=a.customer_id AND r.vehicle_id=a.vehicle_id
       WHERE a.id=$1`,
      [result.receipt?.value?.id],
    ));
    expect(persisted.rows[0]).toMatchObject({ verification_status: 'provisional' });
    const minimized = await pool.query(
      `SELECT a.input_jsonb,o.payload_jsonb,e.evidence_ref
       FROM action_intents a
       JOIN appointments p ON p.tenant_id=a.tenant_id AND p.idempotency_key=a.idempotency_key
       JOIN outbox_events o ON o.tenant_id=p.tenant_id AND o.aggregate_id=p.id
       JOIN audit_events e ON e.tenant_id=p.tenant_id AND e.entity_id=p.id::text
       WHERE p.id=$1`,
      [result.receipt?.value?.id],
    );
    expect(JSON.stringify(minimized.rows)).not.toContain('Marta Etxebarria');
    expect(JSON.stringify(minimized.rows)).not.toContain('8421LMK');
  });

  it('creates an appointment for an ambiguous identity without associating existing protected records', async () => {
    const customerCountBefore = await pool.query('SELECT count(*)::int count FROM customers WHERE tenant_id=$1', [ids.tenant]);
    const result = await executeAppointmentTool(pool, context, {
      ...baseInput, providerCallId: `ambiguous-${randomUUID()}`, slotToken: await createHold(),
      customerName: 'Marta Etxebarria', plate: '7777 AMB',
    }, pii);
    expect(result).toMatchObject({
      ok: true, code: 'APPOINTMENT_CREATED',
      receipt: { value: { customerId: null, vehicleId: null, identityResolution: 'provisional_ambiguous' } },
    });
    const customerCountAfter = await pool.query('SELECT count(*)::int count FROM customers WHERE tenant_id=$1', [ids.tenant]);
    expect(customerCountAfter.rows[0].count).toBe(customerCountBefore.rows[0].count);
    const receptionCase = await pool.query(
      'SELECT customer_id,vehicle_id FROM reception_cases WHERE id=$1', [result.caseId],
    );
    expect(receptionCase.rows[0]).toEqual({ customer_id: null, vehicle_id: null });
    const appointment = await pool.query('SELECT * FROM appointments WHERE id=$1', [result.receipt?.value?.id]);
    expect(JSON.stringify(appointment.rows[0])).not.toContain('Marta Etxebarria');
    expect(JSON.stringify(appointment.rows[0])).not.toContain('7777AMB');
  });

  it('blocks protected-data identity access when the match is ambiguous or provisional', async () => {
    await expect(inTenantTransaction(pool, ids.tenant, (client) => resolveVerifiedIdentityForProtectedAccess(
      client, pii, ids.tenant, 'Marta Etxebarria', '7777 AMB',
    ))).rejects.toThrow('IDENTITY_AMBIGUOUS');
    await expect(inTenantTransaction(pool, ids.tenant, (client) => resolveVerifiedIdentityForProtectedAccess(
      client, pii, ids.tenant, 'Marta Etxebarria', '8421 LMK',
    ))).rejects.toThrow('IDENTITY_AMBIGUOUS');
  });
});
