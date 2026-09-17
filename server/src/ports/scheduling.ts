import type { ActionReceipt } from '../domain/receipt.js';
import type { Appointment, AppointmentSlot, ServiceRequest } from '../modules/scheduling/model.js';
import type { TenantContext } from '../domain/ids.js';

export interface FindSlotsQuery {
  serviceRequest: ServiceRequest;
  window: { from: string; to: string };
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
  holdSlot(context: TenantContext, slotToken: string, ttlSeconds: number): Promise<AppointmentSlot>;
  createAppointment(context: TenantContext, command: CreateAppointmentCommand): Promise<ActionReceipt<Appointment>>;
}
