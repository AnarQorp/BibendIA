import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';
import { testWorkshopCapacityPolicy } from '../support/workshop-capacity.js';
import { resolveCanonicalReceptionContext } from '../../src/modules/agent-core/reception-lifecycle-tools.js';
import { loadProviderCapability } from '../../src/modules/agent-core/provider-capabilities.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), workshop: randomUUID(), endpoint: randomUUID(), principal: randomUUID(),
  customer: randomUUID(), vehicle: randomUUID() };
const agent = `agent-${randomUUID()}`;
const secret = `secret-${randomUUID()}`;
const auth = { authorization: `Bearer ${secret}` };
const phone = '+34600111222';
const openingHours = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index + 1), [{ start: '00:00', end: '23:59' }]]));
const app = buildApi(pool, { piiProtection: pii, providerIngress: { publicApiBaseUrl: 'https://api.test',
  elevenLabsTool: { servicePrincipalId: ids.principal, externalAccountId: agent, secret } },
  confirmationEvidenceVerifier: { async verify(input) { if (!input.evidenceRef.startsWith('provider-event-')) throw new Error('unverified'); return { verified: true as const,
    occurredAt: new Date(Date.parse(input.preparedAt) + 1000).toISOString(), source: 'test-provider-fixture' }; } } });

function desired(days = 7) {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCMinutes(Math.ceil(date.getUTCMinutes() / 15) * 15, 0, 0);
  return date.toISOString();
}

async function resolve(providerConversationId: string, extra: Record<string, unknown> = {}) {
  const response = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
    payload: { providerConversationId, requestId: `resolve-${randomUUID()}`, providerCallerPhone: phone, plate: '1234 ABC', ...extra } });
  expect(response.statusCode).toBe(200);
  return response.json().context;
}

async function findHold(providerConversationId: string, desiredStartAt: string) {
  const found = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
    payload: { providerCallId: providerConversationId, requestId: `find-${randomUUID()}`, desiredStartAt, searchHorizonMinutes: 240,
      serviceIntent: 'brakes_or_noise', symptoms: ['ruido'], limit: 1 } });
  expect(found.statusCode).toBe(200);
  const held = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
    payload: { providerCallId: providerConversationId, requestId: `hold-${randomUUID()}`, candidateId: found.json().options[0].candidateId } });
  expect(held.statusCode).toBe(200);
  return held.json();
}

async function createAppointment(providerConversationId: string, receptionContextToken: string, held: { slotToken: string }) {
  const created = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth,
    payload: { providerConversationId, requestId: `create-${randomUUID()}`, receptionContextToken,
      idempotencyKey: `create-${randomUUID()}`, serviceIntent: 'brakes_or_noise', symptoms: ['ruido'],
      slotToken: held.slotToken, explicitConfirmation: true, confirmationTranscript: 'Confirmo.' } });
  expect(created.statusCode).toBe(200);
  return created.json().receipt.value;
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status,operating_mode,policy_version) VALUES($1,'Reception lifecycle','pilot','standard','reception-v2')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours,service_duration_policy,capacity_policy) VALUES($1,$2,'Reception','Europe/Madrid',$3,$4,$5)",
      [ids.workshop, ids.tenant, JSON.stringify(openingHours), JSON.stringify({ version: 'v1', rules: { brakes_or_noise: 60 }, fallbackMinutes: 60 }), JSON.stringify(testWorkshopCapacityPolicy)]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'binding')",
      [ids.endpoint, ids.tenant, ids.workshop, agent]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Ane Arrieta', phone });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1234 ABC', make: 'Seat', model: 'León' });
    await client.query("INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id,verification_status) VALUES($1,$2,$3,'provisional')",
      [ids.tenant, ids.customer, ids.vehicle]);
  });
  await pool.query("INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES($1,'elevenlabs','voice_provider',$2,'secret://test')", [ids.principal, agent]);
  await pool.query('INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4)',
    [ids.principal, ids.tenant, ids.workshop, ids.endpoint]);
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('Reception Context & Appointment Lifecycle V2', () => {
  it('issues canonical context only from provider caller identity and preserves provisional relation', async () => {
    const conversation = `ctx-${randomUUID()}`;
    const context = await resolve(conversation);
    expect(context).toMatchObject({ customer: { match: 'unique', candidates: [{ id: ids.customer }] },
      vehicle: { match: 'unique', value: { id: ids.vehicle, make: 'Seat', model: 'León',
        associatedCustomers: [{ id: ids.customer, verificationStatus: 'provisional' }] } },
      identitySufficientForMutation: true, callerAssurance: 'provider_supplied_not_kyc' });
    expect(context.receptionContextToken).toMatch(/^[0-9a-f-]{36}$/);
    await expect(resolveCanonicalReceptionContext(pool, pii, { tenantId: ids.tenant, workshopId: randomUUID(),
      correlationId: 'wrong-workshop', actor: { type: 'voice_agent', id: agent } } as never,
    context.receptionContextToken, conversation)).rejects.toThrow('RECEPTION_CONTEXT_BINDING_MISMATCH');
    await expect(resolveCanonicalReceptionContext(pool, pii, { tenantId: ids.tenant, workshopId: ids.workshop,
      correlationId: 'wrong-principal', actor: { type: 'voice_agent', id: randomUUID() } } as never,
    context.receptionContextToken, conversation)).rejects.toThrow('RECEPTION_CONTEXT_BINDING_MISMATCH');
    const declared = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
      payload: { providerConversationId: `declared-${randomUUID()}`, requestId: `resolve-${randomUUID()}`,
        declaredPhone: phone, plate: '1234 ABC' } });
    expect(declared.json().context).toMatchObject({ callerAssurance: 'declared_untrusted',
      identitySufficientForMutation: false, receptionContextToken: null });

    const fresh = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/resolve-reception-context', headers: auth,
      payload: { providerConversationId: `new-${randomUUID()}`, requestId: `resolve-${randomUUID()}`,
        providerCallerPhone: phone, plate: '9876ZZZ', createVehicleIfMissing: true } });
    expect(fresh.statusCode).toBe(200);
    const newVehicleId = fresh.json().context.vehicle.value.id;
    const relation = await pool.query('SELECT verification_status FROM customer_vehicle_roles WHERE tenant_id=$1 AND customer_id=$2 AND vehicle_id=$3',
      [ids.tenant, ids.customer, newVehicleId]);
    expect(relation.rows[0].verification_status).toBe('provisional');
    expect(fresh.json().context.vehicle.value).toMatchObject({ make: null, model: null });

    const capabilityConversation = `cap-${randomUUID()}`;
    const found = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId: capabilityConversation, requestId: `find-${randomUUID()}`,
        desiredStartAt: desired(5), searchHorizonMinutes: 240, serviceIntent: 'brakes_or_noise', symptoms: ['ruido'], limit: 1 } });
    const stolen = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
      payload: { providerCallId: `other-${randomUUID()}`, requestId: `hold-${randomUUID()}`,
        candidateId: found.json().options[0].candidateId } });
    expect(stolen.statusCode).toBe(409);
    expect(stolen.json().code).toBe('CAPABILITY_BINDING_MISMATCH');
    await expect(inTenantTransaction(pool, ids.tenant, (client) => loadProviderCapability(client,
      { tenantId: ids.tenant, workshopId: ids.workshop, correlationId: 'wrong-principal',
        actor: { type: 'voice_agent', id: randomUUID() } } as never,
      found.json().options[0].candidateId, capabilityConversation, 'find-slots')))
      .rejects.toThrow('CAPABILITY_BINDING_MISMATCH');
  });

  it('creates against canonical provisional entities without duplicating or promoting them', async () => {
    const conversation = `create-${randomUUID()}`;
    const context = await resolve(conversation);
    const before = await pool.query('SELECT (SELECT count(*) FROM customers WHERE tenant_id=$1)::int customers,(SELECT count(*) FROM vehicles WHERE tenant_id=$1)::int vehicles', [ids.tenant]);
    const appointment = await createAppointment(conversation, context.receptionContextToken, await findHold(conversation, desired(6)));
    expect(appointment).toMatchObject({ customerId: ids.customer, vehicleId: ids.vehicle });
    const persisted = await pool.query(`SELECT a.customer_id,a.vehicle_id,r.verification_status,
      (SELECT count(*) FROM customers WHERE tenant_id=$1)::int customers,(SELECT count(*) FROM vehicles WHERE tenant_id=$1)::int vehicles
      FROM appointments a JOIN customer_vehicle_roles r ON r.tenant_id=a.tenant_id AND r.customer_id=a.customer_id AND r.vehicle_id=a.vehicle_id
      WHERE a.tenant_id=$1 AND a.id=$2`, [ids.tenant, appointment.id]);
    expect(persisted.rows[0]).toMatchObject({ customer_id: ids.customer, vehicle_id: ids.vehicle,
      verification_status: 'provisional', customers: before.rows[0].customers, vehicles: before.rows[0].vehicles });
  });

  it('reproduces Voice E2E safely: resolve → list → hold → prepare → confirm → atomic reschedule', async () => {
    const conversation = `move-${randomUUID()}`;
    const context = await resolve(conversation);
    const original = await createAppointment(conversation, context.receptionContextToken, await findHold(conversation, desired(7)));
    const listed = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/list-future-appointments', headers: auth,
      payload: { providerConversationId: conversation, requestId: `list-${randomUUID()}`,
        receptionContextToken: context.receptionContextToken } });
    expect(listed.json().appointments).toEqual(expect.arrayContaining([expect.objectContaining({ id: original.id })]));
    const held = await findHold(conversation, desired(8));
    const preparePayload = { providerConversationId: conversation, requestId: `prepare-${randomUUID()}`,
        receptionContextToken: context.receptionContextToken, appointmentId: original.id,
        expectedVersion: original.version, slotToken: held.slotToken };
    const prepared = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/prepare-reschedule', headers: auth,
      payload: preparePayload });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.json()).toMatchObject({ code: 'RESCHEDULE_CONFIRMATION_REQUIRED', original: { appointmentId: original.id } });
    const preparedReplay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/prepare-reschedule', headers: auth,
      payload: preparePayload });
    expect(preparedReplay.statusCode).toBe(200);
    expect(preparedReplay.json().rescheduleContextToken).toBe(prepared.json().rescheduleContextToken);
    expect((await pool.query("SELECT count(*)::int count FROM action_intents WHERE tenant_id=$1 AND tool_name='reschedule_capability_v3' AND case_id=(SELECT case_id FROM appointments WHERE id=$2)",
      [ids.tenant, original.id])).rows[0].count).toBe(1);

    const freeConfirmation = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { providerConversationId: conversation, requestId: `free-${randomUUID()}`,
        rescheduleContextToken: prepared.json().rescheduleContextToken, origin: 'voice_phone',
        confirmationTranscript: 'sí', idempotencyKey: `free-${randomUUID()}` } });
    expect(freeConfirmation.statusCode).toBe(422);
    const unverifiedConfirmation = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { providerConversationId: conversation, requestId: `unverified-${randomUUID()}`,
        rescheduleContextToken: prepared.json().rescheduleContextToken, origin: 'voice_phone',
        confirmationEvidenceRef: 'free-text-confirmation', idempotencyKey: `unverified-${randomUUID()}` } });
    expect(unverifiedConfirmation.statusCode).toBe(422);

    const forbiddenCancel = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth,
      payload: { providerConversationId: conversation, requestId: `cancel-${randomUUID()}`,
        receptionContextToken: context.receptionContextToken, appointmentId: original.id,
        expectedVersion: original.version, reason: 'Intento de cancel+create', origin: 'voice_phone',
        confirmationTranscript: 'Cancela y crea otra', idempotencyKey: `cancel-${randomUUID()}` } });
    expect(forbiddenCancel.statusCode).toBe(422);
    expect(forbiddenCancel.json()).toMatchObject({ code: 'RESCHEDULE_IN_PROGRESS', originalAppointmentIntact: true });

    const idempotencyKey = `reschedule-${randomUUID()}`;
    const payload = { providerConversationId: conversation, requestId: `reschedule-${randomUUID()}`,
      rescheduleContextToken: prepared.json().rescheduleContextToken, origin: 'voice_phone',
      confirmationEvidenceRef: `provider-event-${randomUUID()}`, idempotencyKey };
    const moved = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth, payload });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().receipt.value).toMatchObject({ id: original.id, customerId: ids.customer,
      vehicleId: ids.vehicle, version: original.version + 1, status: 'confirmed' });
    const replay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { ...payload, requestId: `reschedule-${randomUUID()}` } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().replay).toBe(true);
    const stolenReplay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { ...payload, providerConversationId: `other-${randomUUID()}`, requestId: `stolen-${randomUUID()}` } });
    expect(stolenReplay.statusCode).toBe(403);
    expect(stolenReplay.json().reason).toBe('RESCHEDULE_CONTEXT_CONVERSATION_MISMATCH');
    const state = await pool.query(`SELECT
      (SELECT count(*)::int FROM appointments WHERE tenant_id=$1 AND id=$2 AND status<>'cancelled') active,
      (SELECT count(*)::int FROM outbox_events WHERE tenant_id=$1 AND aggregate_id=$2 AND event_type='appointment.created') created_events,
      (SELECT count(*)::int FROM messages WHERE tenant_id=$1 AND content_metadata_jsonb->>'kind'='reschedule_confirmation') confirmations`,
    [ids.tenant, original.id]);
    expect(state.rows[0]).toMatchObject({ active: 1, created_events: 1, confirmations: 0 });
    expect((await pool.query('SELECT confirmation_evidence_ref FROM appointments WHERE tenant_id=$1 AND id=$2',
      [ids.tenant, original.id])).rows[0].confirmation_evidence_ref).toBe(payload.confirmationEvidenceRef);
  });

  it('rejects unprepared/stale reschedule and leaves original intact with sanitized errors', async () => {
    const conversation = `negative-${randomUUID()}`;
    const context = await resolve(conversation);
    const original = await createAppointment(conversation, context.receptionContextToken, await findHold(conversation, desired(9)));
    const before = await pool.query('SELECT start_at,end_at,status,version FROM appointments WHERE tenant_id=$1 AND id=$2', [ids.tenant, original.id]);
    const response = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { providerConversationId: conversation, requestId: `reschedule-${randomUUID()}`,
        rescheduleContextToken: randomUUID(), origin: 'voice_phone', confirmationEvidenceRef: `provider-event-${randomUUID()}`, idempotencyKey: `move-${randomUUID()}` } });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ ok: false, code: 'HUMAN_ESCALATION_REQUIRED', reason: 'RESCHEDULE_CONTEXT_INVALID', originalAppointmentIntact: true });
    expect((await pool.query('SELECT start_at,end_at,status,version FROM appointments WHERE tenant_id=$1 AND id=$2', [ids.tenant, original.id])).rows[0]).toEqual(before.rows[0]);
    expect(JSON.stringify(response.json())).not.toContain('stack');
  });

  it('claims duplicate provider request IDs and does not duplicate cancellation receipts', async () => {
    const conversation = `cancel-${randomUUID()}`;
    const context = await resolve(conversation);
    const appointment = await createAppointment(conversation, context.receptionContextToken, await findHold(conversation, desired(10)));
    const requestId = `cancel-${randomUUID()}`;
    const payload = { providerConversationId: conversation, requestId, receptionContextToken: context.receptionContextToken,
      appointmentId: appointment.id, expectedVersion: appointment.version, reason: 'El cliente no puede acudir',
      origin: 'voice_phone', confirmationTranscript: 'Sí, cancela', idempotencyKey: `cancel-${randomUUID()}` };
    const first = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth, payload });
    const retry = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth, payload });
    expect(first.statusCode).toBe(200);
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toMatchObject({ code: 'APPOINTMENT_ALREADY_CANCELLED', disposition: 'duplicate' });
    const evidence = await pool.query(`SELECT
      (SELECT count(*)::int FROM action_intents WHERE tenant_id=$1 AND idempotency_key=$2) intents,
      (SELECT count(*)::int FROM messages WHERE tenant_id=$1 AND content_metadata_jsonb->>'kind'='cancel_confirmation'
        AND content_metadata_jsonb->>'boundContextId'=$3) confirmations`, [ids.tenant, payload.idempotencyKey, appointment.id]);
    expect(evidence.rows[0]).toMatchObject({ intents: 1, confirmations: 1 });
  });

  it('rejects service-mismatched holds and lazily expires preparation without blocking cancel', async () => {
    const mismatchConversation = `mismatch-${randomUUID()}`;
    const mismatchContext = await resolve(mismatchConversation);
    const mismatchOriginal = await createAppointment(mismatchConversation, mismatchContext.receptionContextToken,
      await findHold(mismatchConversation, desired(11)));
    const wrongHold = await findHold(mismatchConversation, desired(12));
    await pool.query("UPDATE slot_holds SET service_intent='inspection' WHERE tenant_id=$1 AND slot_token=$2",
      [ids.tenant, wrongHold.slotToken]);
    const mismatch = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/prepare-reschedule', headers: auth,
      payload: { providerConversationId: mismatchConversation, requestId: `prepare-${randomUUID()}`,
        receptionContextToken: mismatchContext.receptionContextToken, appointmentId: mismatchOriginal.id,
        expectedVersion: mismatchOriginal.version, slotToken: wrongHold.slotToken } });
    expect(mismatch.statusCode).toBe(422);
    expect(mismatch.json().reason).toBe('RESCHEDULE_SERVICE_MISMATCH');

    const conversation = `expired-${randomUUID()}`;
    const context = await resolve(conversation);
    const original = await createAppointment(conversation, context.receptionContextToken, await findHold(conversation, desired(13)));
    const held = await findHold(conversation, desired(14));
    const prepared = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/prepare-reschedule', headers: auth,
      payload: { providerConversationId: conversation, requestId: `prepare-${randomUUID()}`,
        receptionContextToken: context.receptionContextToken, appointmentId: original.id,
        expectedVersion: original.version, slotToken: held.slotToken } });
    const token = prepared.json().rescheduleContextToken;
    await pool.query(`UPDATE action_intents SET input_jsonb=jsonb_set(input_jsonb,'{expiresAt}',to_jsonb((now()-interval '1 second')::text))
      WHERE tenant_id=$1 AND (idempotency_key=$2 OR input_jsonb->>'token'=$3)`,
    [ids.tenant, `reschedule-context:${token}`, token]);
    const expiredMove = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/reschedule-appointment', headers: auth,
      payload: { providerConversationId: conversation, requestId: `move-${randomUUID()}`, rescheduleContextToken: token,
        origin: 'voice_phone', confirmationEvidenceRef: `provider-event-${randomUUID()}`, idempotencyKey: `move-${randomUUID()}` } });
    expect(expiredMove.statusCode).toBe(422);
    expect(expiredMove.json().reason).toBe('RESCHEDULE_CONTEXT_EXPIRED');
    const cancelled = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/cancel-appointment', headers: auth,
      payload: { providerConversationId: conversation, requestId: `cancel-${randomUUID()}`,
        receptionContextToken: context.receptionContextToken, appointmentId: original.id, expectedVersion: original.version,
        reason: 'Cambio de planes', origin: 'voice_phone', confirmationTranscript: 'Sí, cancela', idempotencyKey: `cancel-${randomUUID()}` } });
    expect(cancelled.statusCode).toBe(200);
  });
});
