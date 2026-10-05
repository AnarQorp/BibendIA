import type {
  TenantControlResponse,
  OutboxSummaryRow,
  OutboxAttentionRow,
  RedactedAppointmentRow,
  PlatformTenantSummary,
  PlatformWorkshopRow,
  PlatformMembershipRow,
  PlatformGrantRow,
  PlatformChannelEndpointRow,
  PlatformIntegrationRow,
  PlatformAuditEventRow,
  WorkshopServiceDurationPolicy,
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

export type PlatformTenantItem = PlatformTenantSummary;

export interface PlatformTenantsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: PlatformTenantSummary[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformTenants(baseUrl = ''): Promise<PlatformTenantsState> {
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
    return { status: 'success', data: json.data || [], correlationId: json.correlationId };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PlatformWorkshopsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: PlatformWorkshopRow[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformWorkshops(tenantId: string, baseUrl = ''): Promise<PlatformWorkshopsState> {
  if (!tenantId) return { status: 'idle', message: 'Sin tenant seleccionado' };
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/workshops`, {
      method: 'GET',
      credentials: 'include',
    });
    if (res.status === 401 || res.status === 403) return { status: 'unauthorized', message: 'No autorizado' };
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
    const json = await res.json();
    return { status: 'success', data: json.data || [], correlationId: json.correlationId };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PatchPlatformWorkshopParams {
  name?: string;
  timezone?: string;
  openingHours?: Record<string, unknown>;
  serviceDurationPolicy?: WorkshopServiceDurationPolicy;
  status?: 'active' | 'suspended' | 'closed';
  expectedVersion: number;
  idempotencyKey: string;
}

export interface PlatformCommandReceipt {
  receiptId: string;
  operation: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  correlationId: string;
  evidenceRef?: string;
  occurredAt: string;
}

export interface PatchPlatformWorkshopResult {
  ok: boolean;
  status: 'success' | 'version_conflict' | 'unauthorized' | 'error';
  message?: string;
  receipt?: PlatformCommandReceipt;
  correlationId?: string;
}

export async function patchPlatformWorkshop(
  tenantId: string,
  workshopId: string,
  params: PatchPlatformWorkshopParams,
  baseUrl = ''
): Promise<PatchPlatformWorkshopResult> {
  if (!tenantId || !workshopId) {
    return { ok: false, status: 'error', message: 'Se requiere tenantId y workshopId' };
  }
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/workshops/${encodeURIComponent(workshopId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify(params),
    });
    const correlationId = res.headers?.get ? (res.headers.get('x-correlation-id') || undefined) : undefined;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 'unauthorized', message: 'No autorizado para modificar la configuración del taller', correlationId };
    }
    if (res.status === 409) {
      return { ok: false, status: 'version_conflict', message: 'Conflicto de concurrencia (versión desactualizada). Los datos se han recargado.', correlationId };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: 'error', message: err.error || err.message || `Error HTTP ${res.status}`, correlationId };
    }
    const json = await res.json();
    return { ok: true, status: 'success', receipt: json.receipt, correlationId: json.correlationId || correlationId };
  } catch (e) {
    return { ok: false, status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PlatformMembershipsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  memberships?: PlatformMembershipRow[];
  grants?: PlatformGrantRow[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformMembershipsAndGrants(tenantId: string, baseUrl = ''): Promise<PlatformMembershipsState> {
  if (!tenantId) return { status: 'idle', message: 'Sin tenant seleccionado' };
  try {
    const [mRes, gRes] = await Promise.all([
      fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/memberships`, { method: 'GET', credentials: 'include' }),
      fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/grants`, { method: 'GET', credentials: 'include' }),
    ]);
    if (mRes.status === 401 || mRes.status === 403 || gRes.status === 401 || gRes.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para gestionar membresías' };
    }
    const mJson = mRes.ok ? await mRes.json() : { data: [] };
    const gJson = gRes.ok ? await gRes.json() : { data: [] };
    return {
      status: 'success',
      memberships: mJson.data || [],
      grants: gJson.data || [],
      correlationId: mJson.correlationId || gJson.correlationId,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PlatformChannelsAndIntegrationsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  endpoints?: PlatformChannelEndpointRow[];
  integrations?: PlatformIntegrationRow[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformChannelsAndIntegrations(tenantId: string, baseUrl = ''): Promise<PlatformChannelsAndIntegrationsState> {
  if (!tenantId) return { status: 'idle', message: 'Sin tenant seleccionado' };
  try {
    const [cRes, iRes] = await Promise.all([
      fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/channel-endpoints`, { method: 'GET', credentials: 'include' }),
      fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/integrations`, { method: 'GET', credentials: 'include' }),
    ]);
    if (cRes.status === 401 || cRes.status === 403 || iRes.status === 401 || iRes.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para ver integraciones' };
    }
    const cJson = cRes.ok ? await cRes.json() : { data: [] };
    const iJson = iRes.ok ? await iRes.json() : { data: [] };
    return {
      status: 'success',
      endpoints: cJson.data || [],
      integrations: iJson.data || [],
      correlationId: cJson.correlationId || iJson.correlationId,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PlatformAuditState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  auditEvents?: PlatformAuditEventRow[];
  activityEvents?: PlatformAuditEventRow[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformAudit(tenantId: string, baseUrl = ''): Promise<PlatformAuditState> {
  if (!tenantId) return { status: 'idle', message: 'Sin tenant seleccionado' };
  try {
    const [aRes, actRes] = await Promise.all([
      fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/audit`, { method: 'GET', credentials: 'include' }),
      fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/activity`, { method: 'GET', credentials: 'include' }),
    ]);
    if (aRes.status === 401 || aRes.status === 403 || actRes.status === 401 || actRes.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar auditoría' };
    }
    const aJson = aRes.ok ? await aRes.json() : { data: [] };
    const actJson = actRes.ok ? await actRes.json() : { data: [] };
    return {
      status: 'success',
      auditEvents: aJson.data || [],
      activityEvents: actJson.data || [],
      correlationId: aJson.correlationId || actJson.correlationId,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}
