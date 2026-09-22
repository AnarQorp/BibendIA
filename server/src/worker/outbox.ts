import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { inTenantTransaction } from '../persistence/pool.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';

export type OutboxState = 'not_attempted' | 'in_progress' | 'succeeded' | 'failed_safe_to_retry' | 'unknown_outcome' | 'dead_letter';
export interface ClaimedOutboxEvent extends Record<string, unknown> {
  id: number; tenant_id: string; event_type: string; aggregate_id: string; payload_jsonb: Record<string, unknown>;
  lease_token: string; lease_owner: string; attempts: number; max_attempts: number; external_idempotency_key: string;
}
export type EffectResult =
  | { outcome: 'succeeded'; receiptRef: string; evidence?: Record<string, string | number | boolean> }
  | { outcome: 'failed_safe_to_retry'; code: string }
  | { outcome: 'permanent_failure'; code: string }
  | { outcome: 'unknown_outcome'; code: string; evidence?: Record<string, string | number | boolean> };
export type ReconciliationResult =
  | { outcome: 'confirmed_succeeded'; receiptRef: string; evidence?: Record<string, string | number | boolean> }
  | { outcome: 'confirmed_failed'; code: string; safeToRetry: boolean }
  | { outcome: 'still_unknown'; code: string };

export interface OutboxEffectAdapter {
  execute(event: ClaimedOutboxEvent, idempotencyKey: string, signal: AbortSignal): Promise<EffectResult>;
  reconcile?(event: ClaimedOutboxEvent, idempotencyKey: string): Promise<ReconciliationResult>;
}

const retrySeconds = (attempt: number) => Math.min(300, 2 ** Math.min(attempt, 8));
const safeCode = (value: string) => /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : 'UNSAFE_ERROR_CLASSIFICATION';
const safeReference = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/.test(value);
const evidenceKeys = new Set(['requestId', 'eventId', 'receiptId', 'provider', 'status']);
function minimizedEvidence(value?: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value ?? {})) {
    if (!evidenceKeys.has(key)) continue;
    if (typeof item === 'string' && (!safeReference(item) || item.length > 200)) continue;
    result[key] = item;
  }
  return result;
}

export async function listWorkerTenantIds(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_worker');
    const result = await client.query<{ tenant_id: string }>('SELECT tenant_id FROM list_worker_tenant_ids()');
    await client.query('COMMIT');
    return result.rows.map((row) => row.tenant_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function claimOutboxBatch(pool: pg.Pool, tenantId: string, limit = 20, workerId = 'worker') {
  return inTenantTransaction(pool, tenantId, async (client) => {
    // Expired claims that never crossed the effect boundary are safe to reclaim. Once an effect
    // started, expiry means uncertainty and requires reconciliation/manual intervention.
    await client.query(
      `UPDATE outbox_events SET delivery_state=CASE WHEN effect_started_at IS NULL THEN 'not_attempted' ELSE 'unknown_outcome' END,
         reconciliation_required=(effect_started_at IS NOT NULL), lease_owner=NULL,lease_token=NULL,lease_started_at=NULL,lease_until=NULL,
         last_error_code=CASE WHEN effect_started_at IS NULL THEN last_error_code ELSE 'LEASE_EXPIRED_AFTER_EFFECT_START' END,
         last_error_at=CASE WHEN effect_started_at IS NULL THEN last_error_at ELSE now() END,
         effect_started_at=NULL
       WHERE tenant_id=$1 AND delivery_state='in_progress' AND lease_until < now()`, [tenantId],
    );
    await client.query(`UPDATE outbox_events SET delivery_state='dead_letter',dead_lettered_at=now(),
      last_error_code='EVENT_OBSOLETE',last_error_at=now(),next_attempt_at=NULL
      WHERE tenant_id=$1 AND delivery_state IN ('not_attempted','failed_safe_to_retry') AND effect_valid_until<=now()`, [tenantId]);
    const token = randomUUID();
    const result = await client.query<ClaimedOutboxEvent>(
      `UPDATE outbox_events SET delivery_state='in_progress',lease_owner=$3,lease_token=$4,
         lease_started_at=now(),lease_until=now()+interval '30 seconds',effect_started_at=NULL
       WHERE id IN (SELECT o.id FROM outbox_events o JOIN tenants t ON t.id=o.tenant_id
         WHERE o.tenant_id=$1 AND o.delivery_state IN ('not_attempted','failed_safe_to_retry')
         AND (o.next_attempt_at IS NULL OR o.next_attempt_at<=now())
         AND o.effect_valid_until>now()
         AND t.lifecycle_status IN ('pilot','active') AND t.kill_switch_enabled=false
         ORDER BY o.occurred_at,o.id FOR UPDATE OF o SKIP LOCKED LIMIT $2)
       RETURNING *`, [tenantId, limit, workerId, token],
    );
    return result.rows;
  }, 'bibendia_worker');
}

async function withTenantEffectLock<T>(pool: pg.Pool, tenantId: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock_shared(hashtextextended($1::text,271828))", [tenantId]);
    return await work(client);
  } finally {
    await client.query("SELECT pg_advisory_unlock_shared(hashtextextended($1::text,271828))", [tenantId]).catch(() => undefined);
    client.release();
  }
}

async function effectTransaction<T>(client: pg.PoolClient, tenantId: string, work: () => Promise<T>): Promise<T> {
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_worker');
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function dispatchClaimedOutboxEvent(
  pool: pg.Pool, tenantId: string, eventId: number, leaseToken: string, adapter: OutboxEffectAdapter,
  signal = new AbortController().signal,
): Promise<OutboxState> {
  return withTenantEffectLock(pool, tenantId, async (client) => {
    const event = await effectTransaction(client, tenantId, async () => {
      const row = await client.query<ClaimedOutboxEvent>(
        `SELECT * FROM outbox_events WHERE tenant_id=$1 AND id=$2 AND delivery_state='in_progress'
         AND lease_token=$3 AND lease_until>now() FOR UPDATE`, [tenantId, eventId, leaseToken],
      );
      if (row.rowCount !== 1) throw new Error('OUTBOX_EVENT_NOT_CLAIMED');
      await assertTenantOperation(client, tenantId, 'external_effect');
      await client.query(`UPDATE outbox_events SET attempts=attempts+1,last_attempt_at=now(),effect_started_at=now()
        WHERE tenant_id=$1 AND id=$2`, [tenantId, eventId]);
      row.rows[0].attempts += 1;
      return row.rows[0];
    });

    let result: EffectResult;
    try {
      result = await adapter.execute(event, event.external_idempotency_key, signal);
    } catch {
      result = { outcome: 'unknown_outcome', code: 'EFFECT_TRANSPORT_INTERRUPTED' };
    }
    if (result.outcome === 'succeeded' && !safeReference(result.receiptRef)) {
      result = { outcome: 'unknown_outcome', code: 'INVALID_PROVIDER_RECEIPT' };
    }

    return effectTransaction(client, tenantId, async () => {
      const locked = await client.query<ClaimedOutboxEvent>(
        `SELECT * FROM outbox_events WHERE tenant_id=$1 AND id=$2 AND delivery_state='in_progress'
         AND lease_token=$3 FOR UPDATE`, [tenantId, eventId, leaseToken],
      );
      if (locked.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST_AFTER_EFFECT');
      const attempts = locked.rows[0].attempts;
      if (result.outcome === 'succeeded') {
        await client.query(`UPDATE outbox_events SET delivery_state='succeeded',published_at=now(),completed_at=now(),
          receipt_ref=$4,evidence_jsonb=$5,reconciliation_required=false,effect_started_at=NULL,lease_owner=NULL,lease_token=NULL,lease_started_at=NULL,lease_until=NULL
          WHERE tenant_id=$1 AND id=$2 AND lease_token=$3`, [tenantId, eventId, leaseToken, result.receiptRef, JSON.stringify(minimizedEvidence(result.evidence))]);
        return 'succeeded';
      }
      if (result.outcome === 'unknown_outcome') {
        await client.query(`UPDATE outbox_events SET delivery_state='unknown_outcome',last_error_code=$4,last_error_at=now(),
          evidence_jsonb=$5,reconciliation_required=true,effect_started_at=NULL,lease_owner=NULL,lease_token=NULL,lease_started_at=NULL,lease_until=NULL
          WHERE tenant_id=$1 AND id=$2 AND lease_token=$3`, [tenantId, eventId, leaseToken, safeCode(result.code), JSON.stringify(minimizedEvidence(result.evidence))]);
        return 'unknown_outcome';
      }
      const dead = result.outcome === 'permanent_failure' || attempts >= locked.rows[0].max_attempts;
      await client.query(`UPDATE outbox_events SET delivery_state=$4,last_error_code=$5,last_error_at=now(),
        next_attempt_at=CASE WHEN $4='failed_safe_to_retry' THEN now()+($6::text || ' seconds')::interval ELSE NULL END,
        dead_lettered_at=CASE WHEN $4='dead_letter' THEN now() ELSE NULL END,
        effect_started_at=NULL,lease_owner=NULL,lease_token=NULL,lease_started_at=NULL,lease_until=NULL
        WHERE tenant_id=$1 AND id=$2 AND lease_token=$3`,
      [tenantId, eventId, leaseToken, dead ? 'dead_letter' : 'failed_safe_to_retry', safeCode(result.code), retrySeconds(attempts)]);
      return dead ? 'dead_letter' : 'failed_safe_to_retry';
    });
  });
}

export async function reconcileOutboxEvent(
  pool: pg.Pool, tenantId: string, eventId: number, adapter: OutboxEffectAdapter,
): Promise<OutboxState> {
  if (!adapter.reconcile) return 'unknown_outcome';
  const snapshot = await inTenantTransaction(pool, tenantId, async (client) => {
    const result = await client.query<ClaimedOutboxEvent>(
      `SELECT * FROM outbox_events WHERE tenant_id=$1 AND id=$2 AND delivery_state='unknown_outcome'`, [tenantId, eventId],
    );
    if (result.rowCount !== 1) throw new Error('OUTBOX_NOT_RECONCILABLE');
    return result.rows[0];
  }, 'bibendia_worker');
  let result = await adapter.reconcile(snapshot, snapshot.external_idempotency_key);
  if (result.outcome === 'confirmed_succeeded' && !safeReference(result.receiptRef)) {
    result = { outcome: 'still_unknown', code: 'INVALID_PROVIDER_RECEIPT' };
  }
  return inTenantTransaction(pool, tenantId, async (client) => {
    if (result.outcome === 'confirmed_succeeded') {
      await client.query(`UPDATE outbox_events SET delivery_state='succeeded',published_at=now(),completed_at=now(),receipt_ref=$3,
        evidence_jsonb=$4,reconciliation_required=false,reconciliation_checked_at=now(),reconciliation_attempts=reconciliation_attempts+1
        WHERE tenant_id=$1 AND id=$2 AND delivery_state='unknown_outcome'`,
      [tenantId, eventId, result.receiptRef, JSON.stringify(minimizedEvidence(result.evidence))]);
      return 'succeeded';
    }
    if (result.outcome === 'confirmed_failed') {
      const state = result.safeToRetry ? 'failed_safe_to_retry' : 'dead_letter';
      await client.query(`UPDATE outbox_events SET delivery_state=$3,last_error_code=$4,last_error_at=now(),
        next_attempt_at=CASE WHEN $3='failed_safe_to_retry' THEN now()+interval '2 seconds' ELSE NULL END,
        dead_lettered_at=CASE WHEN $3='dead_letter' THEN now() ELSE NULL END,reconciliation_required=false,
        reconciliation_checked_at=now(),reconciliation_attempts=reconciliation_attempts+1 WHERE tenant_id=$1 AND id=$2`,
      [tenantId, eventId, state, safeCode(result.code)]);
      return state as OutboxState;
    }
    await client.query(`UPDATE outbox_events SET last_error_code=$3,last_error_at=now(),reconciliation_checked_at=now(),
      reconciliation_attempts=reconciliation_attempts+1 WHERE tenant_id=$1 AND id=$2`, [tenantId, eventId, safeCode(result.code)]);
    return 'unknown_outcome';
  }, 'bibendia_worker');
}
