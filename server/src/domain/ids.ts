export type TenantId = string & { readonly __brand: 'TenantId' };
export type WorkshopId = string & { readonly __brand: 'WorkshopId' };
export type CallId = string & { readonly __brand: 'CallId' };
export type ConversationId = string & { readonly __brand: 'ConversationId' };
export type ReceptionCaseId = string & { readonly __brand: 'ReceptionCaseId' };
export type AppointmentId = string & { readonly __brand: 'AppointmentId' };

export interface TenantContext {
  tenantId: TenantId;
  workshopId: WorkshopId;
  correlationId: string;
  actor: {
    type: 'voice_agent' | 'human' | 'system';
    id: string;
  };
}
