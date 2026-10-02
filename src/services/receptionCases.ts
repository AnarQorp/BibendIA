export const CHANNELS = ['PHONE', 'WHATSAPP', 'WEB', 'MANUAL'] as const;
export type ReceptionCaseChannel = (typeof CHANNELS)[number];

export const CALLER_TYPES = [
  'CUSTOMER',
  'SUPPLIER',
  'INSURER_ASSESSOR',
  'RENTING_FLEET',
  'TOW_TRANSPORT',
  'OTHER_WORKSHOP',
  'COMMERCIAL',
  'OTHER'
] as const;
export type ReceptionCaseCallerType = (typeof CALLER_TYPES)[number];

export const CATEGORIES = [
  'callback_request',
  'appointment_issue',
  'late_arrival',
  'vehicle_status_question',
  'estimate_question',
  'additional_vehicle_issue',
  'supplier_message',
  'parts_delivery',
  'tow_delivery',
  'insurance_assessor',
  'administration_invoice',
  'missed_call_return',
  'commercial',
  'other'
] as const;
export type ReceptionCaseCategory = (typeof CATEGORIES)[number];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type ReceptionCasePriority = (typeof PRIORITIES)[number];

export const STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_WORKSHOP',
  'RESOLVED',
  'CLOSED'
] as const;
export type ReceptionCaseStatus = (typeof STATUSES)[number];

export interface ReceptionCase {
  id: string;
  workshopId: string;
  channel: ReceptionCaseChannel;
  callerType: ReceptionCaseCallerType;
  category: ReceptionCaseCategory;
  summary: string;
  detail?: string | null;
  priority: ReceptionCasePriority;
  status: ReceptionCaseStatus;
  providerConversationId?: string | null;
  customerId?: string | null;
  vehicleId?: string | null;
  appointmentId?: string | null;
  estimateId?: string | null;
  contactContext?: Record<string, string> | null;
  provenance?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
}

export interface ReceptionCaseAuditEvent {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string;
  correlationId: string;
  evidenceRef: string;
  occurredAt: string;
}

export interface ListReceptionCasesFilters {
  status?: ReceptionCaseStatus;
  category?: ReceptionCaseCategory;
  channel?: ReceptionCaseChannel;
  priority?: ReceptionCasePriority;
  customerId?: string;
  vehicleId?: string;
  limit?: number;
  offset?: number;
}

export interface ReceptionCasesListResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: ReceptionCase[];
  message?: string;
  correlationId?: string;
}

export interface ReceptionCaseDetailResult {
  status: 'success' | 'not_found' | 'unauthorized' | 'error';
  data?: ReceptionCase;
  message?: string;
  correlationId?: string;
}

export interface UpdateReceptionCaseResult {
  status: 'success' | 'not_found' | 'unauthorized' | 'error';
  data?: ReceptionCase;
  message?: string;
  correlationId?: string;
}

export interface CreateReceptionCaseResult {
  status: 'success' | 'ambiguous_workshop' | 'unauthorized' | 'error';
  data?: ReceptionCase;
  message?: string;
  correlationId?: string;
}

export interface ReceptionCaseHistoryResult {
  status: 'success' | 'not_found' | 'unauthorized' | 'error';
  data?: ReceptionCaseAuditEvent[];
  message?: string;
  correlationId?: string;
}

export interface CreateReceptionCasePayload {
  callerType: ReceptionCaseCallerType;
  category: ReceptionCaseCategory;
  summary: string;
  detail?: string;
  priority?: ReceptionCasePriority;
  workshopId?: string;
  customerId?: string | null;
  vehicleId?: string | null;
  appointmentId?: string | null;
  estimateId?: string | null;
  contactContext?: Record<string, string>;
  idempotencyKey: string;
}

export interface UpdateReceptionCasePayload {
  status?: ReceptionCaseStatus;
  priority?: ReceptionCasePriority;
  customerId?: string | null;
  vehicleId?: string | null;
  appointmentId?: string | null;
  estimateId?: string | null;
}

export async function listReceptionCases(
  tenantId: string,
  filters: ListReceptionCasesFilters = {},
  baseUrl = ''
): Promise<ReceptionCasesListResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId autorizado.' };
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.category) query.set('category', filters.category);
  if (filters.channel) query.set('channel', filters.channel);
  if (filters.priority) query.set('priority', filters.priority);
  if (filters.customerId) query.set('customerId', filters.customerId);
  if (filters.vehicleId) query.set('vehicleId', filters.vehicleId);
  if (filters.limit) query.set('limit', String(filters.limit));
  if (filters.offset) query.set('offset', String(filters.offset));

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/reception-cases?${query.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar la bandeja de recepción.' };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'error', message: json.error || `HTTP ${res.status}`, correlationId: json.correlationId };
    }
    return { status: 'success', data: json.data || [], correlationId: json.correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red al consultar recepción' };
  }
}

export async function getReceptionCase(
  tenantId: string,
  caseId: string,
  baseUrl = ''
): Promise<ReceptionCaseDetailResult> {
  if (!tenantId || !caseId) return { status: 'error', message: 'Parámetros incompletos.' };
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/reception-cases/${encodeURIComponent(caseId)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar este asunto.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Asunto de recepción no encontrado.' };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'error', message: json.error || `HTTP ${res.status}`, correlationId: json.correlationId };
    }
    return { status: 'success', data: json.data, correlationId: json.correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function updateReceptionCase(
  tenantId: string,
  caseId: string,
  payload: UpdateReceptionCasePayload,
  baseUrl = ''
): Promise<UpdateReceptionCaseResult> {
  if (!tenantId || !caseId) return { status: 'error', message: 'Parámetros incompletos.' };
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/reception-cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para actualizar este asunto.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Asunto de recepción no encontrado.' };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'error', message: json.error || `HTTP ${res.status}`, correlationId: json.correlationId };
    }
    return { status: 'success', data: json.data, correlationId: json.correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red al actualizar asunto' };
  }
}

export async function createReceptionCase(
  tenantId: string,
  payload: CreateReceptionCasePayload,
  baseUrl = ''
): Promise<CreateReceptionCaseResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId autorizado.' };
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/reception-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para crear asuntos de recepción.' };
    }
    const json = await res.json().catch(() => ({}));
    if (res.status === 409 && json.error === 'WORKSHOP_CONTEXT_AMBIGUOUS') {
      return {
        status: 'ambiguous_workshop',
        message: 'Existe más de un taller para este tenant. Debe especificarse el taller exacto.',
        correlationId: json.correlationId
      };
    }
    if (!res.ok) {
      return { status: 'error', message: json.error || `HTTP ${res.status}`, correlationId: json.correlationId };
    }
    return { status: 'success', data: json.data, correlationId: json.correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red al crear asunto' };
  }
}

export async function getReceptionCaseHistory(
  tenantId: string,
  caseId: string,
  baseUrl = ''
): Promise<ReceptionCaseHistoryResult> {
  if (!tenantId || !caseId) return { status: 'error', message: 'Parámetros incompletos.' };
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/reception-cases/${encodeURIComponent(caseId)}/history`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar el historial.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Asunto no encontrado.' };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'error', message: json.error || `HTTP ${res.status}`, correlationId: json.correlationId };
    }
    return { status: 'success', data: json.data || [], correlationId: json.correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red al consultar historial' };
  }
}
