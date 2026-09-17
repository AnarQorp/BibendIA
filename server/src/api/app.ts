import Fastify from 'fastify';
import cors from '@fastify/cors';
import type pg from 'pg';
import { inTenantTransaction } from '../persistence/pool.js';
import { executeAppointmentTool } from '../modules/agent-core/appointment-tool.js';

export function buildApi(pool: pg.Pool) {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: 'http://127.0.0.1:3131' });
  app.get('/health', async () => ({ ok: true }));
  app.get('/v1/appointments', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    if (typeof tenantId !== 'string') return reply.code(401).send({ error: 'TENANT_CONTEXT_REQUIRED' });
    const rows = await inTenantTransaction(pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT a.*, c.display_name AS customer_name, v.plate_ciphertext AS vehicle_plate
         FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN vehicles v ON v.id=a.vehicle_id
         WHERE a.tenant_id=$1 ORDER BY a.start_at`, [tenantId],
      );
      return result.rows;
    });
    return { data: rows };
  });
  app.post('/v1/voice/tools/create-appointment', async (request, reply) => {
    try { return await executeAppointmentTool(pool, request.body); }
    catch (error) { request.log.error(error); return reply.code(400).send({ok:false,code:'VALIDATION',safeMessage:'No pude validar los datos; dejaré el caso para atención humana.'}); }
  });
  return app;
}
