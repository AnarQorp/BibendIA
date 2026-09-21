import type pg from 'pg';
import { inTenantTransaction } from '../persistence/pool.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';

export async function claimOutboxBatch(pool: pg.Pool, tenantId: string, limit = 20) {
  return inTenantTransaction(pool, tenantId, async (client) => {
    const result = await client.query(
      `UPDATE outbox_events SET lease_until=now()+interval '30 seconds', attempts=attempts+1
       WHERE id IN (SELECT o.id FROM outbox_events o JOIN tenants t ON t.id=o.tenant_id
         WHERE o.tenant_id=$1 AND o.published_at IS NULL
         AND t.lifecycle_status IN ('pilot','active') AND t.kill_switch_enabled=false
         AND (o.lease_until IS NULL OR o.lease_until<now()) ORDER BY o.id FOR UPDATE OF o SKIP LOCKED LIMIT $2)
       RETURNING *`, [tenantId, limit],
    );
    return result.rows;
  }, 'bibendia_worker');
}

/**
 * Final external-effect gate. A tenant-scoped shared advisory lock spans the provider call, so a
 * lifecycle/kill command either commits first (and blocks this call) or waits until this effect is
 * durably marked published. P0.7 will add dispatch/retry/dead-letter orchestration around it.
 */
export async function publishClaimedOutboxEvent<T>(
  pool: pg.Pool,
  tenantId: string,
  eventId: number,
  effect: (event: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  return inTenantTransaction(pool, tenantId, async (client) => {
    const event = await client.query(
      `SELECT * FROM outbox_events WHERE tenant_id=$1 AND id=$2 AND published_at IS NULL
       AND lease_until > now() FOR UPDATE`, [tenantId, eventId],
    );
    if (event.rowCount !== 1) throw new Error('OUTBOX_EVENT_NOT_CLAIMED');
    await assertTenantOperation(client, tenantId, 'external_effect', 'share');
    const result = await effect(event.rows[0]);
    await client.query('UPDATE outbox_events SET published_at=now(),lease_until=NULL WHERE tenant_id=$1 AND id=$2', [tenantId, eventId]);
    return result;
  }, 'bibendia_worker');
}
