import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import type { PrincipalContext } from '../auth/principal.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';
import { createEstimateDraftFromRepairKnowledge, EstimateDraftError } from '../modules/repair-knowledge/estimate-draft.js';
import { editEstimateDraft, EstimateDraftEditingError, getEstimateDraft, listEstimateDrafts } from '../modules/repair-knowledge/estimate-draft-editing.js';
import { listRepairKnowledgeVehicleFacets, resolveRepairKnowledgeProgressively } from '../modules/repair-knowledge/repair-knowledge.js';

const tenantParams = z.object({ tenantId: z.string().uuid() });
const draftParams = tenantParams.extend({ draftId: z.string().uuid() });
const resolutionQuery = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  engineCode: z.string().trim().min(1).max(50).optional(),
  repairJobCode: z.string().trim().min(1).max(100),
  productionDate: z.string().date().optional(),
  variant: z.string().trim().min(1).max(100).optional(),
}).strict();
const facetsQuery = z.object({
  make: z.string().trim().min(1).max(100).optional(), model: z.string().trim().min(1).max(100).optional(),
  variant: z.string().trim().min(1).max(100).optional(), engineCode: z.string().trim().min(1).max(50).optional(),
  repairJobCode: z.string().trim().min(1).max(100).optional(),
}).strict();
const lineChange = z.object({
  id: z.string().uuid().optional(), mutationKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/).optional(),
  description: z.string().trim().min(1).max(500), itemType: z.enum(['PART_ROLE','CONSUMABLE','LABOR']),
  quantity: z.number().positive().max(100000).nullable(), unitPrice: z.number().nonnegative().max(9999999999.99).nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).nullable(), selected: z.boolean(),
}).strict().superRefine((line, context) => {
  if (!line.id && !line.mutationKey) context.addIssue({ code: 'custom', message: 'mutationKey is required for manual lines' });
  if (line.unitPrice !== null && line.currency === null) context.addIssue({ code: 'custom', message: 'currency is required with unitPrice' });
  if (line.unitPrice === null && line.currency !== null) context.addIssue({ code: 'custom', message: 'currency requires unitPrice' });
});
const patchBody = z.object({
  expectedVersion: z.number().int().positive(), idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  status: z.enum(['technical_draft','pending_approval','sent','approved']).optional(),
  lines: z.array(lineChange).max(100).optional(), deleteLineIds: z.array(z.string().uuid()).max(100).optional(),
}).strict().refine((value) => value.status !== undefined || (value.lines?.length ?? 0) > 0 || (value.deleteLineIds?.length ?? 0) > 0,
  { message: 'at least one change is required' });
const draftBody = z.object({
  vehicleId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  vehicle: z.object({
    make: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    engineCode: z.string().trim().min(1).max(50).optional(),
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
    const resolution = await resolveRepairKnowledgeProgressively(pool, query.data);
    if (!resolution) return reply.code(404).send({ error: 'REPAIR_KNOWLEDGE_NOT_APPLICABLE', correlationId: request.id });
    return { data: resolution, correlationId: request.id };
  });

  app.get('/v1/workshop/tenants/:tenantId/repair-knowledge/vehicle-facets', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params); const query = facetsQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'INVALID_REPAIR_KNOWLEDGE_FACETS_QUERY', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    await authorize(pool, request.principal, params.data.tenantId, 'workshop:repair-knowledge:read', request.id);
    return { data: await listRepairKnowledgeVehicleFacets(pool, query.data), correlationId: request.id };
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
        : error.code === 'REPAIR_KNOWLEDGE_DISAMBIGUATION_REQUIRED' ? 409
        : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'VEHICLE_DESCRIPTOR_MISMATCH' ? 409 : 400;
      return reply.code(status).send({ error: error.code, correlationId: request.id });
    }
  });

  app.get('/v1/workshop/tenants/:tenantId/estimate-drafts', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_ESTIMATE_DRAFT_QUERY', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const data = await inAuthorizedTenantTransaction(pool, { principal: request.principal, requestedTenantId: params.data.tenantId,
      capability: 'workshop:estimate-drafts:read', correlationId: request.id },
    async (client, context) => { await assertTenantOperation(client, context.tenantId, 'workshop_read'); return listEstimateDrafts(client); });
    return { data, correlationId: request.id };
  });

  app.get('/v1/workshop/tenants/:tenantId/estimate-drafts/:draftId', auth, async (request, reply) => {
    const params = draftParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_ESTIMATE_DRAFT_QUERY', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    try {
      const data = await inAuthorizedTenantTransaction(pool, { principal: request.principal, requestedTenantId: params.data.tenantId,
        capability: 'workshop:estimate-drafts:read', correlationId: request.id },
      async (client, context) => { await assertTenantOperation(client, context.tenantId, 'workshop_read'); return getEstimateDraft(client, params.data.draftId); });
      return { data, correlationId: request.id };
    } catch (error) { return editingError(error, reply, request.id); }
  });

  app.patch('/v1/workshop/tenants/:tenantId/estimate-drafts/:draftId', auth, async (request, reply) => {
    const params = draftParams.safeParse(request.params); const body = patchBody.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'INVALID_ESTIMATE_DRAFT_PATCH', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    try {
      const data = await inAuthorizedTenantTransaction(pool, { principal: request.principal, requestedTenantId: params.data.tenantId,
        capability: 'workshop:estimate-drafts:update', correlationId: request.id }, async (client, context) => {
          await assertTenantOperation(client, context.tenantId, 'domain_mutation');
          return editEstimateDraft(client, context.tenantId, params.data.draftId, body.data);
        });
      return { data, correlationId: request.id };
    } catch (error) { return editingError(error, reply, request.id); }
  });
}

async function authorize(pool: pg.Pool, principal: PrincipalContext,
  tenantId: string, capability: 'workshop:repair-knowledge:read' | 'workshop:estimate-drafts:create', correlationId: string): Promise<void> {
  await inAuthorizedTenantTransaction(pool, { principal, requestedTenantId: tenantId, capability, correlationId },
    async (client, context) => { await assertTenantOperation(client, context.tenantId, 'workshop_read'); });
}

function editingError(error: unknown, reply: any, correlationId: string) {
  if (!(error instanceof EstimateDraftEditingError)) throw error;
  const status = error.code === 'ESTIMATE_DRAFT_NOT_FOUND' ? 404
    : error.code === 'ESTIMATE_VERSION_CONFLICT' || error.code === 'ESTIMATE_MUTATION_CONFLICT' ||
      error.code === 'ESTIMATE_STATUS_TRANSITION_INVALID' || error.code === 'ESTIMATE_DRAFT_NOT_EDITABLE' ||
      error.code === 'RK_LINE_DELETE_FORBIDDEN' ? 409 : 400;
  return reply.code(status).send({ error: error.code, correlationId });
}
