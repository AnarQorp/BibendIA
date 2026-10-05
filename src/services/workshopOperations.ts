import type {
  WorkshopCustomer,
  WorkshopVehicle,
  CreateWorkshopAppointmentCommand,
  WorkshopAppointmentResponse,
  CustomerDetailResponse,
  VehicleDetailResponse,
  WorkshopCapacityData,
  WorkshopCapacityPolicy,
  WorkshopOpeningHours,
  WorkshopServiceDurationPolicy,
} from '../types';

export interface WorkshopCustomersResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: WorkshopCustomer[];
  message?: string;
}

export interface CreateCustomerResult {
  status: 'success' | 'duplicate_suggestion' | 'unauthorized' | 'error';
  data?: WorkshopCustomer;
  existingCustomer?: WorkshopCustomer;
  message?: string;
}

export interface WorkshopVehiclesResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: WorkshopVehicle[];
  message?: string;
}

export interface CreateVehicleResult {
  status: 'success' | 'conflict' | 'unauthorized' | 'error';
  data?: WorkshopVehicle;
  existingVehicle?: WorkshopVehicle;
  code?: string;
  message?: string;
}

export interface CreateAppointmentResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: WorkshopAppointmentResponse;
  message?: string;
}

export async function listWorkshopCustomers(
  tenantId: string,
  options: { search?: string; limit?: number; offset?: number } = {},
  baseUrl = ''
): Promise<WorkshopCustomersResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };
  const query = new URLSearchParams();
  if (options.search) query.set('search', options.search);
  if (options.limit) query.set('limit', String(options.limit));
  if (options.offset) query.set('offset', String(options.offset));

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/customers?${query.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar clientes.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data || [] };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function createWorkshopCustomer(
  tenantId: string,
  data: { name: string; phone?: string; email?: string; notes?: string; allowDuplicate?: boolean },
  baseUrl = ''
): Promise<CreateCustomerResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para crear clientes.' };
    }
    const json = await res.json().catch(() => ({}));
    if (json.status === 'duplicate_suggestion') {
      return {
        status: 'duplicate_suggestion',
        existingCustomer: json.existingCustomer,
        message: json.message,
      };
    }
    if (!res.ok) {
      return { status: 'error', message: json.message || json.error || `HTTP ${res.status}` };
    }
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function listWorkshopVehicles(
  tenantId: string,
  options: { search?: string; customerId?: string; limit?: number; offset?: number } = {},
  baseUrl = ''
): Promise<WorkshopVehiclesResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };
  const query = new URLSearchParams();
  if (options.search) query.set('search', options.search);
  if (options.customerId) query.set('customerId', options.customerId);
  if (options.limit) query.set('limit', String(options.limit));
  if (options.offset) query.set('offset', String(options.offset));

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/vehicles?${query.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar vehículos.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data || [] };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function createWorkshopVehicle(
  tenantId: string,
  data: { plate?: string; make?: string; model?: string; year?: number; vin?: string; customerId?: string },
  baseUrl = ''
): Promise<CreateVehicleResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para crear vehículos.' };
    }
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      return {
        status: 'conflict',
        code: err.code,
        existingVehicle: err.existingVehicle,
        message: err.message || 'Ya existe un vehículo con esta matrícula o bastidor.',
      };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function createWorkshopAppointment(
  tenantId: string,
  data: CreateWorkshopAppointmentCommand,
  baseUrl = ''
): Promise<CreateAppointmentResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para crear citas.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (
        res.status === 422 ||
        (typeof err.error === 'string' && err.error.includes('CAPACITY')) ||
        (typeof err.message === 'string' && err.message.includes('CAPACITY'))
      ) {
        return { status: 'error', message: 'No hay capacidad disponible a esa hora.' };
      }
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export interface WorkshopCustomerDetailResult {
  status: 'success' | 'not_found' | 'unauthorized' | 'error';
  data?: CustomerDetailResponse;
  message?: string;
}

export interface UpdateCustomerResult {
  status: 'success' | 'duplicate_suggestion' | 'not_found' | 'unauthorized' | 'error';
  data?: WorkshopCustomer;
  existingCustomer?: WorkshopCustomer;
  message?: string;
}

export interface WorkshopVehicleDetailResult {
  status: 'success' | 'not_found' | 'unauthorized' | 'error';
  data?: VehicleDetailResponse;
  message?: string;
}

export interface UpdateVehicleResult {
  status: 'success' | 'conflict' | 'not_found' | 'unauthorized' | 'error';
  data?: WorkshopVehicle;
  existingVehicle?: WorkshopVehicle;
  code?: string;
  message?: string;
}

export interface AssociateRoleResult {
  status: 'success' | 'not_found' | 'unauthorized' | 'error';
  data?: any;
  message?: string;
}

export async function getWorkshopCustomerDetail(
  tenantId: string,
  customerId: string,
  baseUrl = ''
): Promise<WorkshopCustomerDetailResult> {
  if (!tenantId || !customerId) return { status: 'error', message: 'Parámetros incompletos.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar el cliente.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Cliente no encontrado.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function updateWorkshopCustomer(
  tenantId: string,
  customerId: string,
  data: { name?: string; phone?: string | null; email?: string | null; notes?: string | null; allowDuplicate?: boolean },
  baseUrl = ''
): Promise<UpdateCustomerResult> {
  if (!tenantId || !customerId) return { status: 'error', message: 'Parámetros incompletos.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para modificar clientes.' };
    }
    const json = await res.json().catch(() => ({}));
    if (json.status === 'duplicate_suggestion') {
      return {
        status: 'duplicate_suggestion',
        existingCustomer: json.existingCustomer,
        message: json.message,
      };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Cliente no encontrado.' };
    }
    if (!res.ok) {
      return { status: 'error', message: json.message || json.error || `HTTP ${res.status}` };
    }
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function getWorkshopVehicleDetail(
  tenantId: string,
  vehicleId: string,
  baseUrl = ''
): Promise<WorkshopVehicleDetailResult> {
  if (!tenantId || !vehicleId) return { status: 'error', message: 'Parámetros incompletos.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/vehicles/${encodeURIComponent(vehicleId)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar el vehículo.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Vehículo no encontrado.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function updateWorkshopVehicle(
  tenantId: string,
  vehicleId: string,
  data: { plate?: string | null; make?: string | null; model?: string | null; year?: number | null; vin?: string | null; customerId?: string | null },
  baseUrl = ''
): Promise<UpdateVehicleResult> {
  if (!tenantId || !vehicleId) return { status: 'error', message: 'Parámetros incompletos.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/vehicles/${encodeURIComponent(vehicleId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para modificar vehículos.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Vehículo no encontrado.' };
    }
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      return {
        status: 'conflict',
        code: err.code,
        existingVehicle: err.existingVehicle,
        message: err.message || 'Ya existe un vehículo con esta matrícula o bastidor.',
      };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export async function associateCustomerVehicle(
  tenantId: string,
  data: { customerId: string; vehicleId: string; role?: string },
  baseUrl = ''
): Promise<AssociateRoleResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };

  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/customer-vehicle-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para asociar cliente y vehículo.' };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Cliente o vehículo no encontrado.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export interface WorkshopCapacityResult {
  status: 'success' | 'unauthorized' | 'not_found' | 'error';
  data?: WorkshopCapacityData;
  message?: string;
  correlationId?: string;
}

export async function getWorkshopCapacity(
  tenantId: string,
  workshopId: string,
  baseUrl = ''
): Promise<WorkshopCapacityResult> {
  if (!tenantId || !workshopId) {
    return { status: 'error', message: 'Se requiere tenantId y workshopId.' };
  }
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/workshops/${encodeURIComponent(workshopId)}/capacity`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const correlationId = res.headers.get('x-correlation-id') || undefined;
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar la capacidad del taller.', correlationId };
    }
    if (res.status === 404) {
      return { status: 'not_found', message: 'Taller no encontrado.', correlationId };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}`, correlationId };
    }
    const json = await res.json();
    const data = json.data !== undefined ? json.data : json;
    return { status: 'success', data, correlationId: json.correlationId || correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export interface PatchWorkshopCapacityPayload {
  openingHours?: Record<string, unknown>;
  serviceDurationPolicy?: WorkshopServiceDurationPolicy;
  capacityPolicy?: WorkshopCapacityPolicy;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface PatchWorkshopCapacityResult {
  status: 'success' | 'unauthorized' | 'version_conflict' | 'idempotency_conflict' | 'error';
  ok?: boolean;
  data?: WorkshopCapacityData;
  receipt?: any;
  message?: string;
  correlationId?: string;
}

export async function patchWorkshopCapacity(
  tenantId: string,
  workshopId: string,
  payload: PatchWorkshopCapacityPayload,
  baseUrl = ''
): Promise<PatchWorkshopCapacityResult> {
  if (!tenantId || !workshopId) {
    return { status: 'error', message: 'Se requiere tenantId y workshopId.' };
  }
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/workshops/${encodeURIComponent(workshopId)}/capacity`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const correlationId = res.headers.get('x-correlation-id') || undefined;
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para modificar la capacidad del taller.', correlationId };
    }
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      if (err.error === 'VERSION_CONFLICT' || err.message?.includes('Version conflict')) {
        return { status: 'version_conflict', message: 'Conflicto de concurrencia: versión desactualizada.', correlationId };
      }
      return { status: 'idempotency_conflict', message: 'Conflicto de idempotencia en la mutación.', correlationId };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}`, correlationId };
    }
    const json = await res.json();
    const data = json.data !== undefined ? json.data : json;
    return {
      status: 'success',
      ok: true,
      data,
      receipt: json.receipt,
      correlationId: json.correlationId || correlationId
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export interface UpdateAppointmentStatusParams {
  status: 'awaiting_arrival' | 'on_site' | 'in_progress' | 'waiting' | 'completed' | 'delivered' | 'cancelled';
  expectedVersion: number;
  idempotencyKey: string;
}

export interface UpdateAppointmentStatusResult {
  status: 'success' | 'version_conflict' | 'invalid_transition' | 'unauthorized' | 'error';
  data?: { id: string; workshop_id: string; status: string; customer_wait_mode: string; version: number };
  message?: string;
  correlationId?: string;
}

export async function updateAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  params: UpdateAppointmentStatusParams,
  baseUrl = ''
): Promise<UpdateAppointmentStatusResult> {
  if (!tenantId || !appointmentId) {
    return { status: 'error', message: 'Parámetros incompletos.' };
  }
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const correlationId = res.headers.get('x-correlation-id') || undefined;
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para cambiar el estado de la cita.', correlationId };
    }
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      if (err.error === 'VERSION_CONFLICT') {
        return { status: 'version_conflict', message: 'Conflicto de concurrencia: la cita ha sido modificada por otro usuario.', correlationId };
      }
      return { status: 'invalid_transition', message: 'Transición de estado no permitida para el estado actual.', correlationId };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}`, correlationId };
    }
    const json = await res.json();
    return { status: 'success', data: json.data, correlationId: json.correlationId || correlationId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

export interface TenantWorkshopSummary {
  id: string;
  tenant_id: string;
  name: string;
  timezone: string;
  version: number;
}

export interface ListTenantWorkshopsResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: TenantWorkshopSummary[];
  message?: string;
}

export async function listTenantWorkshops(
  tenantId: string,
  baseUrl = ''
): Promise<ListTenantWorkshopsResult> {
  if (!tenantId) return { status: 'error', message: 'Se requiere tenantId.' };
  try {
    const res = await fetch(`${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/workshops`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para listar talleres.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data || [] };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}

