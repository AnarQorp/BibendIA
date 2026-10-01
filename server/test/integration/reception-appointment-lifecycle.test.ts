import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), workshop: randomUUID(), endpoint: randomUUID(), principal: randomUUID(), customer: randomUUID(), vehicle: randomUUID() };
const agent = `agent-${randomUUID()}`;
const secret = `secret-${randomUUID()}`;
const auth = { authorization: `Bearer ${secret}` };
const phone = '+34600111222';
const openingHours = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index + 1), [{ start: '00:00', end: '23:59' }]]));
const app = buildApi(pool, { piiProtection: pii, providerIngress: { publicApiBaseUrl: 'https://api.test',
  elevenLabsTool: { servicePrincipalId: ids.principal, externalAccountId: agent, secret } } });

function desired(days = 7, hours = 0) {
  const date = new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
  date.setUTCMinutes(Math.ceil(date.getUTCMinutes() / 15) * 15, 0, 0);
  return date.toISOString();
}

async function findHold(providerCallId: string, desiredStartAt: string) {
  const found = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
    payload: { providerCallId, requestId: `find-${randomUUID()}`, desiredStartAt, searchHorizonMinutes: 240,
      serviceIntent: 'brakes_or_noise', symptoms: ['ruido'], limit: 1 } });
  expect(found.statusCode).toBe(200);
  expect(found.json().code).toBe('SLOT_OPTIONS_FOUND');
  const held = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
    payload: { providerCallId, requestId: `hold-${randomUUID()}`, candidateId: found.json().options[0].candidateId } });
  expect(held.statusCode).toBe(200);
  return held.json();
}

async function createAppointment(providerCallId: string, held: any) {
  const created = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth,
    payload: { providerCallId, customerName: 'Ane Arrieta', plate: '1234ABC', serviceIntent: 'brakes_or_noise',
      symptoms: ['ruido'], slotToken: held.slotToken, explicitConfirmation: true, confirmationTranscript: 'Confirmo.' } });
  expect(created.statusCode).toBe(200);
  return created.json().receipt.value;
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status,operating_mode,policy_version) VALUES($1,'Reception lifecycle','pilot','standard','reception-v1')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours,service_duration_policy) VALUES($1,$2,'Reception','Europe/Madrid',$3,$4)",
      [ids.workshop, ids.tenant, JSON.stringify(openingHours), JSON.stringify({ version: 'v1', rules: { brakes_or_noise: 60 }, fallbackMinutes: 60 })]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'binding')",
      [ids.endpoint, ids.tenant, ids.workshop, agent]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Ane Arrieta', phone });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1234 ABC', make: 'Seat', model: 'León' });
    await client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)', [ids.tenant, ids.customer, ids.vehicle]);
  });
  await pool.query("INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES($1,'elevenlabs','voice_provider',$2,'secret://test')", [ids.principal, agent]);
  await pool.query('INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4)',
    [ids.principal, ids.tenant, ids.workshop, ids.endpoint]);
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('Reception Context & Appointment Lifecycle', () => {
  it('reuses protected Customer/Vehicle and creates a plate-only vehicle only when missing', async () => {
    const existing = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
      payload: { providerCallId: `ctx-${randomUUID()}`, requestId: `ctx-${randomUUID()}`, callerPhone: phone, plate: '1234 ABC' } });
    expect(existing.statusCode).toBe(200);
    expect(existing.json().context).toMatchObject({ customer: { match: 'unique', candidates: [{ id: ids.customer }] },
      vehicle: { match: 'unique', value: { id: ids.vehicle, make: 'Seat', model: 'León', associatedCustomerMatch: 'unique', associatedCustomerIds: [ids.customer] } },
      identitySufficientForMutation: true });

    const fresh = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
      payload: { providerCallId: `ctx-${randomUUID()}`, requestId: `ctx-${randomUUID()}`, declaredPhone: phone,
        plate: '9876ZZZ', createVehicleIfMissing: true } });
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json().context.vehicle).toMatchObject({ match: 'unique', value: { make: null, model: null, associatedCustomerMatch: 'unique', associatedCustomerIds: [ids.customer] } });
    const newVehicleId = fresh.json().context.vehicle.value.id;
    expect(newVehicleId).not.toBe(ids.vehicle);
    const association = await pool.query('SELECT 1 FROM customer_vehicle_roles WHERE tenant_id=$1 AND customer_id=$2 AND vehicle_id=$3',
      [ids.tenant, ids.customer, newVehicleId]);
    expect(association.rowCount).toBe(1);

    const nameOnly = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
      payload: { providerCallId: `ctx-${randomUUID()}`, requestId: `ctx-${randomUUID()}`, customerName: 'Ane Arrieta' } });
    expect(nameOnly.json().context.customer.match).toBe('not_found');
  });

  it('lists future appointments and reschedules atomically with post-hold confirmation', async () => {
    const call = `create-${randomUUID()}`;
    const original = await createAppointment(call, await findHold(call, desired()));
    const listed = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/list-future-appointments', headers: auth,
      payload: { providerCallId: `list-${randomUUID()}`, requestId: `list-${randomUUID()}`, customerId: ids.customer, vehicleId: ids.vehicle } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().appointments).toEqual(expect.arrayContaining([expect.objectContaining({ id: original.id, vehicle: { plate: '1234ABC', make: 'Seat', model: 'León' } })]));

    const held = await findHold(`move-${randomUUID()}`, desired(8));
    const before = await pool.query('SELECT start_at,version FROM appointments WHERE tenant_id=$1 AND id=$2', [ids.tenant, original.id]);
    const premature = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { providerCallId: `move-${randomUUID()}`, requestId: `move-${randomUUID()}`, appointmentId: original.id,
        expectedVersion: original.version, slotToken: held.slotToken, origin: 'voice_phone', identity: { customerId: ids.customer, phone },
        explicitConfirmation: true, confirmationTranscript: 'Sí', confirmationCapturedAt: new Date(Date.now() - 60_000).toISOString(),
        idempotencyKey: `move-${randomUUID()}` } });
    expect(premature.statusCode).toBe(422);
    expect(premature.json()).toMatchObject({ code: 'HUMAN_ESCALATION_REQUIRED', reason: 'CONFIRMATION_BEFORE_HOLD', originalAppointmentIntact: true });
    expect((await pool.query('SELECT start_at,version FROM appointments WHERE tenant_id=$1 AND id=$2', [ids.tenant, original.id])).rows[0]).toEqual(before.rows[0]);

    const idempotencyKey = `move-${randomUUID()}`;
    const payload = { providerCallId: `move-${randomUUID()}`, requestId: `move-${randomUUID()}`, appointmentId: original.id,
      expectedVersion: original.version, slotToken: held.slotToken, origin: 'voice_phone', identity: { customerId: ids.customer, phone },
      explicitConfirmation: true, confirmationTranscript: 'Confirmo la nueva hora', confirmationCapturedAt: new Date(Date.now() + 1000).toISOString(), idempotencyKey };
    const conflict = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { ...payload, expectedVersion: original.version + 99, idempotencyKey: `conflict-${randomUUID()}` } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: 'VERSION_CONFLICT', originalAppointmentIntact: true });
    expect((await pool.query('SELECT version FROM appointments WHERE tenant_id=$1 AND id=$2', [ids.tenant, original.id])).rows[0].version).toBe(original.version);
    const moved = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth, payload });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().receipt.value).toMatchObject({ id: original.id, version: original.version + 1, status: 'confirmed' });
    const replay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { ...payload, requestId: `move-${randomUUID()}` } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().replay).toBe(true);
    expect((await pool.query("SELECT count(*)::int count FROM appointments WHERE tenant_id=$1 AND status<>'cancelled'", [ids.tenant])).rows[0].count).toBe(1);
  });

  it('cancels idempotently and blocks insufficient or cross-tenant identity', async () => {
    const appointment = (await pool.query<any>("SELECT * FROM appointments WHERE tenant_id=$1 AND status='confirmed' LIMIT 1", [ids.tenant])).rows[0];
    const idempotencyKey = `cancel-${randomUUID()}`;
    const payload = { providerCallId: `cancel-${randomUUID()}`, requestId: `cancel-${randomUUID()}`, appointmentId: appointment.id,
      expectedVersion: appointment.version, reason: 'El cliente ya no puede acudir', origin: 'voice_phone',
      identity: { customerId: ids.customer, phone }, explicitConfirmation: true, confirmationTranscript: 'Sí, cancela', idempotencyKey };
    const cancelled = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth, payload });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().receipt.value).toMatchObject({ status: 'cancelled', version: appointment.version + 1 });
    const replay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth,
      payload: { ...payload, requestId: `cancel-${randomUUID()}` } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().code).toBe('APPOINTMENT_ALREADY_CANCELLED');
    const insufficient = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth,
      payload: { ...payload, requestId: `cancel-${randomUUID()}`, idempotencyKey: `cancel-${randomUUID()}`,
        identity: { customerId: ids.customer, phone: '+34600999999' } } });
    expect(insufficient.statusCode).toBe(403);
    expect(insufficient.json()).toMatchObject({ code: 'HUMAN_ESCALATION_REQUIRED', reason: 'IDENTITY_INSUFFICIENT', originalAppointmentIntact: true });
    const foreign = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth,
      payload: { ...payload, requestId: `cancel-${randomUUID()}`, appointmentId: randomUUID(), idempotencyKey: `cancel-${randomUUID()}` } });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json()).toMatchObject({ code: 'HUMAN_ESCALATION_REQUIRED', reason: 'APPOINTMENT_NOT_FOUND' });
  });

  it('hardens near-now and short windows and never labels empty options as occupied', async () => {
    const nearNow = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId: `near-${randomUUID()}`, requestId: `near-${randomUUID()}`,
        windowFrom: new Date(Date.now() - 10_000).toISOString(), windowTo: new Date(Date.now() + 3_600_000).toISOString(),
        serviceIntent: 'brakes_or_noise', symptoms: ['ruido'], limit: 1 } });
    expect(nearNow.statusCode).toBe(200);
    const short = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId: `short-${randomUUID()}`, requestId: `short-${randomUUID()}`,
        windowFrom: desired(9), windowTo: new Date(new Date(desired(9)).getTime() + 30 * 60_000).toISOString(),
        serviceIntent: 'brakes_or_noise', symptoms: ['ruido'], limit: 1 } });
    expect(short.statusCode).toBe(422);
    expect(short.json().code).toBe('WINDOW_TOO_SHORT');
    expect(JSON.stringify(short.json())).not.toContain('occupied');
  });

  it('returns multiple associated customers without choosing one arbitrarily', async () => {
    const duplicate = randomUUID();
    await inTenantTransaction(pool, ids.tenant, (client) => insertProtectedCustomer(client, pii, {
      id: duplicate, tenantId: ids.tenant, displayName: 'Otra Persona', phone: '+34600222333',
    }).then(() => client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)',
      [ids.tenant, duplicate, ids.vehicle])));
    const response = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
      payload: { providerCallId: `multi-${randomUUID()}`, requestId: `multi-${randomUUID()}`, plate: '1234ABC' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().context.vehicle.value.associatedCustomerMatch).toBe('multiple');
    expect(response.json().context.vehicle.value.associatedCustomerIds).toHaveLength(2);
    expect(response.json().context.identitySufficientForMutation).toBe(false);
  });
});
