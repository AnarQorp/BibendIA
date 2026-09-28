export interface LeadFormData {
  taller: string;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string;
  website: string;
}

export interface LeadSubmissionPayload {
  workshop: string;
  contactName: string;
  phone: string;
  email?: string;
  message?: string;
  website: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface SubmissionResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  userMessage?: string;
}

/**
 * Validates lead form fields on the client before making a network request.
 * Backend remains the final authority, but client provides basic feedback.
 */
export function validateLeadForm(data: LeadFormData): ValidationResult {
  const errors: Record<string, string> = {};

  const workshop = data.taller.trim();
  if (!workshop) {
    errors.taller = 'El nombre del taller es obligatorio.';
  } else if (workshop.length < 2) {
    errors.taller = 'El nombre del taller debe tener al menos 2 caracteres.';
  } else if (workshop.length > 160) {
    errors.taller = 'El nombre del taller no puede superar los 160 caracteres.';
  }

  const contactName = data.nombre.trim();
  if (!contactName) {
    errors.nombre = 'La persona de contacto es obligatoria.';
  } else if (contactName.length < 2) {
    errors.nombre = 'El nombre de contacto debe tener al menos 2 caracteres.';
  } else if (contactName.length > 120) {
    errors.nombre = 'El nombre de contacto no puede superar los 120 caracteres.';
  }

  const rawPhone = data.telefono.trim();
  const normalizedPhone = rawPhone.replace(/[\s\-\(\)\.]/g, '');
  if (!rawPhone) {
    errors.telefono = 'El teléfono de contacto es obligatorio.';
  } else if (!rawPhone.startsWith('+')) {
    errors.telefono = 'Introduce el teléfono en formato internacional con prefijo (ej: +34 600 000 000).';
  } else if (rawPhone.length < 7 || rawPhone.length > 32 || !/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
    errors.telefono = 'Introduce un teléfono internacional válido (entre 7 y 15 dígitos tras el prefijo).';
  }

  const email = data.email.trim();
  if (email) {
    if (email.length > 254) {
      errors.email = 'El email no puede superar los 254 caracteres.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Introduce una dirección de correo válida.';
    }
  }

  const message = data.mensaje.trim();
  if (message && message.length > 2000) {
    errors.mensaje = 'El mensaje no puede superar los 2000 caracteres.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Normalizes and builds the strict JSON payload expected by POST /public/leads.
 * Strictly avoids unknown properties, tenantId, and oversized fields.
 */
export function buildLeadPayload(data: LeadFormData): LeadSubmissionPayload {
  const payload: LeadSubmissionPayload = {
    workshop: data.taller.trim(),
    contactName: data.nombre.trim(),
    phone: data.telefono.trim(),
    website: (data.website || '').trim().slice(0, 200),
  };

  const email = data.email.trim();
  if (email) {
    payload.email = email;
  }

  const message = data.mensaje.trim();
  if (message) {
    payload.message = message;
  }

  return payload;
}

/**
 * Computes a logical signature of material fields to determine whether
 * an attempt is a retry of the same data or a brand new independent submission.
 */
export function computeLogicalSignature(data: LeadFormData): string {
  return JSON.stringify({
    workshop: data.taller.trim(),
    contactName: data.nombre.trim(),
    phone: data.telefono.trim(),
    email: data.email.trim(),
    message: data.mensaje.trim(),
  });
}

/**
 * Generates an 8-200 char secure Idempotency-Key matching ^[A-Za-z0-9._:-]{8,200}$.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'bibendia-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
}

/**
 * Manages idempotency key stability across retries and rotation upon
 * successful submission or material form modification.
 */
export class IdempotencyTracker {
  private currentAttempt: { signature: string; key: string } | null = null;

  getKeyForAttempt(data: LeadFormData): string {
    const sig = computeLogicalSignature(data);
    if (this.currentAttempt && this.currentAttempt.signature === sig) {
      return this.currentAttempt.key;
    }
    const newKey = generateIdempotencyKey();
    this.currentAttempt = { signature: sig, key: newKey };
    return newKey;
  }

  onSuccess(): void {
    this.currentAttempt = null;
  }

  getCurrentKey(): string | null {
    return this.currentAttempt ? this.currentAttempt.key : null;
  }
}

/**
 * Resolves the backend lead API endpoint.
 * Checks runtime window.__BIBENDIA_PUBLIC_LEAD_API_URL__ (for test harnesses)
 * or build-time VITE_PUBLIC_LEAD_API_URL.
 * Returns null if not configured (fail closed).
 */
export function getLeadApiUrl(): string | null {
  const windowOverride = typeof window !== 'undefined'
    ? (window as unknown as { __BIBENDIA_PUBLIC_LEAD_API_URL__?: string }).__BIBENDIA_PUBLIC_LEAD_API_URL__
    : undefined;
  const envUrl = windowOverride || (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_PUBLIC_LEAD_API_URL;
  if (!envUrl || typeof envUrl !== 'string' || !envUrl.trim()) {
    return null;
  }
  const clean = envUrl.trim();
  return clean.endsWith('/public/leads') ? clean : `${clean.replace(/\/+$/, '')}/public/leads`;
}

/**
 * Submits the lead to POST /public/leads.
 * Adheres strictly to security/privacy requirements:
 * - No PII logging
 * - Fail closed if URL is not configured
 * - No tenantId or x-tenant-id headers
 * - Map HTTP status to clear, non-technical Spanish user messages
 */
export async function submitLead(
  data: LeadFormData,
  idempotencyKey: string,
  apiUrl?: string
): Promise<SubmissionResult> {
  const url = apiUrl ?? getLeadApiUrl();
  if (!url) {
    return {
      ok: false,
      error: 'API_NOT_CONFIGURED',
      userMessage: 'El servicio de solicitud de demo no está disponible en este momento. Por favor, inténtalo más tarde.',
    };
  }

  const payload = buildLeadPayload(data);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 202) {
      return {
        ok: true,
        statusCode: 202,
      };
    }

    if (response.status === 400) {
      return {
        ok: false,
        statusCode: 400,
        error: 'INVALID_REQUEST',
        userMessage: 'Por favor, revisa los datos introducidos en el formulario.',
      };
    }

    if (response.status === 413) {
      return {
        ok: false,
        statusCode: 413,
        error: 'PAYLOAD_TOO_LARGE',
        userMessage: 'El mensaje es demasiado largo. Por favor, acórtalo antes de enviar.',
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        statusCode: 429,
        error: 'RATE_LIMITED',
        userMessage: 'Has realizado demasiados intentos. Por favor, espera unos minutos antes de volver a intentarlo.',
      };
    }

    if (response.status === 503) {
      return {
        ok: false,
        statusCode: 503,
        error: 'SERVICE_UNAVAILABLE',
        userMessage: 'El servicio no está disponible temporalmente. Inténtalo de nuevo más tarde.',
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      error: 'UNEXPECTED_STATUS',
      userMessage: 'Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
    };
  } catch (_err) {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      userMessage: 'No se pudo contactar con BibendIA. Comprueba tu conexión a internet e inténtalo de nuevo.',
    };
  }
}
