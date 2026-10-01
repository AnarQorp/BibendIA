import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { inTenantTransaction } from '../../persistence/pool.js';
import { inAuthorizedProviderTransaction } from '../../auth/provider-authorization.js';
import type { ServicePrincipal } from '../../auth/principal.js';
import type { PiiProtection } from '../../security/pii-protection.js';
import { normalizeE164Phone, normalizeSpanishPlate } from '../../security/pii-protection.js';
import { insertProtectedVehicle } from '../../security/protected-records.js';
import { assertTenantOperation } from '../tenant-control/tenant-control.js';

const base = z.object({ providerCallId: z.string().min(1).max(200), requestId: z.string().min(8).max(200) });
const identityEvidence = z.object({
  customerId: z.string().uuid(),
  phone: z.string().min(7).max(30),
}).strict();

export const resolveReceptionContextSchema = base.extend({
  callerPhone: z.string().min(7).max(30).optional(),
  declaredPhone: z.string().min(7).max(30).optional(),
  customerName: z.string().trim().min(2).max(200).optional(),
  plate: z.string().min(4).max(20).optional(),
  createVehicleIfMissing: z.boolean().default(false),
}).strict();

export const listFutureAppointmentsSchema = base.extend({
  customerId: z.string().uuid().optional(), vehicleId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(10).default(5),
}).strict().refine((value) => value.customerId || value.vehicleId, 'customerId or vehicleId is required');

export const cancelAppointmentSchema = base.extend({
  appointmentId: z.string().uuid(), expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500), origin: z.literal('voice_phone'),
  identity: identityEvidence, explicitConfirmation: z.literal(true),
  confirmationTranscript: z.string().trim().min(1).max(1000),
  idempotencyKey: z.string().min(8).max(200),
}).strict();

export const rescheduleAppointmentSchema = base.extend({
  appointmentId: z.string().uuid(), expectedVersion: z.number().int().positive(),
  slotToken: z.string().uuid(), origin: z.literal('voice_phone'), identity: identityEvidence,
  explicitConfirmation: z.literal(true), confirmationTranscript: z.string().trim().min(1).max(1000),
  confirmationCapturedAt: z.string().datetime({ offset: true }), idempotencyKey: z.string().min(8).max(200),
}).strict();

type Context = { tenantId: string; workshopId: string; actor: { type: string; id: string }; correlationId: string };

function reveal(pii: PiiProtection, tenantId: string, field: string, row: Record<string, any>, prefix: string): string | null {
  if (!row[`${prefix}_ciphertext`]) return null;
  return pii.reveal(tenantId, field, { ciphertext: row[`${prefix}_ciphertext`], nonce: row[`${prefix}_nonce`],
    authTag: row[`${prefix}_auth_tag`], keyId: row[`${prefix}_key_id`] });
}

async function uniqueCustomerByPhone(client: pg.PoolClient, pii: PiiProtection, tenantId: string, phone: string) {
  const normalized = normalizeE164Phone(phone);
  const digests = pii.lookupDigests(tenantId, 'customer.phone', normalized).map((item) => item.digest);
  const found = await client.query('SELECT * FROM customers WHERE tenant_id=$1 AND phone_lookup_digest=ANY($2::text[])', [tenantId, digests]);
  return found.rows;
}

async function assertMutationIdentity(client: pg.PoolClient, pii: PiiProtection, context: Context,
  evidence: z.infer<typeof identityEvidence>, appointmentCustomerId: string | null) {
  const matches = await uniqueCustomerByPhone(client, pii, context.tenantId, evidence.phone);
  if (matches.length !== 1 || matches[0].id !== evidence.customerId || appointmentCustomerId !== evidence.customerId) {
    throw new Error('IDENTITY_INSUFFICIENT');
  }
}

async function ensureCase(client: pg.PoolClient, context: Context, providerCallId: string) {
  let call = await client.query<{ conversation_id: string }>(
    "SELECT conversation_id FROM calls WHERE tenant_id=$1 AND provider='elevenlabs' AND provider_call_id=$2", [context.tenantId, providerCallId]);
  if (!call.rowCount) {
    const conversationId = randomUUID();
    await client.query('INSERT INTO conversations(id,tenant_id,workshop_id) VALUES($1,$2,$3)', [conversationId, context.tenantId, context.workshopId]);
    call = await client.query("INSERT INTO calls(tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,'elevenlabs',$3,'active') RETURNING conversation_id",
      [context.tenantId, conversationId, providerCallId]);
  }
  let reception = await client.query<{ id: string }>('SELECT id FROM reception_cases WHERE tenant_id=$1 AND conversation_id=$2',
    [context.tenantId, call.rows[0].conversation_id]);
  if (!reception.rowCount) reception = await client.query(
    "INSERT INTO reception_cases(tenant_id,conversation_id,intent,status) VALUES($1,$2,'appointment_lifecycle','executing') RETURNING id",
    [context.tenantId, call.rows[0].conversation_id]);
  return reception.rows[0].id;
}

async function resolveContext(pool: pg.Pool, pii: PiiProtection, context: Context, input: z.infer<typeof resolveReceptionContextSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, input.createVehicleIfMissing ? 'domain_mutation' : 'conversation_start', 'share');
    const phone = input.callerPhone ?? input.declaredPhone;
    const customerRows = phone ? await uniqueCustomerByPhone(client, pii, context.tenantId, phone) : [];
    const customerMatch = customerRows.length === 1 ? 'unique' : customerRows.length > 1 ? 'multiple' : 'not_found';
    const customer = customerRows.length === 1 ? customerRows[0] : null;
    let vehicleRows: any[] = [];
    const normalizedPlate = input.plate ? normalizeSpanishPlate(input.plate) : null;
    if (normalizedPlate) {
      const digests = pii.lookupDigests(context.tenantId, 'vehicle.plate', normalizedPlate).map((item) => item.digest);
      vehicleRows = (await client.query('SELECT * FROM vehicles WHERE tenant_id=$1 AND plate_lookup_digest=ANY($2::text[])',
        [context.tenantId, digests])).rows;
    }
    if (!vehicleRows.length && normalizedPlate && input.createVehicleIfMissing) {
      if (!customer || customerMatch !== 'unique') throw new Error('CUSTOMER_REQUIRED_FOR_VEHICLE_CREATE');
      const vehicleId = randomUUID();
      await insertProtectedVehicle(client, pii, { id: vehicleId, tenantId: context.tenantId, plate: normalizedPlate });
      await client.query(`INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id,verification_status)
        VALUES($1,$2,$3,'verified') ON CONFLICT DO NOTHING`, [context.tenantId, customer.id, vehicleId]);
      vehicleRows = (await client.query('SELECT * FROM vehicles WHERE tenant_id=$1 AND id=$2', [context.tenantId, vehicleId])).rows;
    }
    const vehicle = vehicleRows.length === 1 ? vehicleRows[0] : null;
    let associatedCustomerIds: string[] = [];
    if (vehicle) associatedCustomerIds = (await client.query<{ customer_id: string }>(
      'SELECT customer_id FROM customer_vehicle_roles WHERE tenant_id=$1 AND vehicle_id=$2 ORDER BY customer_id LIMIT 2',
      [context.tenantId, vehicle.id])).rows.map((row) => row.customer_id);
    return {
      customer: { match: customerMatch, candidates: customerRows.slice(0, 5).map((row) => ({ id: row.id,
        displayName: reveal(pii, context.tenantId, 'customer.display_name', row, 'display_name') })) },
      vehicle: { match: vehicleRows.length === 1 ? 'unique' : vehicleRows.length > 1 ? 'multiple' : 'not_found',
        value: vehicle ? { id: vehicle.id, plate: reveal(pii, context.tenantId, 'vehicle.plate', vehicle, 'plate'),
          make: vehicle.make, model: vehicle.model, year: vehicle.year,
          associatedCustomerMatch: associatedCustomerIds.length === 1 ? 'unique' : associatedCustomerIds.length > 1 ? 'multiple' : 'not_found',
          associatedCustomerIds } : null },
      identitySufficientForMutation: Boolean(customer && associatedCustomerIds.includes(customer.id)),
    };
  });
}

async function listFuture(pool: pg.Pool, pii: PiiProtection, context: Context, input: z.infer<typeof listFutureAppointmentsSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'conversation_start', 'share');
    const result = await client.query<any>(`SELECT a.*,v.plate_ciphertext,v.plate_nonce,v.plate_auth_tag,v.plate_key_id,v.make,v.model
      FROM appointments a LEFT JOIN vehicles v ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
      WHERE a.tenant_id=$1 AND a.workshop_id=$2 AND a.status <> 'cancelled' AND a.start_at >= now()
        AND ($3::uuid IS NULL OR a.customer_id=$3) AND ($4::uuid IS NULL OR a.vehicle_id=$4)
      ORDER BY a.start_at LIMIT $5`, [context.tenantId, context.workshopId, input.customerId ?? null, input.vehicleId ?? null, input.limit]);
    return result.rows.map((row) => ({ id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id,
      vehicle: row.vehicle_id ? { plate: reveal(pii, context.tenantId, 'vehicle.plate', row, 'plate'), make: row.make, model: row.model } : null,
      startAt: row.start_at.toISOString(), endAt: row.end_at.toISOString(), status: row.status, version: row.version,
      serviceIntent: row.service_request?.intent ?? null }));
  });
}

async function cancel(pool: pg.Pool, pii: PiiProtection, context: Context, input: z.infer<typeof cancelAppointmentSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    const replay = await client.query<any>('SELECT input_jsonb FROM action_intents WHERE tenant_id=$1 AND idempotency_key=$2', [context.tenantId, input.idempotencyKey]);
    if (replay.rowCount) {
      if (replay.rows[0].input_jsonb.appointmentId !== input.appointmentId) throw new Error('IDEMPOTENCY_CONFLICT');
      const existing = await client.query<any>('SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.appointmentId]);
      return { replay: true, appointment: existing.rows[0] };
    }
    const appointment = await client.query<any>('SELECT * FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id=$3 FOR UPDATE',
      [context.tenantId, context.workshopId, input.appointmentId]);
    if (!appointment.rowCount) throw new Error('APPOINTMENT_NOT_FOUND');
    await assertMutationIdentity(client, pii, context, input.identity, appointment.rows[0].customer_id);
    if (appointment.rows[0].status === 'cancelled') throw new Error('APPOINTMENT_ALREADY_CANCELLED');
    if (appointment.rows[0].version !== input.expectedVersion) throw new Error('VERSION_CONFLICT');
    const caseId = appointment.rows[0].case_id ?? await ensureCase(client, context, input.providerCallId);
    const intent = await client.query<{ id: string }>(`INSERT INTO action_intents
      (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
      VALUES($1,$2,'cancel_appointment',$3,'executing',$4,$5) RETURNING id`,
      [context.tenantId, caseId, JSON.stringify({ appointmentId: input.appointmentId, reason: input.reason, origin: input.origin }), input.idempotencyKey, context.actor.type]);
    const updated = await client.query<any>(`UPDATE appointments SET status='cancelled',version=version+1
      WHERE tenant_id=$1 AND id=$2 AND version=$3 RETURNING *`, [context.tenantId, input.appointmentId, input.expectedVersion]);
    if (!updated.rowCount) throw new Error('VERSION_CONFLICT');
    await client.query("UPDATE action_intents SET status='succeeded' WHERE id=$1", [intent.rows[0].id]);
    await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
      VALUES($1,$2,$3,'appointment_cancelled','appointment',$4,$5,$6)`,
      [context.tenantId, context.actor.type, context.actor.id, input.appointmentId, context.correlationId, `action-intent:${intent.rows[0].id}`]);
    return { replay: false, actionIntentId: intent.rows[0].id, appointment: updated.rows[0] };
  });
}

async function reschedule(pool: pg.Pool, pii: PiiProtection, context: Context, input: z.infer<typeof rescheduleAppointmentSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,314159))", [context.workshopId]);
    const replay = await client.query<any>('SELECT input_jsonb FROM action_intents WHERE tenant_id=$1 AND idempotency_key=$2', [context.tenantId, input.idempotencyKey]);
    if (replay.rowCount) {
      if (replay.rows[0].input_jsonb.appointmentId !== input.appointmentId || replay.rows[0].input_jsonb.slotToken !== input.slotToken) throw new Error('IDEMPOTENCY_CONFLICT');
      return { replay: true, appointment: (await client.query<any>('SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.appointmentId])).rows[0] };
    }
    const appointment = await client.query<any>('SELECT * FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id=$3 FOR UPDATE',
      [context.tenantId, context.workshopId, input.appointmentId]);
    if (!appointment.rowCount || appointment.rows[0].status === 'cancelled') throw new Error('APPOINTMENT_NOT_ACTIVE');
    await assertMutationIdentity(client, pii, context, input.identity, appointment.rows[0].customer_id);
    if (appointment.rows[0].version !== input.expectedVersion) throw new Error('VERSION_CONFLICT');
    const hold = await client.query<any>(`SELECT * FROM slot_holds WHERE tenant_id=$1 AND workshop_id=$2 AND slot_token=$3
      AND expires_at>now() AND consumed_at IS NULL FOR UPDATE`, [context.tenantId, context.workshopId, input.slotToken]);
    if (!hold.rowCount) throw new Error('SLOT_NOT_AVAILABLE');
    const heldAt = await client.query<{ held_at: Date }>('SELECT held_at FROM slot_candidates WHERE tenant_id=$1 AND hold_id=$2', [context.tenantId, hold.rows[0].id]);
    if (!heldAt.rowCount || new Date(input.confirmationCapturedAt) < heldAt.rows[0].held_at) throw new Error('CONFIRMATION_BEFORE_HOLD');
    const conflict = await client.query(`SELECT 1 FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id<>$3
      AND status<>'cancelled' AND start_at<$5 AND end_at>$4 LIMIT 1`,
      [context.tenantId, context.workshopId, input.appointmentId, hold.rows[0].start_at, hold.rows[0].end_at]);
    if (conflict.rowCount) throw new Error('SLOT_NOT_AVAILABLE');
    const caseId = appointment.rows[0].case_id ?? await ensureCase(client, context, input.providerCallId);
    const intent = await client.query<{ id: string }>(`INSERT INTO action_intents
      (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
      VALUES($1,$2,'reschedule_appointment',$3,'executing',$4,$5) RETURNING id`,
      [context.tenantId, caseId, JSON.stringify({ appointmentId: input.appointmentId, slotToken: input.slotToken, origin: input.origin,
        previousStartAt: appointment.rows[0].start_at, previousEndAt: appointment.rows[0].end_at }), input.idempotencyKey, context.actor.type]);
    const updated = await client.query<any>(`UPDATE appointments SET start_at=$4,end_at=$5,version=version+1,
      confirmation_evidence_ref=$6 WHERE tenant_id=$1 AND id=$2 AND version=$3 RETURNING *`,
      [context.tenantId, input.appointmentId, input.expectedVersion, hold.rows[0].start_at, hold.rows[0].end_at, `action-intent:${intent.rows[0].id}`]);
    if (!updated.rowCount) throw new Error('VERSION_CONFLICT');
    const consumed = await client.query('UPDATE slot_holds SET consumed_at=now(),consumed_by_appointment_id=$2 WHERE id=$1 AND consumed_at IS NULL',
      [hold.rows[0].id, input.appointmentId]);
    if (!consumed.rowCount) throw new Error('SLOT_NOT_AVAILABLE');
    await client.query("UPDATE action_intents SET status='succeeded' WHERE id=$1", [intent.rows[0].id]);
    await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
      VALUES($1,$2,$3,'appointment_rescheduled','appointment',$4,$5,$6)`,
      [context.tenantId, context.actor.type, context.actor.id, input.appointmentId, context.correlationId, `action-intent:${intent.rows[0].id}`]);
    return { replay: false, actionIntentId: intent.rows[0].id, appointment: updated.rows[0] };
  });
}

function servicePrincipal(principal: any): ServicePrincipal {
  if (!principal || principal.kind !== 'service' || principal.serviceType !== 'voice_provider') throw new Error('PRINCIPAL_NOT_ALLOWED');
  return principal;
}

function safeAppointment(row: any) { return { id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id,
  startAt: row.start_at.toISOString(), endAt: row.end_at.toISOString(), status: row.status, version: row.version }; }

export function registerReceptionLifecycleTools(app: FastifyInstance, pool: pg.Pool, pii: PiiProtection) {
  const route = async (request: any, operation: string, execute: (context: Context) => Promise<any>) => {
    const principal = servicePrincipal(request.principal);
    const context = await inAuthorizedProviderTransaction(pool, { principal, provider: 'elevenlabs',
      correlationId: `elevenlabs:${request.body.providerCallId}:${operation}` }, async (_client, tenantContext) => tenantContext);
    return execute(context as Context);
  };
  app.post('/v1/providers/elevenlabs/tools/resolve-reception-context', { config: { auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } } },
    async (request) => { const input = resolveReceptionContextSchema.parse(request.body); return route(request, 'resolve-context', async (context) =>
      ({ ok: true, code: 'RECEPTION_CONTEXT_RESOLVED', context: await resolveContext(pool, pii, context, input) })); });
  app.post('/v1/providers/elevenlabs/tools/list-future-appointments', { config: { auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } } },
    async (request) => { const input = listFutureAppointmentsSchema.parse(request.body); return route(request, 'list-appointments', async (context) =>
      ({ ok: true, code: 'FUTURE_APPOINTMENTS_LISTED', appointments: await listFuture(pool, pii, context, input) })); });
  app.post('/v1/providers/elevenlabs/tools/cancel-appointment', { config: { auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } } },
    async (request, reply) => { const input = cancelAppointmentSchema.parse(request.body); try { return await route(request, 'cancel-appointment', async (context) => {
      const result = await cancel(pool, pii, context, input); return { ok: true, code: result.replay ? 'APPOINTMENT_ALREADY_CANCELLED' : 'APPOINTMENT_CANCELLED',
        receipt: { outcome: 'succeeded', idempotencyKey: input.idempotencyKey, evidenceRef: `postgres:appointment:${input.appointmentId}`,
          value: safeAppointment(result.appointment) } }; }); } catch (error) { const code = (error as Error).message;
      const escalation = ['IDENTITY_INSUFFICIENT','APPOINTMENT_NOT_FOUND'].includes(code);
      return reply.code(['VERSION_CONFLICT','APPOINTMENT_ALREADY_CANCELLED','IDEMPOTENCY_CONFLICT'].includes(code) ? 409 : 403)
        .send({ ok: false, code: escalation ? 'HUMAN_ESCALATION_REQUIRED' : code, reason: code, originalAppointmentIntact: true }); } });
  app.post('/v1/providers/elevenlabs/tools/reschedule-appointment', { config: { auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } } },
    async (request, reply) => { const input = rescheduleAppointmentSchema.parse(request.body); try { return await route(request, 'reschedule-appointment', async (context) => {
      const result = await reschedule(pool, pii, context, input); return { ok: true, code: 'APPOINTMENT_RESCHEDULED', replay: result.replay,
        receipt: { outcome: 'succeeded', idempotencyKey: input.idempotencyKey, evidenceRef: `postgres:appointment:${input.appointmentId}`,
          value: safeAppointment(result.appointment) } }; }); } catch (error) { const code = (error as Error).message;
      const escalation = ['IDENTITY_INSUFFICIENT','APPOINTMENT_NOT_ACTIVE','CONFIRMATION_BEFORE_HOLD'].includes(code);
      return reply.code(code === 'VERSION_CONFLICT' || code === 'IDEMPOTENCY_CONFLICT' ? 409 : 422).send({ ok: false,
        code: escalation ? 'HUMAN_ESCALATION_REQUIRED' : code, reason: code, originalAppointmentIntact: true }); } });
}
