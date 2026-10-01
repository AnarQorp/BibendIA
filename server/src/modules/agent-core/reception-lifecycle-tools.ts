import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type pg from 'pg';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { inTenantTransaction } from '../../persistence/pool.js';
import { claimInboxEvent, inAuthorizedProviderTransaction, ProviderAuthorizationError } from '../../auth/provider-authorization.js';
import type { ServicePrincipal } from '../../auth/principal.js';
import type { PiiProtection } from '../../security/pii-protection.js';
import { normalizeE164Phone, normalizeSpanishPlate, PiiProtectionError } from '../../security/pii-protection.js';
import { insertProtectedVehicle } from '../../security/protected-records.js';
import { safeErrorAttributes } from '../../security/safe-logging.js';
import { assertTenantOperation, TenantControlError } from '../tenant-control/tenant-control.js';
import { loadProviderCapability, ProviderCapabilityError } from './provider-capabilities.js';
import type { TenantContext } from '../../domain/ids.js';

const base = z.object({
  providerConversationId: z.string().min(1).max(200),
  requestId: z.string().min(8).max(200),
});

export const resolveReceptionContextSchema = base.extend({
  providerCallerPhone: z.string().min(7).max(30).optional(),
  declaredPhone: z.string().min(7).max(30).optional(),
  customerName: z.string().trim().min(2).max(200).optional(),
  plate: z.string().min(4).max(20).optional(),
  createVehicleIfMissing: z.boolean().default(false),
}).strict();

export const listFutureAppointmentsSchema = base.extend({
  receptionContextToken: z.string().uuid(),
  limit: z.number().int().min(1).max(10).default(5),
}).strict();

export const cancelAppointmentSchema = base.extend({
  receptionContextToken: z.string().uuid(), appointmentId: z.string().uuid(),
  expectedVersion: z.number().int().positive(), reason: z.string().trim().min(3).max(500),
  origin: z.literal('voice_phone'), confirmationTranscript: z.string().trim().min(1).max(1000),
  idempotencyKey: z.string().min(8).max(200),
}).strict();

export const prepareRescheduleSchema = base.extend({
  receptionContextToken: z.string().uuid(), appointmentId: z.string().uuid(),
  expectedVersion: z.number().int().positive(), slotToken: z.string().uuid(),
}).strict();

export const rescheduleAppointmentSchema = base.extend({
  rescheduleContextToken: z.string().uuid(), origin: z.literal('voice_phone'),
  confirmationEvidenceRef: z.string().trim().min(8).max(500),
  idempotencyKey: z.string().min(8).max(200),
}).strict();

type Context = { tenantId: string; workshopId: string; actor: { type: string; id: string }; correlationId: string };
type CanonicalContext = {
  token: string; caseId: string; conversationId: string; providerConversationId: string;
  tenantId: string; workshopId: string; servicePrincipalId: string; provider: 'elevenlabs'; callerEvidenceFingerprint: string;
  customerId: string; vehicleId: string; relationshipVerification: 'verified' | 'provisional';
  callerAssurance: 'provider_supplied'; expiresAt: string;
};

export type ConfirmationEvidenceVerifier = { verify(input: { evidenceRef: string; tenantId: string; workshopId: string;
  servicePrincipalId: string; provider: 'elevenlabs'; providerConversationId: string; preparationToken: string;
  preparedAt: string }): Promise<{ verified: true; occurredAt: string; source: string }> };

export class ReceptionLifecycleError extends Error {
  constructor(readonly code: string) { super(code); }
}

const fail = (code: string): never => { throw new ReceptionLifecycleError(code); };

function reveal(pii: PiiProtection, tenantId: string, field: string, row: Record<string, unknown>, prefix: string): string | null {
  if (!row[`${prefix}_ciphertext`]) return null;
  return pii.reveal(tenantId, field, {
    ciphertext: row[`${prefix}_ciphertext`] as Buffer, nonce: row[`${prefix}_nonce`] as Buffer,
    authTag: row[`${prefix}_auth_tag`] as Buffer, keyId: row[`${prefix}_key_id`] as string,
  });
}

async function uniqueCustomerByPhone(client: pg.PoolClient, pii: PiiProtection, tenantId: string, phone: string) {
  const digests = pii.lookupDigests(tenantId, 'customer.phone', normalizeE164Phone(phone)).map((item) => item.digest);
  return (await client.query<Record<string, unknown>>(
    'SELECT * FROM customers WHERE tenant_id=$1 AND phone_lookup_digest=ANY($2::text[])', [tenantId, digests],
  )).rows;
}

async function ensureCase(client: pg.PoolClient, context: Context, providerConversationId: string) {
  let call = await client.query<{ conversation_id: string }>(
    "SELECT conversation_id FROM calls WHERE tenant_id=$1 AND provider='elevenlabs' AND provider_call_id=$2",
    [context.tenantId, providerConversationId],
  );
  if (!call.rowCount) {
    const conversationId = randomUUID();
    await client.query('INSERT INTO conversations(id,tenant_id,workshop_id) VALUES($1,$2,$3)',
      [conversationId, context.tenantId, context.workshopId]);
    call = await client.query<{ conversation_id: string }>(
      "INSERT INTO calls(tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,'elevenlabs',$3,'active') RETURNING conversation_id",
      [context.tenantId, conversationId, providerConversationId],
    );
  }
  let reception = await client.query<{ id: string }>(
    'SELECT id FROM reception_cases WHERE tenant_id=$1 AND conversation_id=$2',
    [context.tenantId, call.rows[0].conversation_id],
  );
  if (!reception.rowCount) reception = await client.query<{ id: string }>(
    "INSERT INTO reception_cases(tenant_id,conversation_id,intent,status) VALUES($1,$2,'appointment_lifecycle','executing') RETURNING id",
    [context.tenantId, call.rows[0].conversation_id],
  );
  return { caseId: reception.rows[0].id, conversationId: call.rows[0].conversation_id };
}

async function loadCanonicalContext(client: pg.PoolClient, context: Context, token: string,
  providerConversationId: string, allowConsumedCancel = false): Promise<CanonicalContext> {
  const found = await client.query<{ case_id: string; input_jsonb: CanonicalContext; conversation_id: string }>(
    `SELECT ai.case_id,ai.input_jsonb,rc.conversation_id
     FROM action_intents ai JOIN reception_cases rc ON rc.tenant_id=ai.tenant_id AND rc.id=ai.case_id
     WHERE ai.tenant_id=$1 AND ai.tool_name='reception_context_v2' AND ai.idempotency_key=$2
       AND (ai.status='ready' OR ($3::boolean AND ai.status='consumed_cancel'))
     FOR UPDATE OF ai`,
    [context.tenantId, `reception-context:${token}`, allowConsumedCancel],
  );
  if (found.rowCount !== 1) fail('RECEPTION_CONTEXT_INVALID');
  const value = found.rows[0].input_jsonb;
  if (value.tenantId !== context.tenantId || value.workshopId !== context.workshopId
    || value.servicePrincipalId !== context.actor.id || value.provider !== 'elevenlabs') fail('RECEPTION_CONTEXT_BINDING_MISMATCH');
  if (value.providerConversationId !== providerConversationId || value.conversationId !== found.rows[0].conversation_id) {
    fail('RECEPTION_CONTEXT_CONVERSATION_MISMATCH');
  }
  if (value.callerAssurance !== 'provider_supplied') fail('IDENTITY_INSUFFICIENT');
  if (Date.parse(value.expiresAt) <= Date.now()) fail('RECEPTION_CONTEXT_EXPIRED');
  return value;
}

export async function resolveCanonicalReceptionContext(pool: pg.Pool, pii: PiiProtection, context: Context,
  token: string, providerConversationId: string) {
  return inTenantTransaction(pool, context.tenantId,
    (client) => loadCanonicalContext(client, context, token, providerConversationId));
}

async function resolveContext(pool: pg.Pool, pii: PiiProtection, context: Context,
  input: z.infer<typeof resolveReceptionContextSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, input.createVehicleIfMissing ? 'domain_mutation' : 'conversation_start', 'share');
    const phone = input.providerCallerPhone ?? input.declaredPhone;
    const customerRows = phone ? await uniqueCustomerByPhone(client, pii, context.tenantId, phone) : [];
    const customerMatch = customerRows.length === 1 ? 'unique' : customerRows.length > 1 ? 'multiple' : 'not_found';
    const customer = customerRows.length === 1 ? customerRows[0] : null;
    let vehicleRows: Record<string, unknown>[] = [];
    const normalizedPlate = input.plate ? normalizeSpanishPlate(input.plate) : null;
    if (normalizedPlate) {
      const digests = pii.lookupDigests(context.tenantId, 'vehicle.plate', normalizedPlate).map((item) => item.digest);
      vehicleRows = (await client.query<Record<string, unknown>>(
        'SELECT * FROM vehicles WHERE tenant_id=$1 AND plate_lookup_digest=ANY($2::text[])',
        [context.tenantId, digests],
      )).rows;
    }
    if (!vehicleRows.length && normalizedPlate && input.createVehicleIfMissing) {
      if (!input.providerCallerPhone || !customer || customerMatch !== 'unique') fail('CUSTOMER_REQUIRED_FOR_VEHICLE_CREATE');
      const vehicleId = randomUUID();
      await insertProtectedVehicle(client, pii, { id: vehicleId, tenantId: context.tenantId, plate: normalizedPlate });
      await client.query(`INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id,verification_status)
        VALUES($1,$2,$3,'provisional') ON CONFLICT DO NOTHING`, [context.tenantId, customer!.id, vehicleId]);
      vehicleRows = (await client.query<Record<string, unknown>>(
        'SELECT * FROM vehicles WHERE tenant_id=$1 AND id=$2', [context.tenantId, vehicleId],
      )).rows;
    }
    const vehicle = vehicleRows.length === 1 ? vehicleRows[0] : null;
    const associations = vehicle ? (await client.query<{ customer_id: string; verification_status: 'verified' | 'provisional' }>(
      `SELECT customer_id,verification_status FROM customer_vehicle_roles
       WHERE tenant_id=$1 AND vehicle_id=$2 ORDER BY customer_id LIMIT 5`, [context.tenantId, vehicle.id],
    )).rows : [];
    const matchingAssociation = customer ? associations.find((row) => row.customer_id === customer.id) : undefined;
    const providerIdentitySufficient = Boolean(input.providerCallerPhone && customer && vehicle && matchingAssociation);
    const { caseId, conversationId } = await ensureCase(client, context, input.providerConversationId);
    let receptionContextToken: string | null = null;
    let expiresAt: string | null = null;
    if (providerIdentitySufficient && customer && vehicle && matchingAssociation) {
      receptionContextToken = randomUUID();
      expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const value: CanonicalContext = {
        token: receptionContextToken, caseId, conversationId, providerConversationId: input.providerConversationId,
        tenantId: context.tenantId, workshopId: context.workshopId, servicePrincipalId: context.actor.id, provider: 'elevenlabs',
        callerEvidenceFingerprint: pii.lookupDigests(context.tenantId, 'customer.phone', normalizeE164Phone(input.providerCallerPhone!))[0].digest,
        customerId: customer.id as string, vehicleId: vehicle.id as string,
        relationshipVerification: matchingAssociation.verification_status,
        callerAssurance: 'provider_supplied', expiresAt,
      };
      await client.query(`INSERT INTO action_intents
        (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
        VALUES($1,$2,'reception_context_v2',$3,'ready',$4,$5)`,
      [context.tenantId, caseId, JSON.stringify(value), `reception-context:${receptionContextToken}`, context.actor.type]);
      await client.query('UPDATE reception_cases SET customer_id=$1,vehicle_id=$2 WHERE tenant_id=$3 AND id=$4',
        [customer.id, vehicle.id, context.tenantId, caseId]);
    }
    return {
      customer: { match: customerMatch, candidates: customerRows.slice(0, 5).map((row) => ({
        id: row.id, displayName: reveal(pii, context.tenantId, 'customer.display_name', row, 'display_name'),
      })) },
      vehicle: { match: vehicleRows.length === 1 ? 'unique' : vehicleRows.length > 1 ? 'multiple' : 'not_found',
        value: vehicle ? { id: vehicle.id, plate: reveal(pii, context.tenantId, 'vehicle.plate', vehicle, 'plate'),
          make: vehicle.make, model: vehicle.model, year: vehicle.year,
          associatedCustomers: associations.map((row) => ({ id: row.customer_id, verificationStatus: row.verification_status })) } : null },
      identitySufficientForMutation: providerIdentitySufficient,
      callerAssurance: input.providerCallerPhone ? 'provider_supplied_not_kyc' : input.declaredPhone ? 'declared_untrusted' : 'none',
      receptionContextToken, expiresAt,
    };
  });
}

async function listFuture(pool: pg.Pool, pii: PiiProtection, context: Context,
  input: z.infer<typeof listFutureAppointmentsSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'conversation_start', 'share');
    const canonical = await loadCanonicalContext(client, context, input.receptionContextToken, input.providerConversationId);
    const result = await client.query<Record<string, unknown>>(`SELECT a.*,v.plate_ciphertext,v.plate_nonce,v.plate_auth_tag,v.plate_key_id,v.make,v.model
      FROM appointments a LEFT JOIN vehicles v ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
      WHERE a.tenant_id=$1 AND a.workshop_id=$2 AND a.status <> 'cancelled' AND a.start_at >= now()
        AND a.customer_id=$3 AND a.vehicle_id=$4 ORDER BY a.start_at LIMIT $5`,
    [context.tenantId, context.workshopId, canonical.customerId, canonical.vehicleId, input.limit]);
    return result.rows.map((row) => ({ id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id,
      vehicle: { plate: reveal(pii, context.tenantId, 'vehicle.plate', row, 'plate'), make: row.make, model: row.model },
      startAt: (row.start_at as Date).toISOString(), endAt: (row.end_at as Date).toISOString(),
      status: row.status, version: row.version, serviceIntent: (row.service_request as { intent?: string })?.intent ?? null }));
  });
}

async function insertConfirmation(client: pg.PoolClient, pii: PiiProtection, context: Context,
  conversationId: string, transcript: string, kind: string, boundContextId: string) {
  const protectedMessage = pii.protect(context.tenantId, 'message.content', JSON.stringify({ text: transcript }));
  const message = await client.query<{ id: string }>(`INSERT INTO messages
    (tenant_id,conversation_id,direction,role,content_legacy_jsonb,content_metadata_jsonb,
     content_ciphertext,content_nonce,content_auth_tag,content_key_id,pii_migration_state)
    VALUES($1,$2,'inbound','customer',NULL,$3,$4,$5,$6,$7,'protected') RETURNING id`,
  [context.tenantId, conversationId, JSON.stringify({ kind, boundContextId }), protectedMessage.ciphertext,
    protectedMessage.nonce, protectedMessage.authTag, protectedMessage.keyId]);
  return message.rows[0].id;
}

async function cancel(pool: pg.Pool, pii: PiiProtection, context: Context,
  input: z.infer<typeof cancelAppointmentSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    const canonical = await loadCanonicalContext(client, context, input.receptionContextToken, input.providerConversationId, true);
    const replay = await client.query<{ input_jsonb: { appointmentId: string } }>(
      'SELECT input_jsonb FROM action_intents WHERE tenant_id=$1 AND idempotency_key=$2',
      [context.tenantId, input.idempotencyKey],
    );
    if (replay.rowCount) {
      if (replay.rows[0].input_jsonb.appointmentId !== input.appointmentId) fail('IDEMPOTENCY_CONFLICT');
      return { replay: true, appointment: (await client.query<Record<string, unknown>>(
        'SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.appointmentId])).rows[0] };
    }
    await client.query(`UPDATE action_intents SET status='expired' WHERE tenant_id=$1 AND case_id=$2
      AND tool_name='prepare_reschedule_v3' AND status='ready' AND (input_jsonb->>'expiresAt')::timestamptz<=now()`,
    [context.tenantId, canonical.caseId]);
    const activeReschedule = await client.query(`SELECT 1 FROM action_intents
      WHERE tenant_id=$1 AND case_id=$2 AND tool_name='prepare_reschedule_v3' AND status='ready'
        AND (input_jsonb->>'expiresAt')::timestamptz>now() LIMIT 1`,
    [context.tenantId, canonical.caseId]);
    if (activeReschedule.rowCount) fail('RESCHEDULE_IN_PROGRESS');
    const appointment = await client.query<Record<string, unknown>>(
      'SELECT * FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id=$3 FOR UPDATE',
      [context.tenantId, context.workshopId, input.appointmentId],
    );
    if (!appointment.rowCount) fail('APPOINTMENT_NOT_FOUND');
    const row = appointment.rows[0];
    if (row.customer_id !== canonical.customerId || row.vehicle_id !== canonical.vehicleId) fail('IDENTITY_INSUFFICIENT');
    if (row.status === 'cancelled') fail('APPOINTMENT_ALREADY_CANCELLED');
    if (row.version !== input.expectedVersion) fail('VERSION_CONFLICT');
    const confirmationId = await insertConfirmation(client, pii, context, canonical.conversationId,
      input.confirmationTranscript, 'cancel_confirmation', input.appointmentId);
    const intent = await client.query<{ id: string }>(`INSERT INTO action_intents
      (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
      VALUES($1,$2,'cancel_appointment',$3,'executing',$4,$5) RETURNING id`,
    [context.tenantId, canonical.caseId, JSON.stringify({ appointmentId: input.appointmentId, reason: input.reason,
      origin: input.origin, receptionContextToken: input.receptionContextToken }), input.idempotencyKey, context.actor.type]);
    const updated = await client.query<Record<string, unknown>>(`UPDATE appointments SET status='cancelled',version=version+1
      WHERE tenant_id=$1 AND id=$2 AND version=$3 RETURNING *`, [context.tenantId, input.appointmentId, input.expectedVersion]);
    if (!updated.rowCount) fail('VERSION_CONFLICT');
    await client.query("UPDATE action_intents SET status='succeeded' WHERE id=$1", [intent.rows[0].id]);
    await client.query("UPDATE action_intents SET status='consumed_cancel' WHERE tenant_id=$1 AND idempotency_key=$2",
      [context.tenantId, `reception-context:${input.receptionContextToken}`]);
    await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
      VALUES($1,$2,$3,'appointment_cancelled','appointment',$4,$5,$6)`,
    [context.tenantId, context.actor.type, context.actor.id, input.appointmentId, context.correlationId, `message:${confirmationId}`]);
    return { replay: false, actionIntentId: intent.rows[0].id, appointment: updated.rows[0] };
  });
}

async function prepareReschedule(pool: pg.Pool, context: Context, input: z.infer<typeof prepareRescheduleSchema>) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    const canonical = await loadCanonicalContext(client, context, input.receptionContextToken, input.providerConversationId);
    const replayKey = `prepare-reschedule:${context.actor.id}:${input.providerConversationId}:${input.requestId}`;
    const replay = await client.query<{ input_jsonb: Record<string, unknown> }>(`SELECT input_jsonb FROM action_intents
      WHERE tenant_id=$1 AND tool_name='prepare_reschedule_v3' AND idempotency_key=$2 FOR UPDATE`,
    [context.tenantId, replayKey]);
    if (replay.rowCount) return { token: replay.rows[0].input_jsonb.token as string, value: replay.rows[0].input_jsonb };
    const appointment = await client.query<Record<string, unknown>>(
      'SELECT * FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id=$3 FOR UPDATE',
      [context.tenantId, context.workshopId, input.appointmentId],
    );
    if (!appointment.rowCount || appointment.rows[0].status === 'cancelled') fail('APPOINTMENT_NOT_ACTIVE');
    if (appointment.rows[0].customer_id !== canonical.customerId || appointment.rows[0].vehicle_id !== canonical.vehicleId) fail('IDENTITY_INSUFFICIENT');
    if (appointment.rows[0].version !== input.expectedVersion) fail('VERSION_CONFLICT');
    const hold = await client.query<Record<string, unknown>>(`SELECT * FROM slot_holds
      WHERE tenant_id=$1 AND workshop_id=$2 AND slot_token=$3 AND expires_at>now() AND consumed_at IS NULL FOR UPDATE`,
    [context.tenantId, context.workshopId, input.slotToken]);
    if (!hold.rowCount) fail('SLOT_NOT_AVAILABLE');
    let holdCapability;
    try { holdCapability = await loadProviderCapability(client, context as unknown as TenantContext, input.slotToken, input.providerConversationId, 'hold-slot'); }
    catch (error) { if (error instanceof ProviderCapabilityError) fail(error.code); throw error; }
    const serviceRequest = appointment.rows[0].service_request as { intent?: string; estimatedDurationMinutes?: number; capacityRequirements?: unknown };
    const appointmentDuration = (appointment.rows[0].estimated_duration_minutes as number)
      ?? Math.round(((appointment.rows[0].end_at as Date).getTime() - (appointment.rows[0].start_at as Date).getTime()) / 60_000);
    if (hold.rows[0].service_intent !== serviceRequest.intent || holdCapability.value.serviceIntent !== serviceRequest.intent
      || hold.rows[0].duration_minutes !== appointmentDuration || holdCapability.value.durationMinutes !== appointmentDuration
      || JSON.stringify(hold.rows[0].capacity_requirements) !== JSON.stringify(appointment.rows[0].capacity_requirements)) {
      fail('RESCHEDULE_SERVICE_MISMATCH');
    }
    const token = randomUUID();
    const value = { token, appointmentId: input.appointmentId, expectedVersion: input.expectedVersion,
      slotToken: input.slotToken, providerConversationId: input.providerConversationId,
      tenantId: context.tenantId, workshopId: context.workshopId, servicePrincipalId: context.actor.id, provider: 'elevenlabs',
      receptionContextToken: input.receptionContextToken, oldStartAt: appointment.rows[0].start_at,
      oldEndAt: appointment.rows[0].end_at, newStartAt: hold.rows[0].start_at, newEndAt: hold.rows[0].end_at,
      preparedAt: new Date().toISOString(), expiresAt: hold.rows[0].expires_at };
    await client.query(`INSERT INTO action_intents
      (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
      VALUES($1,$2,'prepare_reschedule_v3',$3,'ready',$4,$5)`,
    [context.tenantId, canonical.caseId, JSON.stringify(value), replayKey, context.actor.type]);
    await client.query(`INSERT INTO action_intents(tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
      VALUES($1,$2,'reschedule_capability_v3',$3,'ready',$4,$5)`,
    [context.tenantId, canonical.caseId, JSON.stringify(value), `reschedule-context:${token}`, context.actor.type]);
    return { token, value };
  });
}

async function reschedule(pool: pg.Pool, pii: PiiProtection, context: Context,
  input: z.infer<typeof rescheduleAppointmentSchema>, confirmationVerifier?: ConfirmationEvidenceVerifier) {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,314159))", [context.workshopId]);
    const prepared = await client.query<{ case_id: string; input_jsonb: Record<string, unknown> }>(`SELECT case_id,input_jsonb FROM action_intents
      WHERE tenant_id=$1 AND tool_name='reschedule_capability_v3' AND idempotency_key=$2 FOR UPDATE`,
    [context.tenantId, `reschedule-context:${input.rescheduleContextToken}`]);
    if (prepared.rowCount !== 1) fail('RESCHEDULE_CONTEXT_INVALID');
    const value = prepared.rows[0].input_jsonb;
    if (value.tenantId !== context.tenantId || value.workshopId !== context.workshopId
      || value.servicePrincipalId !== context.actor.id || value.provider !== 'elevenlabs') fail('RESCHEDULE_CONTEXT_BINDING_MISMATCH');
    if (value.providerConversationId !== input.providerConversationId) fail('RESCHEDULE_CONTEXT_CONVERSATION_MISMATCH');
    if (new Date(value.expiresAt as string) <= new Date()) {
      await client.query("UPDATE action_intents SET status='expired' WHERE tenant_id=$1 AND idempotency_key=$2",
        [context.tenantId, `reschedule-context:${input.rescheduleContextToken}`]);
      fail('RESCHEDULE_CONTEXT_EXPIRED');
    }
    const canonical = await loadCanonicalContext(client, context, value.receptionContextToken as string, input.providerConversationId);
    const replay = await client.query<{ input_jsonb: { rescheduleContextToken: string; appointmentId: string } }>(
      "SELECT input_jsonb FROM action_intents WHERE tenant_id=$1 AND tool_name='reschedule_appointment' AND idempotency_key=$2",
      [context.tenantId, input.idempotencyKey]);
    if (replay.rowCount) {
      if (replay.rows[0].input_jsonb.rescheduleContextToken !== input.rescheduleContextToken) fail('IDEMPOTENCY_CONFLICT');
      return { replay: true, appointment: (await client.query<Record<string, unknown>>(
        'SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2', [context.tenantId, replay.rows[0].input_jsonb.appointmentId])).rows[0] };
    }
    if (!confirmationVerifier) fail('PROVIDER_CONFIRMATION_EVIDENCE_REQUIRED');
    const verifier = confirmationVerifier as ConfirmationEvidenceVerifier;
    const evidence = await verifier.verify({ evidenceRef: input.confirmationEvidenceRef,
      tenantId: context.tenantId, workshopId: context.workshopId, servicePrincipalId: context.actor.id,
      provider: 'elevenlabs', providerConversationId: input.providerConversationId,
      preparationToken: input.rescheduleContextToken, preparedAt: value.preparedAt as string });
    if (!evidence.verified || Date.parse(evidence.occurredAt) <= Date.parse(value.preparedAt as string)) fail('PROVIDER_CONFIRMATION_EVIDENCE_INVALID');
    const appointment = await client.query<Record<string, unknown>>(
      'SELECT * FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id=$3 FOR UPDATE',
      [context.tenantId, context.workshopId, value.appointmentId],
    );
    if (!appointment.rowCount || appointment.rows[0].status === 'cancelled') fail('APPOINTMENT_NOT_ACTIVE');
    if (appointment.rows[0].customer_id !== canonical.customerId || appointment.rows[0].vehicle_id !== canonical.vehicleId) fail('IDENTITY_INSUFFICIENT');
    if (appointment.rows[0].version !== value.expectedVersion) fail('VERSION_CONFLICT');
    const hold = await client.query<Record<string, unknown>>(`SELECT * FROM slot_holds WHERE tenant_id=$1 AND workshop_id=$2
      AND slot_token=$3 AND expires_at>now() AND consumed_at IS NULL FOR UPDATE`,
    [context.tenantId, context.workshopId, value.slotToken]);
    if (!hold.rowCount) fail('SLOT_NOT_AVAILABLE');
    const conflict = await client.query(`SELECT 1 FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND id<>$3
      AND status<>'cancelled' AND start_at<$5 AND end_at>$4 LIMIT 1`,
    [context.tenantId, context.workshopId, value.appointmentId, hold.rows[0].start_at, hold.rows[0].end_at]);
    if (conflict.rowCount) fail('SLOT_NOT_AVAILABLE');
    const intent = await client.query<{ id: string }>(`INSERT INTO action_intents
      (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
      VALUES($1,$2,'reschedule_appointment',$3,'executing',$4,$5) RETURNING id`,
    [context.tenantId, prepared.rows[0].case_id, JSON.stringify({ appointmentId: value.appointmentId,
      rescheduleContextToken: input.rescheduleContextToken, slotToken: value.slotToken, origin: input.origin,
      confirmationEvidenceRef: input.confirmationEvidenceRef, confirmationSource: evidence.source }),
      input.idempotencyKey, context.actor.type]);
    const updated = await client.query<Record<string, unknown>>(`UPDATE appointments SET start_at=$4,end_at=$5,version=version+1,
      confirmation_evidence_ref=$6 WHERE tenant_id=$1 AND id=$2 AND version=$3 RETURNING *`,
    [context.tenantId, value.appointmentId, value.expectedVersion, hold.rows[0].start_at, hold.rows[0].end_at, input.confirmationEvidenceRef]);
    if (!updated.rowCount) fail('VERSION_CONFLICT');
    const consumed = await client.query('UPDATE slot_holds SET consumed_at=now(),consumed_by_appointment_id=$2 WHERE id=$1 AND consumed_at IS NULL',
      [hold.rows[0].id, value.appointmentId]);
    if (!consumed.rowCount) fail('SLOT_NOT_AVAILABLE');
    await client.query("UPDATE action_intents SET status='succeeded' WHERE id=$1", [intent.rows[0].id]);
    await client.query("UPDATE action_intents SET status='consumed' WHERE tenant_id=$1 AND idempotency_key=$2",
      [context.tenantId, `reschedule-context:${input.rescheduleContextToken}`]);
    await client.query("UPDATE action_intents SET status='consumed' WHERE tenant_id=$1 AND tool_name='prepare_reschedule_v3' AND input_jsonb->>'token'=$2",
      [context.tenantId, input.rescheduleContextToken]);
    await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
      VALUES($1,$2,$3,'appointment_rescheduled','appointment',$4,$5,$6)`,
    [context.tenantId, context.actor.type, context.actor.id, value.appointmentId, context.correlationId, input.confirmationEvidenceRef]);
    return { replay: false, actionIntentId: intent.rows[0].id, appointment: updated.rows[0] };
  });
}

function servicePrincipal(principal: unknown): ServicePrincipal {
  if (!principal || typeof principal !== 'object' || !('kind' in principal)
    || principal.kind !== 'service' || !('serviceType' in principal) || principal.serviceType !== 'voice_provider') {
    throw new ProviderAuthorizationError('PROVIDER_NOT_ALLOWED');
  }
  return principal as ServicePrincipal;
}

function safeAppointment(row: Record<string, unknown>) {
  return { id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id,
    startAt: (row.start_at as Date).toISOString(), endAt: (row.end_at as Date).toISOString(),
    status: row.status, version: row.version };
}

const safeCodes = new Set([
  'RECEPTION_CONTEXT_INVALID','RECEPTION_CONTEXT_EXPIRED','RECEPTION_CONTEXT_CONVERSATION_MISMATCH',
  'RECEPTION_CONTEXT_BINDING_MISMATCH','RESCHEDULE_CONTEXT_INVALID','RESCHEDULE_CONTEXT_EXPIRED',
  'RESCHEDULE_CONTEXT_CONVERSATION_MISMATCH','RESCHEDULE_CONTEXT_BINDING_MISMATCH','IDENTITY_INSUFFICIENT',
  'APPOINTMENT_NOT_FOUND','APPOINTMENT_NOT_ACTIVE','APPOINTMENT_ALREADY_CANCELLED','VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT','SLOT_NOT_AVAILABLE','CUSTOMER_REQUIRED_FOR_VEHICLE_CREATE','RESCHEDULE_IN_PROGRESS',
  'CAPABILITY_INVALID','CAPABILITY_EXPIRED','CAPABILITY_CONSUMED','CAPABILITY_BINDING_MISMATCH',
  'RESCHEDULE_SERVICE_MISMATCH','PROVIDER_CONFIRMATION_EVIDENCE_REQUIRED','PROVIDER_CONFIRMATION_EVIDENCE_INVALID',
]);

function lifecycleFailure(request: FastifyRequest, reply: FastifyReply, error: unknown, originalAppointmentIntact = true) {
  if (error instanceof ProviderAuthorizationError || error instanceof TenantControlError || error instanceof PiiProtectionError) throw error;
  const internalCode = error instanceof ReceptionLifecycleError && safeCodes.has(error.code) ? error.code : 'LIFECYCLE_OPERATION_FAILED';
  request.log.error({ ...safeErrorAttributes(error), lifecycleCode: internalCode }, 'reception lifecycle operation failed');
  const escalation = ['IDENTITY_INSUFFICIENT','APPOINTMENT_NOT_FOUND','APPOINTMENT_NOT_ACTIVE',
    'RECEPTION_CONTEXT_INVALID','RECEPTION_CONTEXT_EXPIRED','RECEPTION_CONTEXT_CONVERSATION_MISMATCH',
    'RESCHEDULE_CONTEXT_INVALID','RESCHEDULE_CONTEXT_CONVERSATION_MISMATCH'].includes(internalCode);
  const status = ['VERSION_CONFLICT','IDEMPOTENCY_CONFLICT','APPOINTMENT_ALREADY_CANCELLED'].includes(internalCode) ? 409
    : escalation ? 403 : 422;
  return reply.code(status).send({ ok: false, code: escalation ? 'HUMAN_ESCALATION_REQUIRED' : internalCode,
    reason: internalCode, originalAppointmentIntact });
}

export function registerReceptionLifecycleTools(app: FastifyInstance, pool: pg.Pool, pii: PiiProtection,
  confirmationVerifier?: ConfirmationEvidenceVerifier) {
  const route = async (request: FastifyRequest, operation: string, execute: (context: Context) => Promise<unknown>) => {
    const principal = servicePrincipal(request.principal);
    const body = base.parse(request.body);
    const correlationId = `elevenlabs:${body.providerConversationId}:${operation}`;
    const authorized = await inAuthorizedProviderTransaction(pool, { principal, provider: 'elevenlabs', correlationId },
      async (client, tenantContext) => ({ context: tenantContext as Context, disposition: await claimInboxEvent(client, {
        context: tenantContext, principal, provider: 'elevenlabs',
        externalEventId: `tool:${operation}:${body.providerConversationId}:${body.requestId}`,
        rawBody: request.rawBody?.toString() ?? JSON.stringify(request.body),
      }) }));
    return { disposition: authorized.disposition, result: await execute(authorized.context) };
  };
  const config = { rawBody: true, auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } } as const;

  app.post('/v1/providers/elevenlabs/tools/resolve-reception-context', { config }, async (request, reply) => {
    try {
      const input = resolveReceptionContextSchema.parse(request.body);
      const output = await route(request, 'resolve-reception-context', (context) => resolveContext(pool, pii, context, input));
      return { ok: true, code: 'RECEPTION_CONTEXT_RESOLVED', disposition: output.disposition, context: output.result };
    } catch (error) { return lifecycleFailure(request, reply, error, false); }
  });
  app.post('/v1/providers/elevenlabs/tools/list-future-appointments', { config }, async (request, reply) => {
    try {
      const input = listFutureAppointmentsSchema.parse(request.body);
      const output = await route(request, 'list-future-appointments', (context) => listFuture(pool, pii, context, input));
      return { ok: true, code: 'FUTURE_APPOINTMENTS_LISTED', disposition: output.disposition, appointments: output.result };
    } catch (error) { return lifecycleFailure(request, reply, error, false); }
  });
  app.post('/v1/providers/elevenlabs/tools/cancel-appointment', { config }, async (request, reply) => {
    try {
      const input = cancelAppointmentSchema.parse(request.body);
      const output = await route(request, 'cancel-appointment', (context) => cancel(pool, pii, context, input));
      const result = output.result as Awaited<ReturnType<typeof cancel>>;
      return { ok: true, code: result.replay ? 'APPOINTMENT_ALREADY_CANCELLED' : 'APPOINTMENT_CANCELLED',
        disposition: output.disposition, receipt: { outcome: 'succeeded', idempotencyKey: input.idempotencyKey,
          evidenceRef: `postgres:appointment:${input.appointmentId}`, value: safeAppointment(result.appointment) } };
    } catch (error) { return lifecycleFailure(request, reply, error); }
  });
  app.post('/v1/providers/elevenlabs/tools/prepare-reschedule', { config }, async (request, reply) => {
    try {
      const input = prepareRescheduleSchema.parse(request.body);
      const output = await route(request, 'prepare-reschedule', (context) => prepareReschedule(pool, context, input));
      const result = output.result as Awaited<ReturnType<typeof prepareReschedule>>;
      return { ok: true, code: 'RESCHEDULE_CONFIRMATION_REQUIRED', disposition: output.disposition,
        rescheduleContextToken: result.token, original: { appointmentId: result.value.appointmentId,
          startAt: result.value.oldStartAt, endAt: result.value.oldEndAt },
        proposed: { startAt: result.value.newStartAt, endAt: result.value.newEndAt }, expiresAt: result.value.expiresAt };
    } catch (error) { return lifecycleFailure(request, reply, error); }
  });
  app.post('/v1/providers/elevenlabs/tools/reschedule-appointment', { config }, async (request, reply) => {
    try {
      const input = rescheduleAppointmentSchema.parse(request.body);
      const output = await route(request, 'reschedule-appointment', (context) => reschedule(pool, pii, context, input, confirmationVerifier));
      const result = output.result as Awaited<ReturnType<typeof reschedule>>;
      return { ok: true, code: 'APPOINTMENT_RESCHEDULED', disposition: output.disposition, replay: result.replay,
        receipt: { outcome: 'succeeded', idempotencyKey: input.idempotencyKey,
          evidenceRef: `postgres:appointment:${result.appointment.id}`, value: safeAppointment(result.appointment) } };
    } catch (error) { return lifecycleFailure(request, reply, error); }
  });
}
