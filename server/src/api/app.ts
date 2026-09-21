import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import secureJson from 'secure-json-parse';
import type pg from 'pg';
import { z } from 'zod';
import { executeAppointmentTool } from '../modules/agent-core/appointment-tool.js';
import { DenyAllAuthenticationAdapter, type AuthenticationAdapter } from '../auth/authentication-adapter.js';
import { registerAuthenticationBoundary } from '../auth/authentication-boundary.js';
import { inAuthorizedTenantTransaction, TenantAuthorizationError } from '../auth/tenant-authorization.js';
import { ProviderAuthenticationAdapter, type ProviderIngressConfig } from '../auth/provider-authentication-adapter.js';
import { claimInboxEvent, inAuthorizedProviderTransaction, ProviderAuthorizationError } from '../auth/provider-authorization.js';
import type { PrincipalContext, ServicePrincipal } from '../auth/principal.js';
import {
  assertTenantOperation, changeTenantLifecycle, operationDecision, readTenantControl,
  setTenantKillSwitch, TenantControlError,
} from '../modules/tenant-control/tenant-control.js';
import {
  PiiProtectionError, UnavailablePiiProtection, type PiiProtection,
} from '../security/pii-protection.js';
import { safeErrorAttributes } from '../security/safe-logging.js';

export type ApiSecurityOptions = {
  authentication?: AuthenticationAdapter;
  allowedOrigins?: readonly string[];
  providerIngress?: ProviderIngressConfig;
  piiProtection?: PiiProtection;
};

export function buildApi(pool: pg.Pool, options: ApiSecurityOptions = {}) {
  const app = Fastify({ logger: {
    redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-twilio-signature', 'req.headers.elevenlabs-signature'], censor: '[REDACTED]' },
  } });
  const pii = options.piiProtection ?? new UnavailablePiiProtection();
  const origins = new Set(options.allowedOrigins ?? ['http://127.0.0.1:3131']);
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || origins.has(origin)) });
  registerSignedBodyParsers(app);
  const baseAuthentication = options.authentication ?? new DenyAllAuthenticationAdapter();
  const authentication = options.providerIngress
    ? new ProviderAuthenticationAdapter(baseAuthentication, options.providerIngress)
    : baseAuthentication;
  registerAuthenticationBoundary(app, authentication);
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof TenantAuthorizationError) {
      return reply.code(error.code === 'AUTHENTICATION_EXPIRED' ? 401 : 403).send({ error: error.code });
    }
    if (error instanceof ProviderAuthorizationError) {
      return reply.code(403).send({ error: error.code });
    }
    if (error instanceof TenantControlError) {
      const conflict = ['INVALID_LIFECYCLE_TRANSITION', 'CONTROL_VERSION_CONFLICT', 'CONTROL_STATE_UNCHANGED'].includes(error.code);
      const locked = ['TENANT_NOT_OPERATIONAL', 'TENANT_DEACTIVATED', 'KILL_SWITCH_ENABLED'].includes(error.code);
      return reply.code(conflict ? 409 : locked ? 423 : 403).send({ error: error.code, correlationId: request.id });
    }
    if (error instanceof PiiProtectionError) {
      request.log.error({ ...safeErrorAttributes(error), correlationId: request.id }, 'PII operation failed closed');
      return reply.code(503).send({ error: 'PII_PROTECTION_UNAVAILABLE', correlationId: request.id });
    }
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_PROVIDER_PAYLOAD' });
    request.log.error({ ...safeErrorAttributes(error), correlationId: request.id }, 'request failed');
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });
  app.get('/health', { config: { auth: { mode: 'public' } } }, async () => ({ ok: true }));
  app.get('/v1/workshop/tenants/:tenantId/appointments', {
    config: { auth: { mode: 'authenticated', audience: 'workshop', principalKinds: ['workshop_user'] } },
  }, async (request, reply) => {
    const parsed = z.string().uuid().safeParse((request.params as { tenantId?: unknown }).tenantId);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_TENANT_SELECTOR' });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const rows = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal,
      requestedTenantId: parsed.data,
      capability: 'workshop:appointments:read',
      correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'workshop_read');
      const result = await client.query<ProtectedAppointmentRow>(
        `SELECT a.id,a.tenant_id,a.workshop_id,a.case_id,a.customer_id,a.vehicle_id,a.service_request,
          a.sensitive_details_ciphertext,a.sensitive_details_nonce,a.sensitive_details_auth_tag,a.sensitive_details_key_id,
          a.start_at,a.end_at,a.status,a.confirmation_evidence_ref,a.version,
          c.display_name_ciphertext AS customer_name_ciphertext,c.display_name_nonce AS customer_name_nonce,
          c.display_name_auth_tag AS customer_name_auth_tag,c.display_name_key_id AS customer_name_key_id,
          v.plate_ciphertext AS vehicle_plate_ciphertext,v.plate_nonce AS vehicle_plate_nonce,
          v.plate_auth_tag AS vehicle_plate_auth_tag,v.plate_key_id AS vehicle_plate_key_id
         FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN vehicles v ON v.id=a.vehicle_id
         WHERE a.tenant_id=$1 AND a.pii_migration_state='protected'
           AND c.pii_migration_state='protected' AND v.pii_migration_state='protected'
         ORDER BY a.start_at`, [context.tenantId],
      );
      return result.rows.map((row) => revealWorkshopAppointment(row, pii));
    });
    return { data: rows, correlationId: request.id };
  });
  app.get('/v1/platform/tenants/:tenantId/control', {
    config: { auth: { mode: 'authenticated', audience: 'platform', principalKinds: ['platform_user'] } },
  }, async (request, reply) => {
    const tenantId = tenantSelector(request.params);
    if (!tenantId) return reply.code(400).send({ error: 'INVALID_TENANT_SELECTOR' });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const control = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal, requestedTenantId: tenantId, capability: 'platform:tenant:read', correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'platform_read');
      return readTenantControl(client, context.tenantId);
    });
    return { data: control, correlationId: request.id };
  });
  app.get('/v1/platform/tenants/:tenantId/appointments', {
    config: { auth: { mode: 'authenticated', audience: 'platform', principalKinds: ['platform_user'] } },
  }, async (request, reply) => {
    const tenantId = tenantSelector(request.params);
    if (!tenantId) return reply.code(400).send({ error: 'INVALID_TENANT_SELECTOR' });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const data = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal, requestedTenantId: tenantId, capability: 'platform:activity:read', correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'platform_read');
      const result = await client.query(`SELECT id,workshop_id,case_id,start_at,end_at,status,version
        FROM appointments WHERE tenant_id=$1 ORDER BY start_at`, [context.tenantId]);
      return result.rows;
    });
    return { data, redacted: true, correlationId: request.id };
  });
  app.post('/v1/platform/tenants/:tenantId/lifecycle', {
    config: { auth: { mode: 'authenticated', audience: 'platform', principalKinds: ['platform_user'] } },
  }, async (request, reply) => {
    const tenantId = tenantSelector(request.params);
    if (!tenantId) return reply.code(400).send({ error: 'INVALID_TENANT_SELECTOR' });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const command = lifecycleCommandSchema.parse(request.body);
    const receipt = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal, requestedTenantId: tenantId, capability: 'platform:tenant:update', correlationId: request.id,
    }, (client, context) => changeTenantLifecycle(client, context, command));
    return { receipt, correlationId: request.id };
  });
  for (const enabled of [true, false]) {
    const operation = enabled ? 'enable' : 'disable';
    app.post(`/v1/platform/tenants/:tenantId/kill-switch/${operation}`, {
      config: { auth: { mode: 'authenticated', audience: 'platform', principalKinds: ['platform_user'] } },
    }, async (request, reply) => {
      const tenantId = tenantSelector(request.params);
      if (!tenantId) return reply.code(400).send({ error: 'INVALID_TENANT_SELECTOR' });
      if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
      const command = controlCommandSchema.parse(request.body);
      const receipt = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal, requestedTenantId: tenantId, capability: 'platform:kill-switch:manage', correlationId: request.id,
      }, (client, context) => setTenantKillSwitch(client, context, { ...command, enabled }));
      return { receipt, correlationId: request.id };
    });
  }
  app.post('/v1/providers/twilio/voice/events', {
    config: { rawBody: true, auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request, reply) => {
    const body = twilioEventSchema.parse(request.body);
    const principal = servicePrincipal(request.principal);
    if (principal.serviceType !== 'telephony_provider') return reply.code(403).send({ error: 'PRINCIPAL_NOT_ALLOWED' });
    const correlationId = `twilio:${body.CallSid}`;
    const ingress = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'twilio', calledEndpoint: body.To, correlationId,
    }, async (client, context) => {
      const disposition = await claimInboxEvent(client, {
        context, principal, provider: 'twilio',
        externalEventId: `${body.CallSid}:${body.CallStatus ?? 'voice'}:${body.SequenceNumber ?? '0'}`,
        rawBody: canonicalJson(request.body),
      });
      const control = await readTenantControl(client, context.tenantId);
      return { disposition, decision: operationDecision(control, 'conversation_start') };
    });
    return reply.code(200).send({ ok: true, ...ingress, fallbackRequired: !ingress.decision.allowed, correlationId });
  });
  app.post('/v1/providers/elevenlabs/conversations/events', {
    config: { rawBody: true, auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request, reply) => {
    const body = elevenLabsEventSchema.parse(request.body);
    const principal = servicePrincipal(request.principal);
    if (principal.serviceType !== 'voice_provider' || body.data.agent_id !== principal.externalAccountId) {
      return reply.code(403).send({ error: 'PROVIDER_NOT_ALLOWED' });
    }
    const correlationId = `elevenlabs:${body.data.conversation_id}`;
    const ingress = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'elevenlabs', correlationId,
    }, async (client, context) => {
      const disposition = await claimInboxEvent(client, {
        context, principal, provider: 'elevenlabs',
        externalEventId: `${body.type}:${body.data.conversation_id}:${body.event_timestamp}`,
        rawBody: request.rawBody?.toString() ?? '',
        eventOccurredAt: new Date(Number(body.event_timestamp) * 1000),
      });
      const control = await readTenantControl(client, context.tenantId);
      return { disposition, operational: operationDecision(control, 'conversation_start').allowed };
    });
    return reply.code(200).send({ ok: true, ...ingress, correlationId });
  });
  app.post('/v1/providers/elevenlabs/tools/create-appointment', {
    config: { rawBody: true, auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request, reply) => {
    const principal = servicePrincipal(request.principal);
    if (principal.serviceType !== 'voice_provider') return reply.code(403).send({ error: 'PRINCIPAL_NOT_ALLOWED' });
    const input = request.body as { providerCallId?: unknown };
    if (typeof input?.providerCallId !== 'string') return reply.code(400).send({ error: 'INVALID_PROVIDER_CALL_ID' });
    const correlationId = `elevenlabs:${input.providerCallId}`;
    const authorized = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'elevenlabs', correlationId,
    }, async (client, tenantContext) => {
      await claimInboxEvent(client, {
        context: tenantContext, principal, provider: 'elevenlabs',
        externalEventId: `tool:create-appointment:${input.providerCallId}`,
        rawBody: canonicalJson(request.body),
      });
      const control = await readTenantControl(client, tenantContext.tenantId);
      return { context: tenantContext, decision: operationDecision(control, 'domain_mutation') };
    });
    if (!authorized.decision.allowed) return reply.code(423).send({
      ok: false, code: authorized.decision.code, fallbackRequired: true,
      safeMessage: 'La automatización está pausada; dejaré el caso para atención humana.', correlationId,
    });
    try { return await executeAppointmentTool(pool, authorized.context, request.body, pii); }
    catch (error) {
      if (error instanceof TenantControlError) return reply.code(423).send({
        ok: false, code: error.code, fallbackRequired: true,
        safeMessage: 'La automatización está pausada; dejaré el caso para atención humana.', correlationId,
      });
      if (error instanceof PiiProtectionError) {
        request.log.error({ ...safeErrorAttributes(error), correlationId }, 'PII operation failed closed');
        return reply.code(503).send({ ok: false, code: 'PII_PROTECTION_UNAVAILABLE',
          safeMessage: 'No puedo procesar datos personales de forma segura; dejaré el caso para atención humana.', correlationId });
      }
      request.log.error({ ...safeErrorAttributes(error), correlationId }, 'appointment tool failed');
      return reply.code(400).send({ok:false,code:'VALIDATION',safeMessage:'No pude validar los datos; dejaré el caso para atención humana.'});
    }
  });
  return app;
}

function registerSignedBodyParsers(app: FastifyInstance): void {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const raw = typeof body === 'string' ? body : body.toString('utf8');
    request.rawBody = raw;
    try { done(null, secureJson.parse(raw)); }
    catch (error) { done(error as Error); }
  });
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (request, body, done) => {
    const raw = typeof body === 'string' ? body : body.toString('utf8');
    request.rawBody = raw;
    try { done(null, parseFormBody(raw)); }
    catch (error) { done(error as Error); }
  });
}

function parseFormBody(raw: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(raw)) {
    const current = result[key];
    result[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
  }
  return result;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const twilioEventSchema = z.object({
  AccountSid: z.string().min(1), CallSid: z.string().min(1), To: z.string().regex(/^\+[1-9]\d{6,14}$/),
  From: z.string().optional(), CallStatus: z.string().optional(), SequenceNumber: z.string().optional(),
}).passthrough();

const elevenLabsEventSchema = z.object({
  type: z.literal('post_call_transcription'),
  event_timestamp: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
  data: z.object({ agent_id: z.string().min(1), conversation_id: z.string().min(1) }).passthrough(),
}).passthrough();

const controlCommandSchema = z.object({
  reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().min(8).max(200), expectedVersion: z.number().int().positive(),
}).strict();
const lifecycleCommandSchema = controlCommandSchema.extend({
  target: z.enum(['provisioning', 'pilot', 'active', 'suspended', 'deactivated']),
}).strict();

function tenantSelector(params: unknown): string | null {
  const parsed = z.string().uuid().safeParse((params as { tenantId?: unknown })?.tenantId);
  return parsed.success ? parsed.data : null;
}

function servicePrincipal(principal: PrincipalContext | null): ServicePrincipal {
  if (!principal || principal.kind !== 'service') throw new ProviderAuthorizationError('PROVIDER_NOT_ALLOWED');
  return principal;
}

type ProtectedAppointmentRow = {
  id: string; tenant_id: string; workshop_id: string; case_id: string; customer_id: string; vehicle_id: string;
  service_request: Record<string, unknown>;
  sensitive_details_ciphertext: Buffer; sensitive_details_nonce: Buffer; sensitive_details_auth_tag: Buffer; sensitive_details_key_id: string;
  customer_name_ciphertext: Buffer; customer_name_nonce: Buffer; customer_name_auth_tag: Buffer; customer_name_key_id: string;
  vehicle_plate_ciphertext: Buffer; vehicle_plate_nonce: Buffer; vehicle_plate_auth_tag: Buffer; vehicle_plate_key_id: string;
  start_at: Date; end_at: Date; status: string; confirmation_evidence_ref: string; version: number;
};

function revealWorkshopAppointment(row: ProtectedAppointmentRow, pii: PiiProtection) {
  const sensitive = JSON.parse(pii.reveal(row.tenant_id, 'appointment.sensitive_details', {
    ciphertext: row.sensitive_details_ciphertext, nonce: row.sensitive_details_nonce,
    authTag: row.sensitive_details_auth_tag, keyId: row.sensitive_details_key_id,
  })) as { symptoms: string[]; notes?: string };
  return {
    id: row.id, tenant_id: row.tenant_id, workshop_id: row.workshop_id, case_id: row.case_id,
    customer_id: row.customer_id, vehicle_id: row.vehicle_id,
    service_request: { ...row.service_request, symptoms: sensitive.symptoms, notes: sensitive.notes },
    start_at: row.start_at, end_at: row.end_at, status: row.status,
    confirmation_evidence_ref: row.confirmation_evidence_ref, version: row.version,
    customer_name: pii.reveal(row.tenant_id, 'customer.display_name', {
      ciphertext: row.customer_name_ciphertext, nonce: row.customer_name_nonce,
      authTag: row.customer_name_auth_tag, keyId: row.customer_name_key_id,
    }),
    vehicle_plate: pii.reveal(row.tenant_id, 'vehicle.plate', {
      ciphertext: row.vehicle_plate_ciphertext, nonce: row.vehicle_plate_nonce,
      authTag: row.vehicle_plate_auth_tag, keyId: row.vehicle_plate_key_id,
    }),
  };
}
