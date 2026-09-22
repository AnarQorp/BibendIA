import type pg from 'pg';
import type { TenantContext } from '../../domain/ids.js';
import type { ActionReceipt } from '../../domain/receipt.js';
import type { Appointment } from './model.js';
import type { CreateAppointmentCommand } from '../../ports/scheduling.js';
import { inTenantTransaction } from '../../persistence/pool.js';
import { assertTenantOperation } from '../tenant-control/tenant-control.js';
import type { PiiProtection } from '../../security/pii-protection.js';

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
    const hold = await client.query<{ start_at: Date; end_at: Date }>(
      'SELECT start_at,end_at FROM slot_holds WHERE tenant_id=$1 AND slot_token=$2 AND expires_at > now() FOR UPDATE',
      [context.tenantId, command.slotToken],
    );
    if (hold.rowCount !== 1) throw new Error('SLOT_NOT_AVAILABLE');

    const intent = await client.query<{ id: string }>(
      `INSERT INTO action_intents (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
       VALUES ($1,$2,'create_appointment',$3,'executing',$4,$5)
       ON CONFLICT (tenant_id,idempotency_key) DO NOTHING RETURNING id`,
      [context.tenantId, command.caseId, JSON.stringify({
        caseId: command.caseId, customerId: command.customerId, vehicleId: command.vehicleId, slotToken: command.slotToken,
      }), command.idempotencyKey, context.actor.type],
    );

    if (intent.rowCount === 0) {
      const existing = await client.query<AppointmentRow>('SELECT * FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2', [context.tenantId, command.idempotencyKey]);
      if (existing.rowCount !== 1) throw new Error('IDEMPOTENCY_IN_PROGRESS');
      return {
        outcome: 'succeeded', actionIntentId: 'existing', idempotencyKey: command.idempotencyKey,
        occurredAt: new Date().toISOString(), evidenceRef: `postgres:appointment:${existing.rows[0].id}`, value: toAppointment(existing.rows[0], pii),
      };
    }

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
