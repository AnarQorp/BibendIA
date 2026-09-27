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
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/control`, {
      method: 'GET',
      credentials: 'include',
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

export async function mutateTenantLifecycle(
  tenantId: string,
  params: { target: 'provisioning' | 'pilot' | 'active' | 'suspended' | 'deactivated'; reason: string; expectedVersion: number },
  baseUrl = ''
): Promise<{ ok: boolean; message?: string; receipt?: unknown; correlationId?: string }> {
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        idempotencyKey: `lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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

export async function mutateTenantKillSwitch(
  tenantId: string,
  enabled: boolean,
  params: { reason: string; expectedVersion: number },
  baseUrl = ''
): Promise<{ ok: boolean; message?: string; receipt?: unknown; correlationId?: string }> {
  const action = enabled ? 'enable' : 'disable';
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/kill-switch/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        idempotencyKey: `ks-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/outbox`, {
      method: 'GET',
      credentials: 'include',
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
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/appointments`, {
      method: 'GET',
      credentials: 'include',
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
