import type {
  TenantControlResponse,
  OutboxSummaryRow,
  OutboxAttentionRow,
  RedactedAppointmentRow,
} from '../types';

export interface PlatformControlState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: TenantControlResponse;
  message?: string;
  correlationId?: string;
}

export interface PlatformOutboxState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  summary?: OutboxSummaryRow[];
  attention?: OutboxAttentionRow[];
  message?: string;
  correlationId?: string;
}

export interface PlatformAppointmentsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: RedactedAppointmentRow[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformControl(
  tenantId: string,
  baseUrl = ''
): Promise<PlatformControlState> {
  if (!tenantId || tenantId.trim() === '') {
    return { status: 'idle', message: 'No hay tenant seleccionado.' };
  }
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/control`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'Se requiere rol PLATFORM_ADMIN / PLATFORM_OPERATOR autenticado.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { status: 'success', data: json.data, correlationId: json.correlationId };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface MutateLifecycleParams {
  target: 'provisioning' | 'pilot' | 'active' | 'suspended' | 'deactivated';
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
}

/**
 * Executes tenant lifecycle transition.
 * Invariant: idempotencyKey is supplied by the calling user action layer
 * and MUST be preserved across retries of the same intent.
 */
export async function mutateTenantLifecycle(
  tenantId: string,
  params: MutateLifecycleParams,
  baseUrl = ''
): Promise<{ ok: boolean; message?: string; receipt?: unknown; correlationId?: string }> {
  if (!params.idempotencyKey) {
    throw new Error('idempotencyKey is required for lifecycle mutation');
  }
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        target: params.target,
        reason: params.reason,
        expectedVersion: params.expectedVersion,
        idempotencyKey: params.idempotencyKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error || `Error ${res.status}` };
    }
    const json = await res.json();
    return { ok: true, receipt: json.receipt, correlationId: json.correlationId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface MutateKillSwitchParams {
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
}

/**
 * Toggles emergency kill switch.
 * Invariant: idempotencyKey is supplied by the calling user action layer
 * and MUST be preserved across retries of the same intent.
 */
export async function mutateTenantKillSwitch(
  tenantId: string,
  enabled: boolean,
  params: MutateKillSwitchParams,
  baseUrl = ''
): Promise<{ ok: boolean; message?: string; receipt?: unknown; correlationId?: string }> {
  if (!params.idempotencyKey) {
    throw new Error('idempotencyKey is required for kill-switch mutation');
  }
  const action = enabled ? 'enable' : 'disable';
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/kill-switch/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        reason: params.reason,
        expectedVersion: params.expectedVersion,
        idempotencyKey: params.idempotencyKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error || `Error ${res.status}` };
    }
    const json = await res.json();
    return { ok: true, receipt: json.receipt, correlationId: json.correlationId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export async function fetchPlatformOutbox(
  tenantId: string,
  baseUrl = ''
): Promise<PlatformOutboxState> {
  if (!tenantId || tenantId.trim() === '') {
    return { status: 'idle', message: 'No hay tenant seleccionado.' };
  }
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/outbox`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'Acceso no autorizado al Outbox de plataforma.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return {
      status: 'success',
      summary: json.data?.summary || [],
      attention: json.data?.attention || [],
      correlationId: json.correlationId,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export async function fetchPlatformAppointments(
  tenantId: string,
  baseUrl = ''
): Promise<PlatformAppointmentsState> {
  if (!tenantId || tenantId.trim() === '') {
    return { status: 'idle', message: 'No hay tenant seleccionado.' };
  }
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/appointments`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'Acceso no autorizado a citas redactadas de plataforma.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return {
      status: 'success',
      data: json.data || [],
      correlationId: json.correlationId,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PlatformTenantItem {
  id: string;
  name: string;
  locale: string;
  timezone: string;
  operating_mode: string;
  lifecycle_status: string;
  kill_switch_enabled: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformTenantsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: PlatformTenantItem[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformTenants(
  baseUrl = ''
): Promise<PlatformTenantsState> {
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'Se requiere rol PLATFORM_ADMIN / PLATFORM_OPERATOR autenticado.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { status: 'error', message: err.error || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return {
      status: 'success',
      data: json.data || [],
      correlationId: json.correlationId,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}
