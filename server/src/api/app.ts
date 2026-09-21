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

export type ApiSecurityOptions = {
  authentication?: AuthenticationAdapter;
  allowedOrigins?: readonly string[];
  providerIngress?: ProviderIngressConfig;
};

export function buildApi(pool: pg.Pool, options: ApiSecurityOptions = {}) {
  const app = Fastify({ logger: true });
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
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_PROVIDER_PAYLOAD' });
    request.log.error(error);
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
      const result = await client.query(
        `SELECT a.*, c.display_name AS customer_name, v.plate_ciphertext AS vehicle_plate
         FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN vehicles v ON v.id=a.vehicle_id
         WHERE a.tenant_id=$1 ORDER BY a.start_at`, [context.tenantId],
      );
      return result.rows;
    });
    return { data: rows, correlationId: request.id };
  });
  app.post('/v1/providers/twilio/voice/events', {
    config: { rawBody: true, auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request, reply) => {
    const body = twilioEventSchema.parse(request.body);
    const principal = servicePrincipal(request.principal);
    if (principal.serviceType !== 'telephony_provider') return reply.code(403).send({ error: 'PRINCIPAL_NOT_ALLOWED' });
    const correlationId = `twilio:${body.CallSid}`;
    const disposition = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'twilio', calledEndpoint: body.To, correlationId,
    }, (client, context) => claimInboxEvent(client, {
      context, principal, provider: 'twilio',
      externalEventId: `${body.CallSid}:${body.CallStatus ?? 'voice'}:${body.SequenceNumber ?? '0'}`,
      rawBody: canonicalJson(request.body),
    }));
    return reply.code(200).send({ ok: true, disposition, correlationId });
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
    const disposition = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'elevenlabs', correlationId,
    }, (client, context) => claimInboxEvent(client, {
      context, principal, provider: 'elevenlabs',
      externalEventId: `${body.type}:${body.data.conversation_id}:${body.event_timestamp}`,
      rawBody: request.rawBody?.toString() ?? '',
      eventOccurredAt: new Date(Number(body.event_timestamp) * 1000),
    }));
    return reply.code(200).send({ ok: true, disposition, correlationId });
  });
  app.post('/v1/providers/elevenlabs/tools/create-appointment', {
    config: { rawBody: true, auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request, reply) => {
    const principal = servicePrincipal(request.principal);
    if (principal.serviceType !== 'voice_provider') return reply.code(403).send({ error: 'PRINCIPAL_NOT_ALLOWED' });
    const input = request.body as { providerCallId?: unknown };
    if (typeof input?.providerCallId !== 'string') return reply.code(400).send({ error: 'INVALID_PROVIDER_CALL_ID' });
    const correlationId = `elevenlabs:${input.providerCallId}`;
    const context = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'elevenlabs', correlationId,
    }, async (client, tenantContext) => {
      await claimInboxEvent(client, {
        context: tenantContext, principal, provider: 'elevenlabs',
        externalEventId: `tool:create-appointment:${input.providerCallId}`,
        rawBody: canonicalJson(request.body),
      });
      return tenantContext;
    });
    try { return await executeAppointmentTool(pool, context, request.body); }
    catch (error) { request.log.error(error); return reply.code(400).send({ok:false,code:'VALIDATION',safeMessage:'No pude validar los datos; dejaré el caso para atención humana.'}); }
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

function servicePrincipal(principal: PrincipalContext | null): ServicePrincipal {
  if (!principal || principal.kind !== 'service') throw new ProviderAuthorizationError('PROVIDER_NOT_ALLOWED');
  return principal;
}
