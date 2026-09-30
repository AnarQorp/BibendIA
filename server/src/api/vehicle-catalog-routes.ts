import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';
import { listVehicleCatalogFacets, vehicleCatalogQuerySchema } from '../modules/vehicle-catalog/vehicle-catalog.js';

const paramsSchema = z.object({ tenantId: z.string().uuid() });

export function registerVehicleCatalogRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const auth = { config: { auth: { mode: 'authenticated' as const, audience: 'workshop' as const, principalKinds: ['workshop_user' as const] } } };
  app.get('/v1/workshop/tenants/:tenantId/vehicle-catalog/facets', auth, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params); const query = vehicleCatalogQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'INVALID_VEHICLE_CATALOG_QUERY', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const data = await inAuthorizedTenantTransaction(pool, { principal: request.principal, requestedTenantId: params.data.tenantId,
      capability: 'workshop:repair-knowledge:read', correlationId: request.id }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'workshop_read');
      return listVehicleCatalogFacets(client, query.data);
    });
    return { data, correlationId: request.id };
  });
}
