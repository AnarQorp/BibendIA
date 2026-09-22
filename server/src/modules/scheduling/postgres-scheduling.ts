import type pg from 'pg';
import type { TenantContext } from '../../domain/ids.js';
import type { ActionReceipt } from '../../domain/receipt.js';
import type { Appointment } from './model.js';
import { randomUUID } from 'node:crypto';
import type { CreateAppointmentCommand, FindSlotsQuery } from '../../ports/scheduling.js';
import { inTenantTransaction } from '../../persistence/pool.js';
import { assertTenantOperation } from '../tenant-control/tenant-control.js';
import type { PiiProtection } from '../../security/pii-protection.js';

const CANDIDATE_TTL_SECONDS = 10 * 60;
const MAX_WINDOW_DAYS = 31;
const SLOT_INCREMENT_MINUTES = 15;

type SlotRow = {
  token: string;
  workshop_id: string;
  start_at: Date;
  end_at: Date;
  capacity_requirements: unknown;
  expires_at: Date;
};

function toSlot(row: SlotRow): import('./model.js').AppointmentSlot {
  return {
    token: row.token,
    workshopId: row.workshop_id as import('../../domain/ids.js').WorkshopId,
    startAt: row.start_at.toISOString(),
    endAt: row.end_at.toISOString(),
    capacity: row.capacity_requirements as import('./model.js').CapacityRequirement[],
    expiresAt: row.expires_at.toISOString(),
  };
}

function parseInstant(value: string, code: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(code);
  return parsed;
}

async function lockWorkshop(client: pg.PoolClient, workshopId: string) {
  // A workshop-wide transaction lock is intentionally conservative for the pilot. It provides
  // cross-process serialization without claiming advanced per-resource capacity semantics.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 314159))", [workshopId]);
}

export async function findSlots(
  pool: pg.Pool,
  context: TenantContext,
  query: FindSlotsQuery,
): Promise<import('./model.js').AppointmentSlot[]> {
  const from = parseInstant(query.window.from, 'INVALID_SLOT_WINDOW');
  const to = parseInstant(query.window.to, 'INVALID_SLOT_WINDOW');
  const duration = query.serviceRequest.estimatedDurationMinutes;
  const limit = query.limit ?? 5;
  if (from.getTime() < Date.now() || to <= from || to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) {
    throw new Error('INVALID_SLOT_WINDOW');
  }
  if (!Number.isInteger(duration) || duration < 15 || duration > 480 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error('INVALID_SLOT_QUERY');
  }

  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    const workshop = await client.query<{ timezone: string; opening_hours: unknown }>(
      'SELECT timezone,opening_hours FROM workshops WHERE tenant_id=$1 AND id=$2',
      [context.tenantId, context.workshopId],
    );
    if (workshop.rowCount !== 1) throw new Error('WORKSHOP_NOT_FOUND');

    // A candidate is only a short-lived offer. Once its linked hold expires or is consumed it
    // may be offered again, but only after availability is recalculated below.
    await client.query(
      `UPDATE slot_candidates c SET held_at=NULL,hold_id=NULL
       WHERE c.tenant_id=$1 AND c.workshop_id=$2 AND c.hold_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM slot_holds h WHERE h.id=c.hold_id AND h.expires_at > now() AND h.consumed_at IS NULL
         )`,
      [context.tenantId, context.workshopId],
    );

    const candidates = await client.query<{ start_at: Date; end_at: Date }>(
      `WITH generated AS (
         SELECT s AS start_at, s + ($4::int * interval '1 minute') AS end_at
         FROM generate_series($2::timestamptz,$3::timestamptz - ($4::int * interval '1 minute'),
           $5::int * interval '1 minute') s
       )
       SELECT g.start_at,g.end_at
       FROM generated g
       WHERE EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(
           $6::jsonb -> (extract(isodow FROM g.start_at AT TIME ZONE $7)::int)::text,'[]'::jsonb
         )) hours
         WHERE (g.start_at AT TIME ZONE $7)::time >= (hours->>'start')::time
           AND (g.end_at AT TIME ZONE $7)::time <= (hours->>'end')::time
           AND (g.start_at AT TIME ZONE $7)::date = (g.end_at AT TIME ZONE $7)::date
       )
       AND NOT EXISTS (
         SELECT 1 FROM appointments a
         WHERE a.tenant_id=$1 AND a.workshop_id=$8 AND a.status <> 'cancelled'
           AND a.start_at < g.end_at AND a.end_at > g.start_at
       )
       AND NOT EXISTS (
         SELECT 1 FROM slot_holds h
         WHERE h.tenant_id=$1 AND h.workshop_id=$8 AND h.expires_at > now() AND h.consumed_at IS NULL
           AND h.start_at < g.end_at AND h.end_at > g.start_at
       )
       ORDER BY g.start_at
       LIMIT $9`,
      [context.tenantId, from.toISOString(), to.toISOString(), duration, SLOT_INCREMENT_MINUTES,
        JSON.stringify(workshop.rows[0].opening_hours), workshop.rows[0].timezone, context.workshopId, limit],
    );

    const slots: import('./model.js').AppointmentSlot[] = [];
    for (const candidate of candidates.rows) {
      const token = randomUUID();
      const inserted = await client.query<SlotRow>(
        `INSERT INTO slot_candidates
          (tenant_id,workshop_id,candidate_token,start_at,end_at,duration_minutes,capacity_requirements,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,now()+($8::int * interval '1 second'))
         ON CONFLICT (tenant_id,workshop_id,start_at,end_at,duration_minutes) DO UPDATE
           SET candidate_token=CASE
                 WHEN slot_candidates.held_at IS NULL OR slot_candidates.expires_at <= now() THEN EXCLUDED.candidate_token
                 ELSE slot_candidates.candidate_token END,
               capacity_requirements=EXCLUDED.capacity_requirements,
               expires_at=CASE
                 WHEN slot_candidates.held_at IS NULL OR slot_candidates.expires_at <= now() THEN EXCLUDED.expires_at
                 ELSE slot_candidates.expires_at END,
               held_at=CASE WHEN slot_candidates.expires_at <= now() THEN NULL ELSE slot_candidates.held_at END,
               hold_id=CASE WHEN slot_candidates.expires_at <= now() THEN NULL ELSE slot_candidates.hold_id END
         RETURNING candidate_token token,workshop_id,start_at,end_at,capacity_requirements,expires_at`,
        [context.tenantId, context.workshopId, token, candidate.start_at, candidate.end_at, duration,
          JSON.stringify(query.serviceRequest.capacityRequirements), CANDIDATE_TTL_SECONDS],
      );
      slots.push(toSlot(inserted.rows[0]));
    }
    return slots;
  });
}

export async function holdSlot(
  pool: pg.Pool,
  context: TenantContext,
  candidateToken: string,
  ttlSeconds: number,
): Promise<import('./model.js').AppointmentSlot> {
  if (!candidateToken || !Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 15 * 60) {
    throw new Error('INVALID_SLOT_HOLD');
  }
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    await lockWorkshop(client, context.workshopId);
    const candidate = await client.query<{
      id: string; workshop_id: string; start_at: Date; end_at: Date; capacity_requirements: unknown;
      expires_at: Date; held_at: Date | null; hold_id: string | null;
    }>(
      `SELECT id,workshop_id,start_at,end_at,capacity_requirements,expires_at,held_at,hold_id
       FROM slot_candidates
       WHERE tenant_id=$1 AND workshop_id=$2 AND candidate_token=$3 AND expires_at > now()
       FOR UPDATE`,
      [context.tenantId, context.workshopId, candidateToken],
    );
    if (candidate.rowCount !== 1) throw new Error('SLOT_CANDIDATE_NOT_AVAILABLE');
    const selected = candidate.rows[0];
    if (selected.held_at && selected.hold_id) {
      const replay = await client.query<SlotRow>(
        `SELECT slot_token token,workshop_id,start_at,end_at,capacity_requirements,expires_at
         FROM slot_holds WHERE tenant_id=$1 AND id=$2 AND expires_at > now() AND consumed_at IS NULL`,
        [context.tenantId, selected.hold_id],
      );
      if (replay.rowCount === 1) return toSlot(replay.rows[0]);
      // An expired hold releases the interval. Reusing the still-valid candidate is safe only
      // after the workshop lock and a fresh conflict check below.
      await client.query('UPDATE slot_candidates SET held_at=NULL,hold_id=NULL WHERE id=$1', [selected.id]);
    }
    const conflict = await client.query(
      `SELECT 1 FROM appointments
         WHERE tenant_id=$1 AND workshop_id=$2 AND status <> 'cancelled' AND start_at < $4 AND end_at > $3
       UNION ALL
       SELECT 1 FROM slot_holds
         WHERE tenant_id=$1 AND workshop_id=$2 AND expires_at > now() AND consumed_at IS NULL
           AND start_at < $4 AND end_at > $3
       LIMIT 1`,
      [context.tenantId, context.workshopId, selected.start_at, selected.end_at],
    );
    if (conflict.rowCount) throw new Error('SLOT_NOT_AVAILABLE');
    const holdToken = randomUUID();
    const hold = await client.query<SlotRow & { id: string }>(
      `INSERT INTO slot_holds
        (tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,now()+($7::int * interval '1 second'))
       RETURNING id,slot_token token,workshop_id,start_at,end_at,capacity_requirements,expires_at`,
      [context.tenantId, context.workshopId, holdToken, selected.start_at, selected.end_at,
        JSON.stringify(selected.capacity_requirements), ttlSeconds],
    );
    await client.query('UPDATE slot_candidates SET held_at=now(),hold_id=$2 WHERE id=$1', [selected.id, hold.rows[0].id]);
    return toSlot(hold.rows[0]);
  });
}

interface AppointmentRow {
  id: string; tenant_id: string; workshop_id: string; case_id: string; customer_id: string; vehicle_id: string;
  service_request: Omit<Appointment['serviceRequest'], 'symptoms' | 'notes'>;
  sensitive_details_ciphertext: Buffer; sensitive_details_nonce: Buffer; sensitive_details_auth_tag: Buffer;
  sensitive_details_key_id: string; start_at: Date; end_at: Date; status: Appointment['status'];
  confirmation_evidence_ref: string; version: number;
}

function toAppointment(row: AppointmentRow, pii: PiiProtection): Appointment {
  const sensitive = JSON.parse(pii.reveal(row.tenant_id, 'appointment.sensitive_details', {
    ciphertext: row.sensitive_details_ciphertext, nonce: row.sensitive_details_nonce,
    authTag: row.sensitive_details_auth_tag, keyId: row.sensitive_details_key_id,
  })) as { symptoms: string[]; notes?: string };
  return {
    id: row.id as Appointment['id'], tenantId: row.tenant_id as Appointment['tenantId'], workshopId: row.workshop_id as Appointment['workshopId'],
    caseId: row.case_id as Appointment['caseId'], customerId: row.customer_id, vehicleId: row.vehicle_id,
    serviceRequest: { ...row.service_request, symptoms: sensitive.symptoms, notes: sensitive.notes },
    startAt: row.start_at.toISOString(), endAt: row.end_at.toISOString(),
    status: row.status, confirmationEvidenceRef: row.confirmation_evidence_ref, version: row.version,
  };
}

export async function createAppointmentTransactional(
  pool: pg.Pool,
  context: TenantContext,
  command: CreateAppointmentCommand,
  pii: PiiProtection,
): Promise<ActionReceipt<Appointment>> {
  return inTenantTransaction(pool, context.tenantId, async (client) => {
    // The shared tenant advisory lock linearizes this mutation against control updates.
    await assertTenantOperation(client, context.tenantId, 'domain_mutation', 'share');
    await lockWorkshop(client, context.workshopId);

    // Idempotent replay remains valid after the hold has been consumed. The existing durable
    // appointment is the authority; a consumed/expired token must never create a second row.
    const replay = await client.query<AppointmentRow>(
      'SELECT * FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2',
      [context.tenantId, command.idempotencyKey],
    );
    if (replay.rowCount === 1) {
      return {
        outcome: 'succeeded', actionIntentId: 'existing', idempotencyKey: command.idempotencyKey,
        occurredAt: new Date().toISOString(), evidenceRef: `postgres:appointment:${replay.rows[0].id}`,
        value: toAppointment(replay.rows[0], pii),
      };
    }

    const hold = await client.query<{ id: string; start_at: Date; end_at: Date; capacity_requirements: unknown }>(
      `SELECT id,start_at,end_at,capacity_requirements FROM slot_holds
       WHERE tenant_id=$1 AND workshop_id=$2 AND slot_token=$3 AND expires_at > now() AND consumed_at IS NULL
         AND end_at-start_at = ($4::int * interval '1 minute')
         AND capacity_requirements = $5::jsonb
       FOR UPDATE`,
      [context.tenantId, context.workshopId, command.slotToken,
        command.serviceRequest.estimatedDurationMinutes, JSON.stringify(command.serviceRequest.capacityRequirements)],
    );
    if (hold.rowCount !== 1) throw new Error('SLOT_NOT_AVAILABLE');
    const overlap = await client.query(
      `SELECT 1 FROM appointments WHERE tenant_id=$1 AND workshop_id=$2 AND status <> 'cancelled'
       AND start_at < $4 AND end_at > $3 LIMIT 1`,
      [context.tenantId, context.workshopId, hold.rows[0].start_at, hold.rows[0].end_at],
    );
    if (overlap.rowCount) throw new Error('SLOT_NOT_AVAILABLE');

    const intent = await client.query<{ id: string }>(
      `INSERT INTO action_intents (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
       VALUES ($1,$2,'create_appointment',$3,'executing',$4,$5)
       ON CONFLICT (tenant_id,idempotency_key) DO NOTHING RETURNING id`,
      [context.tenantId, command.caseId, JSON.stringify({
        caseId: command.caseId, customerId: command.customerId, vehicleId: command.vehicleId, slotToken: command.slotToken,
      }), command.idempotencyKey, context.actor.type],
    );

    if (intent.rowCount === 0) throw new Error('IDEMPOTENCY_IN_PROGRESS');

    const request = command.serviceRequest;
    const protectedDetails = pii.protect(context.tenantId, 'appointment.sensitive_details', JSON.stringify({
      symptoms: request.symptoms, ...(request.notes ? { notes: request.notes } : {}),
    }));
    const inserted = await client.query<AppointmentRow>(
      `INSERT INTO appointments
       (tenant_id,workshop_id,case_id,customer_id,vehicle_id,service_request,symptoms,notes,
        sensitive_details_ciphertext,sensitive_details_nonce,sensitive_details_auth_tag,sensitive_details_key_id,pii_migration_state,
        estimated_duration_minutes,capacity_requirements,start_at,end_at,confirmation_evidence_ref,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,'{}',NULL,$7,$8,$9,$10,'protected',$11,$12,$13,$14,$15,$16) RETURNING *`,
      [context.tenantId, context.workshopId, command.caseId, command.customerId, command.vehicleId,
       JSON.stringify({ intent: request.intent, estimatedDurationMinutes: request.estimatedDurationMinutes,
         capacityRequirements: request.capacityRequirements }),
       protectedDetails.ciphertext, protectedDetails.nonce, protectedDetails.authTag, protectedDetails.keyId,
       request.estimatedDurationMinutes, JSON.stringify(request.capacityRequirements), hold.rows[0].start_at,
       hold.rows[0].end_at, command.confirmationEvidenceRef, command.idempotencyKey],
    );
    const appointment = toAppointment(inserted.rows[0], pii);
    const consumed = await client.query(
      `UPDATE slot_holds SET consumed_at=now(),consumed_by_appointment_id=$2
       WHERE id=$1 AND consumed_at IS NULL`,
      [hold.rows[0].id, appointment.id],
    );
    if (consumed.rowCount !== 1) throw new Error('SLOT_NOT_AVAILABLE');
    await client.query("UPDATE action_intents SET status='succeeded' WHERE id=$1", [intent.rows[0].id]);
    await client.query(
      `INSERT INTO audit_events (tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
       VALUES ($1,$2,$3,'appointment_created','appointment',$4,$5,$6)`,
      [context.tenantId, context.actor.type, context.actor.id, appointment.id, context.correlationId, command.confirmationEvidenceRef],
    );
    await client.query(
      `INSERT INTO outbox_events (tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb,external_idempotency_key,correlation_id)
       VALUES ($1,'appointment',$2,'appointment.created',$3,$4,$5)`,
      [context.tenantId, appointment.id, JSON.stringify({ appointmentId: appointment.id }), `appointment.created:${appointment.id}`, context.correlationId],
    );
    return {
      outcome: 'succeeded', actionIntentId: intent.rows[0].id, idempotencyKey: command.idempotencyKey,
      occurredAt: new Date().toISOString(), evidenceRef: `postgres:appointment:${appointment.id}`, value: appointment,
    };
  });
}
