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
  PlatformInvitationRow,
  PlatformWorkshopDirectoryItem,
  WorkshopPlanCode,
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

// ==========================================
// CANONICAL TENANT & WORKSHOP PROVISIONING (SQL041)
// ==========================================

export interface CreatePlatformTenantParams {
  name: string;
  locale?: string;
  timezone?: string;
  operatingMode?: 'standard' | 'pilot_supervised';
  planCode?: WorkshopPlanCode;
  plan?: WorkshopPlanCode;
  idempotencyKey: string;
}

export async function createPlatformTenant(
  params: CreatePlatformTenantParams,
  baseUrl = ''
): Promise<{ ok: boolean; data?: unknown; receipt?: unknown; message?: string; correlationId?: string }> {
  try {
    const payload = {
      name: params.name,
      locale: params.locale || 'es-ES',
      timezone: params.timezone || 'Europe/Madrid',
      operatingMode: params.operatingMode || 'pilot_supervised',
      workshop: {
        name: params.name,
        timezone: params.timezone || 'Europe/Madrid',
      },
      idempotencyKey: params.idempotencyKey,
    };
    const res = await fetch(`${baseUrl}/v1/platform/tenants`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error || `Error ${res.status}` };
    }
    const json = await res.json();
    const tenantId = json.receipt?.entityId || json.receipt?.after?.tenant?.id;
    const plan = params.planCode || params.plan;
    if (tenantId && plan && plan !== 'pilot') {
      await patchPlatformTenant(tenantId, {
        planCode: plan,
        expectedVersion: 1,
        idempotencyKey: `${params.idempotencyKey}-plan`,
      }, baseUrl).catch(() => {});
    }
    return { ok: true, data: json.data || json.receipt?.after, receipt: json.receipt, correlationId: json.correlationId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface PatchPlatformTenantParams {
  planCode?: WorkshopPlanCode;
  name?: string;
  locale?: string;
  timezone?: string;
  operatingMode?: 'standard' | 'pilot_supervised';
  expectedVersion: number;
  idempotencyKey: string;
}

export async function patchPlatformTenant(
  tenantId: string,
  params: PatchPlatformTenantParams,
  baseUrl = ''
): Promise<{ ok: boolean; data?: unknown; receipt?: unknown; message?: string; correlationId?: string }> {
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
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

// ==========================================
// WORKSHOPS DIRECTORY (AGGREGATED CANONICAL VIEW)
// ==========================================

export interface PlatformWorkshopsDirectoryState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: PlatformWorkshopDirectoryItem[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformWorkshopsDirectory(
  _params?: { search?: string; status?: string; plan?: string },
  baseUrl = ''
): Promise<PlatformWorkshopsDirectoryState> {
  try {
    const tenantsRes = await fetchPlatformTenants(baseUrl);
    if (tenantsRes.status !== 'success' || !tenantsRes.data) {
      return { status: tenantsRes.status, message: tenantsRes.message };
    }

    const items: PlatformWorkshopDirectoryItem[] = [];
    for (const t of tenantsRes.data) {
      const wRes = await fetchPlatformWorkshops(t.id, baseUrl);
      const workshops = wRes.status === 'success' && wRes.data ? wRes.data : [];
      if (workshops.length > 0) {
        for (const w of workshops) {
          items.push({
            id: w.id,
            tenant_id: t.id,
            name: w.name,
            slug: w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            workshop_status: w.status,
            tenant_name: t.name,
            tenant_plan: t.plan_code || (t as any).plan || 'pilot',
            operating_mode: t.operating_mode,
            lifecycle_status: t.lifecycle_status,
            kill_switch_enabled: t.kill_switch_enabled,
            tenant_version: t.version,
            created_at: t.created_at,
          });
        }
      } else {
        items.push({
          id: t.id,
          tenant_id: t.id,
          name: t.name,
          slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          workshop_status: 'active',
          tenant_name: t.name,
          tenant_plan: t.plan_code || (t as any).plan || 'pilot',
          operating_mode: t.operating_mode,
          lifecycle_status: t.lifecycle_status,
          kill_switch_enabled: t.kill_switch_enabled,
          tenant_version: t.version,
          created_at: t.created_at,
        });
      }
    }

    return { status: 'success', data: items, correlationId: tenantsRes.correlationId };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

// ==========================================
// CANONICAL INVITATIONS MANAGEMENT (SQL041)
// ==========================================

export interface PlatformInvitationsState {
  status: 'idle' | 'loading' | 'unauthorized' | 'error' | 'success';
  data?: PlatformInvitationRow[];
  message?: string;
  correlationId?: string;
}

export async function fetchPlatformInvitations(
  params?: { tenantId?: string; status?: string },
  baseUrl = ''
): Promise<PlatformInvitationsState> {
  try {
    if (params?.tenantId && params.tenantId !== 'all') {
      const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(params.tenantId)}/invitations`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) {
        return { status: 'unauthorized', message: 'No autorizado para consultar invitaciones de este tenant' };
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { status: 'error', message: err.error || `HTTP ${res.status}` };
      }
      const json = await res.json();
      return { status: 'success', data: json.data || [], correlationId: json.correlationId };
    }

    // When tenantId is not provided or 'all', aggregate over all active tenants
    const tenantsRes = await fetchPlatformTenants(baseUrl);
    if (tenantsRes.status !== 'success' || !tenantsRes.data) {
      return { status: tenantsRes.status, message: tenantsRes.message };
    }

    const allInvitations: PlatformInvitationRow[] = [];
    for (const t of tenantsRes.data) {
      const invRes = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(t.id)}/invitations`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }).catch(() => null);
      if (invRes && invRes.ok) {
        const json = await invRes.json().catch(() => null);
        if (json?.data && Array.isArray(json.data)) {
          for (const inv of json.data) {
            allInvitations.push({
              ...inv,
              tenant_name: t.name,
              tenant_plan: t.plan_code || (t as any).plan || 'pilot',
            });
          }
        }
      }
    }

    return { status: 'success', data: allInvitations, correlationId: tenantsRes.correlationId };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface CreatePlatformInvitationParams {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'RECEPTION' | 'VIEWER';
  expiresInHours?: number;
  idempotencyKey: string;
}

export async function createPlatformInvitation(
  tenantId: string,
  params: CreatePlatformInvitationParams,
  baseUrl = ''
): Promise<{ ok: boolean; receipt?: unknown; message?: string; correlationId?: string }> {
  try {
    const res = await fetch(`${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/invitations`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        role: params.role || 'OWNER',
        expiresInHours: params.expiresInHours || 72,
        idempotencyKey: params.idempotencyKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error || `Error ${res.status}` };
    }
    const json = await res.json();
    return {
      ok: true,
      receipt: json.receipt,
      correlationId: json.correlationId,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface ResendPlatformInvitationParams {
  expectedVersion: number;
  expiresInHours?: number;
  idempotencyKey: string;
}

export async function resendPlatformInvitation(
  tenantId: string,
  invitationId: string,
  params: ResendPlatformInvitationParams,
  baseUrl = ''
): Promise<{ ok: boolean; receipt?: unknown; message?: string; correlationId?: string }> {
  try {
    const res = await fetch(
      `${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: params.expectedVersion,
          expiresInHours: params.expiresInHours || 72,
          idempotencyKey: params.idempotencyKey,
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error || `Error ${res.status}` };
    }
    const json = await res.json();
    return {
      ok: true,
      receipt: json.receipt,
      correlationId: json.correlationId,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface ExpirePlatformInvitationParams {
  expectedVersion: number;
  idempotencyKey: string;
}

export async function expirePlatformInvitation(
  tenantId: string,
  invitationId: string,
  params: ExpirePlatformInvitationParams,
  baseUrl = ''
): Promise<{ ok: boolean; receipt?: unknown; message?: string; correlationId?: string }> {
  try {
    const res = await fetch(
      `${baseUrl}/v1/platform/tenants/${encodeURIComponent(tenantId)}/invitations/${encodeURIComponent(invitationId)}/expire`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: params.expectedVersion,
          idempotencyKey: params.idempotencyKey,
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error || `Error ${res.status}` };
    }
    const json = await res.json();
    return {
      ok: true,
      receipt: json.receipt,
      correlationId: json.correlationId,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error de red' };
  }
}

