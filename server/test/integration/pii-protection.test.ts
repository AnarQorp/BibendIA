import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import type { TenantContext } from '../../src/domain/ids.js';
import { createAppointmentTransactional } from '../../src/modules/scheduling/postgres-scheduling.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { normalizeSpanishPlate } from '../../src/security/pii-protection.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = {
  tenantA: randomUUID(), tenantB: randomUUID(), workshopA: randomUUID(), workshopB: randomUUID(),
  customerA: randomUUID(), customerB: randomUUID(), vehicleA: randomUUID(), vehicleB: randomUUID(),
  conversationA: randomUUID(), caseA: randomUUID(), workshopUser: randomUUID(), supportUser: randomUUID(),
};
const customerName = 'Aitor PII Integration';
const plate = '1489 KMR';
const notes = 'Cliente solicita llamar al 600123456';
const symptom = 'Ruido descrito con datos personales';
const slot = `slot-${randomUUID()}`;
const future = new Date(Date.now() + 60 * 60_000).toISOString();
const authenticatedAt = new Date().toISOString();

const workshopPrincipal: PrincipalContext = {
  kind: 'workshop_user', audience: 'workshop', userId: ids.workshopUser, issuer: 'test', subject: ids.workshopUser,
  sessionId: randomUUID(), authenticatedAt, expiresAt: future, assurance: 'single_factor',
};
const supportPrincipal: PrincipalContext = {
  kind: 'platform_user', audience: 'platform', userId: ids.supportUser, issuer: 'test', subject: ids.supportUser,
  sessionId: randomUUID(), authenticatedAt, expiresAt: future, assurance: 'mfa',
};
const authentication: AuthenticationAdapter = {
  async authenticate(request) {
    if (request.authorization === 'Bearer workshop-pii') return workshopPrincipal;
    if (request.authorization === 'Bearer support-pii') return supportPrincipal;
    return null;
  },
};
const app = buildApi(pool, { authentication, piiProtection: pii });

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'PII A','pilot'),($2,'PII B','pilot')", [ids.tenantA, ids.tenantB]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active'),($2,'active')", [ids.workshopUser, ids.supportUser]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'OWNER')", [ids.workshopUser, ids.tenantA]);
  await pool.query("INSERT INTO platform_access_grants(user_id,role,scope_type,tenant_id) VALUES($1,'SUPPORT_READONLY','tenant',$2)", [ids.supportUser, ids.tenantA]);
  await inTenantTransaction(pool, ids.tenantA, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Workshop A')", [ids.workshopA, ids.tenantA]);
    await insertProtectedCustomer(client, pii, { id: ids.customerA, tenantId: ids.tenantA, displayName: customerName });
    await insertProtectedVehicle(client, pii, { id: ids.vehicleA, tenantId: ids.tenantA, plate });
    await client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)', [ids.tenantA, ids.customerA, ids.vehicleA]);
    await client.query('INSERT INTO conversations(id,tenant_id,workshop_id) VALUES($1,$2,$3)', [ids.conversationA, ids.tenantA, ids.workshopA]);
    await client.query("INSERT INTO reception_cases(id,tenant_id,conversation_id,customer_id,vehicle_id,intent) VALUES($1,$2,$3,$4,$5,'generic_fault')", [ids.caseA, ids.tenantA, ids.conversationA, ids.customerA, ids.vehicleA]);
    await client.query("INSERT INTO slot_holds(tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at) VALUES($1,$2,$3,now()+interval '1 day',now()+interval '1 day 1 hour','[]',now()+interval '1 hour')", [ids.tenantA, ids.workshopA, slot]);
  });
  await inTenantTransaction(pool, ids.tenantB, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Workshop B')", [ids.workshopB, ids.tenantB]);
    await insertProtectedCustomer(client, pii, { id: ids.customerB, tenantId: ids.tenantB, displayName: customerName });
    await insertProtectedVehicle(client, pii, { id: ids.vehicleB, tenantId: ids.tenantB, plate });
  });
  const context: TenantContext = {
    tenantId: ids.tenantA as TenantContext['tenantId'], workshopId: ids.workshopA as TenantContext['workshopId'],
    correlationId: randomUUID(), actor: { type: 'voice_agent', id: 'pii-integration' },
  };
  await createAppointmentTransactional(pool, context, {
    slotToken: slot, caseId: ids.caseA,
    identity: { resolution: 'verified', customerId: ids.customerA, vehicleId: ids.vehicleA },
    serviceRequest: { intent: 'generic_fault', symptoms: [symptom], notes, estimatedDurationMinutes: 60, capacityRequirements: [] },
    confirmationEvidenceRef: 'evidence:pii-test', idempotencyKey: `pii-${randomUUID()}`,
  }, pii);
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('P0.6 protected persistence and exposure', () => {
  it('does not persist protected PII in cleartext or duplicate it into action/outbox/audit', async () => {
    const snapshot = await inTenantTransaction(pool, ids.tenantA, async (client) => {
      const customer = await client.query('SELECT * FROM customers WHERE id=$1', [ids.customerA]);
      const vehicle = await client.query('SELECT * FROM vehicles WHERE id=$1', [ids.vehicleA]);
      const appointment = await client.query('SELECT * FROM appointments WHERE case_id=$1', [ids.caseA]);
      const intent = await client.query('SELECT input_jsonb FROM action_intents WHERE case_id=$1', [ids.caseA]);
      const outbox = await client.query('SELECT payload_jsonb FROM outbox_events WHERE aggregate_id=$1', [appointment.rows[0].id]);
      const audit = await client.query('SELECT * FROM audit_events WHERE entity_id=$1', [appointment.rows[0].id]);
      return { customer: customer.rows[0], vehicle: vehicle.rows[0], appointment: appointment.rows[0], intent: intent.rows[0], outbox: outbox.rows[0], audit: audit.rows[0] };
    });
    const serialized = JSON.stringify(snapshot);
    for (const clear of [customerName, plate, notes, symptom, '600123456']) expect(serialized).not.toContain(clear);
    expect(snapshot.customer.display_name_legacy).toBeNull();
    expect(snapshot.vehicle.plate_legacy_value).toBeNull();
    expect(snapshot.appointment.notes).toBeNull();
    expect(snapshot.appointment.symptoms).toEqual([]);
    expect(snapshot.intent.input_jsonb).toEqual(expect.objectContaining({ caseId: ids.caseA }));
    expect(snapshot.outbox.payload_jsonb).toEqual({ appointmentId: snapshot.appointment.id });
  });

  it('binds exact lookup to tenant and normalization', async () => {
    const a = pii.activeLookupDigest(ids.tenantA, 'vehicle.plate', normalizeSpanishPlate('1489-kmr'));
    const b = pii.activeLookupDigest(ids.tenantB, 'vehicle.plate', normalizeSpanishPlate('1489 KMR'));
    expect(a.digest).not.toBe(b.digest);
    const visible = await inTenantTransaction(pool, ids.tenantA, (client) => client.query(
      'SELECT id FROM vehicles WHERE plate_lookup_digest=ANY($1::text[])',
      [pii.lookupDigests(ids.tenantA, 'vehicle.plate', normalizeSpanishPlate('1489-kmr')).map((item) => item.digest)],
    ));
    expect(visible.rows).toEqual([{ id: ids.vehicleA }]);
    const crossTenant = await inTenantTransaction(pool, ids.tenantB, (client) => client.query(
      'SELECT id FROM vehicles WHERE plate_lookup_digest=$1', [a.digest],
    ));
    expect(crossTenant.rowCount).toBe(0);
  });

  it('reveals PII to the authorized Workshop route but keeps Support readonly redacted', async () => {
    const workshop = await app.inject({
      url: `/v1/workshop/tenants/${ids.tenantA}/appointments`, headers: { authorization: 'Bearer workshop-pii' },
    });
    expect(workshop.statusCode).toBe(200);
    expect(workshop.json().data[0]).toMatchObject({ customer_name: customerName, vehicle_plate: '1489KMR' });
    expect(JSON.stringify(workshop.json())).toContain(notes);

    const support = await app.inject({
      url: `/v1/platform/tenants/${ids.tenantA}/appointments`, headers: { authorization: 'Bearer support-pii' },
    });
    expect(support.statusCode).toBe(200);
    expect(support.json().redacted).toBe(true);
    const serialized = JSON.stringify(support.json());
    for (const clear of [customerName, plate, notes, symptom]) expect(serialized).not.toContain(clear);
  });

  it('fails the PII response closed when runtime keys are unavailable', async () => {
    const withoutKeys = buildApi(pool, { authentication });
    try {
      const response = await withoutKeys.inject({
        url: `/v1/workshop/tenants/${ids.tenantA}/appointments`, headers: { authorization: 'Bearer workshop-pii' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'PII_PROTECTION_UNAVAILABLE' });
      expect(JSON.stringify(response.json())).not.toContain(customerName);
    } finally {
      await withoutKeys.close();
    }
  });
});
