import type { ActionReceipt } from '../domain/receipt.js';
import type { Appointment, AppointmentSlot, ServiceRequest } from '../modules/scheduling/model.js';
import type { TenantContext } from '../domain/ids.js';

export interface FindSlotsQuery {
  serviceRequest: ServiceRequest;
  window: { from: string; to: string };
  /** Pilot-safe result cap. The PostgreSQL adapter rejects values outside 1..20. */
  limit?: number;
}

export interface CreateAppointmentCommand {
  slotToken: string;
  caseId: string;
  customerId: string;
  vehicleId: string;
  serviceRequest: ServiceRequest;
  confirmationEvidenceRef: string;
  idempotencyKey: string;
}

export interface SchedulingPort {
  findSlots(context: TenantContext, query: FindSlotsQuery): Promise<AppointmentSlot[]>;
  /** Converts the opaque candidate token returned by findSlots into a single-use hold token. */
  holdSlot(context: TenantContext, candidateToken: string, ttlSeconds: number): Promise<AppointmentSlot>;
  createAppointment(context: TenantContext, command: CreateAppointmentCommand): Promise<ActionReceipt<Appointment>>;
}
