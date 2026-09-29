import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import type { PrincipalContext } from '../auth/principal.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';
import { createEstimateDraftFromRepairKnowledge, EstimateDraftError } from '../modules/repair-knowledge/estimate-draft.js';
import { resolveRepairKnowledge } from '../modules/repair-knowledge/repair-knowledge.js';

const tenantParams = z.object({ tenantId: z.string().uuid() });
const resolutionQuery = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  engineCode: z.string().trim().min(1).max(50),
  repairJobCode: z.string().trim().min(1).max(100),
  productionDate: z.string().date().optional(),
  variant: z.string().trim().min(1).max(100).optional(),
}).strict();
const draftBody = z.object({
  vehicleId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  vehicle: z.object({
    make: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    engineCode: z.string().trim().min(1).max(50),
    productionDate: z.string().date().optional(),
    variant: z.string().trim().min(1).max(100).optional(),
  }).strict(),
  repairJobCode: z.string().trim().min(1).max(100),
}).strict();

export function registerRepairKnowledgeRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const auth = { config: { auth: { mode: 'authenticated' as const, audience: 'workshop' as const, principalKinds: ['workshop_user' as const] } } };

  app.get('/v1/workshop/tenants/:tenantId/repair-knowledge/resolve', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const query = resolutionQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'INVALID_REPAIR_KNOWLEDGE_QUERY', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    await authorize(pool, request.principal, params.data.tenantId, 'workshop:repair-knowledge:read', request.id);
    const resolution = await resolveRepairKnowledge(pool, query.data);
    if (!resolution) return reply.code(404).send({ error: 'REPAIR_KNOWLEDGE_NOT_APPLICABLE', correlationId: request.id });
    return { data: resolution, correlationId: request.id };
  });

  app.post('/v1/workshop/tenants/:tenantId/estimate-drafts', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const body = draftBody.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'INVALID_ESTIMATE_DRAFT_COMMAND', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    await authorize(pool, request.principal, params.data.tenantId, 'workshop:estimate-drafts:create', request.id);
    try {
      const draft = await createEstimateDraftFromRepairKnowledge(pool, { tenantId: params.data.tenantId, ...body.data });
      return reply.code(201).send({ data: draft, correlationId: request.id });
    } catch (error) {
      if (!(error instanceof EstimateDraftError)) throw error;
      const status = error.code === 'REPAIR_KNOWLEDGE_NOT_APPLICABLE' || error.code === 'VEHICLE_NOT_FOUND' ? 404
        : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'VEHICLE_DESCRIPTOR_MISMATCH' ? 409 : 400;
      return reply.code(status).send({ error: error.code, correlationId: request.id });
    }
  });
}

async function authorize(pool: pg.Pool, principal: PrincipalContext,
  tenantId: string, capability: 'workshop:repair-knowledge:read' | 'workshop:estimate-drafts:create', correlationId: string): Promise<void> {
  await inAuthorizedTenantTransaction(pool, { principal, requestedTenantId: tenantId, capability, correlationId },
    async (client, context) => { await assertTenantOperation(client, context.tenantId, 'workshop_read'); });
}
