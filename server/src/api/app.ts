import Fastify from 'fastify';
import cors from '@fastify/cors';
import type pg from 'pg';
import { z } from 'zod';
import { executeAppointmentTool } from '../modules/agent-core/appointment-tool.js';
import { DenyAllAuthenticationAdapter, type AuthenticationAdapter } from '../auth/authentication-adapter.js';
import { registerAuthenticationBoundary } from '../auth/authentication-boundary.js';
import { inAuthorizedTenantTransaction, TenantAuthorizationError } from '../auth/tenant-authorization.js';

export type ApiSecurityOptions = {
  authentication?: AuthenticationAdapter;
  allowedOrigins?: readonly string[];
};

export function buildApi(pool: pg.Pool, options: ApiSecurityOptions = {}) {
  const app = Fastify({ logger: true });
  const origins = new Set(options.allowedOrigins ?? ['http://127.0.0.1:3131']);
  app.register(cors, { origin: (origin, callback) => callback(null, !origin || origins.has(origin)) });
  registerAuthenticationBoundary(app, options.authentication ?? new DenyAllAuthenticationAdapter());
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof TenantAuthorizationError) {
      return reply.code(error.code === 'AUTHENTICATION_EXPIRED' ? 401 : 403).send({ error: error.code });
    }
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
  app.post('/v1/voice/tools/create-appointment', {
    config: { auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request, reply) => {
    try { return await executeAppointmentTool(pool, request.body); }
    catch (error) { request.log.error(error); return reply.code(400).send({ok:false,code:'VALIDATION',safeMessage:'No pude validar los datos; dejaré el caso para atención humana.'}); }
  });
  return app;
}
