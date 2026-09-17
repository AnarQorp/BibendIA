import type { ActionReceipt } from '../domain/receipt.js';
import type { Appointment } from '../modules/scheduling/model.js';
import type { TenantContext } from '../domain/ids.js';

export interface CalendarProvider {
  createExternalEvent(context: TenantContext, appointment: Appointment, idempotencyKey: string): Promise<ActionReceipt<{ externalId: string }>>;
  updateExternalEvent(context: TenantContext, appointment: Appointment, expectedExternalVersion?: string): Promise<ActionReceipt<{ externalId: string; version?: string }>>;
  cancelExternalEvent(context: TenantContext, appointment: Appointment): Promise<ActionReceipt<{ externalId: string }>>;
}
