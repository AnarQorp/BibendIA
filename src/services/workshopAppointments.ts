import type { WorkshopAppointmentResponse } from '../types';

export type WorkshopAppointmentsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unauthorized'; message: string }
  | { status: 'error'; message: string; correlationId?: string }
  | { status: 'empty' }
  | { status: 'success'; data: WorkshopAppointmentResponse[]; correlationId?: string };

export interface FetchWorkshopAppointmentsOptions {
  tenantId: string;
  baseUrl?: string;
  signal?: AbortSignal;
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
  options: FetchWorkshopAppointmentsOptions
): Promise<WorkshopAppointmentsState> {
  const { tenantId, baseUrl = '', signal } = options;

  if (!tenantId || tenantId.trim() === '') {
    return {
      status: 'error',
      message: 'No se ha proporcionado un identificador de taller (tenantId) válido.',
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
