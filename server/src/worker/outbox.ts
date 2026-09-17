import type pg from 'pg';
import { inTenantTransaction } from '../persistence/pool.js';

export async function claimOutboxBatch(pool: pg.Pool, tenantId: string, limit = 20) {
  return inTenantTransaction(pool, tenantId, async (client) => {
    const result = await client.query(
      `UPDATE outbox_events SET lease_until=now()+interval '30 seconds', attempts=attempts+1
       WHERE id IN (SELECT id FROM outbox_events WHERE tenant_id=$1 AND published_at IS NULL
         AND (lease_until IS NULL OR lease_until<now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $2)
       RETURNING *`, [tenantId, limit],
    );
    return result.rows;
  });
}
