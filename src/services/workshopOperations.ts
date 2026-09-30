import type {
  WorkshopCustomer,
  WorkshopVehicle,
  CreateWorkshopAppointmentCommand,
  WorkshopAppointmentResponse
} from '../types';

export interface WorkshopCustomersResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: WorkshopCustomer[];
  message?: string;
}

export interface CreateCustomerResult {
  status: 'success' | 'unauthorized' | 'error';
  data?: WorkshopCustomer;
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
  data: { name: string; phone?: string; email?: string; notes?: string },
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
      return { status: 'error', message: err.message || err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error de red' };
  }
}
