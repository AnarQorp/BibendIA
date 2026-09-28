import type { WorkshopAppointmentResponse } from '../types';

export type WorkshopAppointmentsState =
  | { status: 'idle' }
  | { status: 'awaiting_tenant' }
  | { status: 'loading' }
  | { status: 'unauthorized'; message: string }
  | { status: 'error'; message: string; correlationId?: string }
  | { status: 'empty' }
  | { status: 'success'; data: WorkshopAppointmentResponse[]; correlationId?: string };

export interface FetchWorkshopAppointmentsOptions {
  tenantId?: string | null;
  baseUrl?: string;
  signal?: AbortSignal;
}

/**
 * Resolves the API base URL from runtime window override or build-time env.
 */
export function getApiBaseUrl(): string {
  const windowOverride = typeof window !== 'undefined'
    ? (window as unknown as { __BIBENDIA_API_URL__?: string }).__BIBENDIA_API_URL__
    : undefined;
  const envUrl = windowOverride || (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_API_URL;
  return envUrl ? envUrl.replace(/\/+$/, '') : '';
}

/**
 * Resolves the workshop tenantId dynamically without hardcoding:
 * 1. Runtime window override (for controlled test harnesses / CDP)
 * 2. URL search params `?tenant=<uuid>`
 * 3. Build-time / dev env `VITE_WORKSHOP_TENANT_ID`
 * Returns null if awaiting session resolution.
 */
export function getWorkshopTenantId(): string | null {
  if (typeof window !== 'undefined') {
    const windowOverride = (window as unknown as { __BIBENDIA_WORKSHOP_TENANT_ID__?: string }).__BIBENDIA_WORKSHOP_TENANT_ID__;
    if (windowOverride && typeof windowOverride === 'string' && windowOverride.trim()) {
      return windowOverride.trim();
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const queryTenant = params.get('tenant');
      if (queryTenant && queryTenant.trim()) {
        return queryTenant.trim();
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  const envTenant = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_WORKSHOP_TENANT_ID;
  if (envTenant && typeof envTenant === 'string' && envTenant.trim()) {
    return envTenant.trim();
  }

  return null;
}

/**
 * Service adapter for real backend contract:
 * GET /v1/workshop/tenants/:tenantId/appointments
 *
 * Invariants:
 * - Uses standard session credentials (HttpOnly cookie per ADR 0002).
 * - Never invents JWT or fake tokens.
 * - Never sends client-controlled x-tenant-id as authorization authority.
 * - Accurately differentiates between 401/403 (unauthorized) and data states.
 */
export async function fetchWorkshopAppointments(
  options: FetchWorkshopAppointmentsOptions = {}
): Promise<WorkshopAppointmentsState> {
  const tenantId = options.tenantId ?? getWorkshopTenantId();
  const baseUrl = options.baseUrl ?? getApiBaseUrl();
  const { signal } = options;

  if (!tenantId || tenantId.trim() === '') {
    return {
      status: 'awaiting_tenant',
    };
  }

  const endpoint = `${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/appointments`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
      signal,
    });

    const correlationId = response.headers.get('x-correlation-id') || undefined;

    if (response.status === 401) {
      return {
        status: 'unauthorized',
        message: 'Sesión no iniciada o caducada. Se requiere autenticación de taller.',
      };
    }

    if (response.status === 403) {
      return {
        status: 'unauthorized',
        message: 'Acceso no autorizado para este taller o permisos insuficientes.',
      };
    }

    if (response.status === 400) {
      const errJson = await response.json().catch(() => ({}));
      return {
        status: 'error',
        message: (errJson as { error?: string }).error || 'Selector de taller inválido.',
        correlationId,
      };
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return {
        status: 'error',
        message: (errJson as { error?: string; safeMessage?: string }).safeMessage ||
                 (errJson as { error?: string }).error ||
                 `Error de servidor (${response.status})`,
        correlationId,
      };
    }

    const json = (await response.json()) as { data: WorkshopAppointmentResponse[]; correlationId?: string };
    const items = json.data || [];

    if (items.length === 0) {
      return {
        status: 'empty',
      };
    }

    return {
      status: 'success',
      data: items,
      correlationId: json.correlationId || correlationId,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'idle' };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error de conexión con la API de taller.',
    };
  }
}

/**
 * Checks whether an appointment start_at ISO timestamp occurs on the current calendar day (local time).
 */
export function isAppointmentToday(startAt: string): boolean {
  try {
    const appDate = new Date(startAt);
    const today = new Date();
    return (
      appDate.getFullYear() === today.getFullYear() &&
      appDate.getMonth() === today.getMonth() &&
      appDate.getDate() === today.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Checks if the appointment has provisional identity (provisional_new or provisional_ambiguous)
 * per canonical backend contract. Both require human workshop review.
 */
export function isProvisionalIdentity(app: WorkshopAppointmentResponse): boolean {
  return app.identity_resolution === 'provisional_new' || app.identity_resolution === 'provisional_ambiguous';
}

/**
 * Formats time range e.g. "09:30 - 10:45" or "09:30".
 */
export function formatAppointmentTime(startAt: string, endAt?: string): string {
  try {
    const start = new Date(startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (endAt) {
      const end = new Date(endAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      return `${start} – ${end}`;
    }
    return start;
  } catch {
    return startAt;
  }
}

/**
 * Formats appointment date string e.g. "Jueves 17 de Septiembre".
 */
export function formatAppointmentDate(startAt: string): string {
  try {
    return new Date(startAt).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return startAt;
  }
}
