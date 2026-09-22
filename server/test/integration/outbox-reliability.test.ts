import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import {
  claimOutboxBatch, dispatchClaimedOutboxEvent, listWorkerTenantIds, reconcileOutboxEvent,
  type OutboxEffectAdapter,
} from '../../src/worker/outbox.js';

const pool = createPool('migrator');
const tenantA = randomUUID();
const tenantB = randomUUID();

async function enqueue(tenantId = tenantA, options: { maxAttempts?: number; occurredAt?: string; validUntil?: string } = {}) {
  return inTenantTransaction(pool, tenantId, async (client) => {
    const result = await client.query<{ id: number }>(`INSERT INTO outbox_events
      (tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb,max_attempts,occurred_at,effect_valid_until,
       external_idempotency_key,correlation_id)
      VALUES($1,'appointment',$2,'appointment.created',$3,$4,COALESCE($5::timestamptz,now()),
       COALESCE($6::timestamptz,now()+interval '24 hours'),$7,$8) RETURNING id`,
    [tenantId, randomUUID(), JSON.stringify({ appointmentId: randomUUID() }), options.maxAttempts ?? 3,
      options.occurredAt ?? null, options.validUntil ?? null, `appointment.created:${randomUUID()}`, `test:${randomUUID()}`]);
    return result.rows[0].id;
  });
}

async function row(tenantId: string, id: number) {
  return inTenantTransaction(pool, tenantId, async (client) =>
    (await client.query('SELECT * FROM outbox_events WHERE id=$1', [id])).rows[0], 'bibendia_worker');
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Outbox A','pilot'),($2,'Outbox B','pilot')", [tenantA, tenantB]);
});
beforeEach(async () => {
  await pool.query('DELETE FROM outbox_events WHERE tenant_id IN ($1,$2)', [tenantA, tenantB]);
  await pool.query("UPDATE tenants SET lifecycle_status='pilot',kill_switch_enabled=false WHERE id IN ($1,$2)", [tenantA, tenantB]);
});
afterAll(async () => {
  await pool.query('DELETE FROM outbox_events WHERE tenant_id IN ($1,$2)', [tenantA, tenantB]);
  await pool.query('DELETE FROM tenants WHERE id IN ($1,$2)', [tenantA, tenantB]);
  await pool.end();
});

describe('P0.7 Worker / Outbox reliability', () => {
  it('discovers tenants without bypassing event RLS and two workers cannot claim one event twice', async () => {
    await enqueue();
    expect(await listWorkerTenantIds(pool)).toEqual(expect.arrayContaining([tenantA, tenantB]));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE bibendia_worker');
      expect((await client.query('SELECT id FROM tenants')).rowCount).toBe(0);
      await client.query('ROLLBACK');
    } finally { client.release(); }
    const [left, right] = await Promise.all([
      claimOutboxBatch(pool, tenantA, 1, 'worker-left'), claimOutboxBatch(pool, tenantA, 1, 'worker-right'),
    ]);
    expect(left.length + right.length).toBe(1);
  });

  it('recovers an expired lease before effect start but marks expiry after start unknown', async () => {
    const safeId = await enqueue();
    await claimOutboxBatch(pool, tenantA, 1, 'crashed-before-effect');
    await pool.query("UPDATE outbox_events SET lease_until=now()-interval '1 second' WHERE id=$1", [safeId]);
    expect(await claimOutboxBatch(pool, tenantA, 1, 'recovery')).toHaveLength(1);

    const uncertainId = await enqueue();
    await claimOutboxBatch(pool, tenantA, 1, 'crashed-during-effect');
    await pool.query("UPDATE outbox_events SET last_attempt_at=now(),effect_started_at=now(),attempts=1,lease_until=now()-interval '1 second' WHERE id=$1", [uncertainId]);
    await claimOutboxBatch(pool, tenantA, 10, 'recovery');
    expect(await row(tenantA, uncertainId)).toMatchObject({ delivery_state: 'unknown_outcome', reconciliation_required: true });
  });

  it('safely recovers a later retry that crashes before its new effect starts', async () => {
    const id = await enqueue(tenantA, { maxAttempts: 3 });
    let [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'first-attempt');
    await dispatchClaimedOutboxEvent(pool, tenantA, id, claimed.lease_token, {
      async execute() { return { outcome: 'failed_safe_to_retry', code: 'PROVIDER_503' }; },
    });
    await pool.query('UPDATE outbox_events SET next_attempt_at=now() WHERE id=$1', [id]);
    [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'crashed-before-second-effect');
    expect(claimed).toBeTruthy();
    await pool.query("UPDATE outbox_events SET lease_until=now()-interval '1 second' WHERE id=$1", [id]);
    expect(await claimOutboxBatch(pool, tenantA, 1, 'safe-recovery')).toHaveLength(1);
    expect(await row(tenantA, id)).toMatchObject({ delivery_state: 'in_progress', attempts: 1, reconciliation_required: false });
  });

  it('never blind-retries an interrupted or post-effect/pre-commit unknown outcome', async () => {
    const id = await enqueue();
    const [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    let externallyExecuted = 0;
    const adapter: OutboxEffectAdapter = { async execute() { externallyExecuted += 1; throw new Error('timeout after send'); } };
    expect(await dispatchClaimedOutboxEvent(pool, tenantA, id, claimed.lease_token, adapter)).toBe('unknown_outcome');
    expect(externallyExecuted).toBe(1);
    expect(await claimOutboxBatch(pool, tenantA, 10, 'worker')).toHaveLength(0);
  });

  it('uses bounded retry/backoff and dead-letters permanent or exhausted failures', async () => {
    const retryId = await enqueue(tenantA, { maxAttempts: 2 });
    let [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    const retry: OutboxEffectAdapter = { async execute() { return { outcome: 'failed_safe_to_retry', code: 'PROVIDER_503' }; } };
    expect(await dispatchClaimedOutboxEvent(pool, tenantA, retryId, claimed.lease_token, retry)).toBe('failed_safe_to_retry');
    expect(await row(tenantA, retryId)).toMatchObject({ delivery_state: 'failed_safe_to_retry', attempts: 1, last_error_code: 'PROVIDER_503' });
    await pool.query('UPDATE outbox_events SET next_attempt_at=now() WHERE id=$1', [retryId]);
    [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    expect(await dispatchClaimedOutboxEvent(pool, tenantA, retryId, claimed.lease_token, retry)).toBe('dead_letter');

    const permanentId = await enqueue();
    [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    expect(await dispatchClaimedOutboxEvent(pool, tenantA, permanentId, claimed.lease_token, {
      async execute() { return { outcome: 'permanent_failure', code: 'UNSUPPORTED_DESTINATION' }; },
    })).toBe('dead_letter');
  });

  it('reconciles confirmed receipts and leaves unprovable results uncertain', async () => {
    const successId = await enqueue();
    let [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    const uncertain: OutboxEffectAdapter = {
      async execute() { return { outcome: 'unknown_outcome', code: 'TIMEOUT', evidence: { requestId: 'safe-id' } }; },
      async reconcile() { return { outcome: 'confirmed_succeeded', receiptRef: 'provider:receipt:safe-id', evidence: { status: 'accepted' } }; },
    };
    await dispatchClaimedOutboxEvent(pool, tenantA, successId, claimed.lease_token, uncertain);
    expect(await reconcileOutboxEvent(pool, tenantA, successId, uncertain)).toBe('succeeded');
    expect(await row(tenantA, successId)).toMatchObject({ delivery_state: 'succeeded', receipt_ref: 'provider:receipt:safe-id' });

    const unknownId = await enqueue();
    [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    const noProof: OutboxEffectAdapter = {
      async execute() { return { outcome: 'unknown_outcome', code: 'TIMEOUT' }; },
      async reconcile() { return { outcome: 'still_unknown', code: 'NO_QUERY_API' }; },
    };
    await dispatchClaimedOutboxEvent(pool, tenantA, unknownId, claimed.lease_token, noProof);
    expect(await reconcileOutboxEvent(pool, tenantA, unknownId, noProof)).toBe('unknown_outcome');
  });

  it('revalidates kill/lifecycle after claim, isolates tenants and does not fire obsolete work on resume', async () => {
    const a = await enqueue(tenantA);
    const b = await enqueue(tenantB);
    const [claimedA] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    await pool.query('UPDATE tenants SET kill_switch_enabled=true WHERE id=$1', [tenantA]);
    let calls = 0;
    await expect(dispatchClaimedOutboxEvent(pool, tenantA, a, claimedA.lease_token, {
      async execute() { calls += 1; return { outcome: 'succeeded', receiptRef: 'never' }; },
    })).rejects.toMatchObject({ code: 'KILL_SWITCH_ENABLED' });
    expect(calls).toBe(0);
    expect(await claimOutboxBatch(pool, tenantB, 1, 'worker-b')).toHaveLength(1);
    expect((await row(tenantB, b)).delivery_state).toBe('in_progress');

    await pool.query("UPDATE tenants SET kill_switch_enabled=false,lifecycle_status='suspended' WHERE id=$1", [tenantA]);
    expect(await claimOutboxBatch(pool, tenantA, 10, 'worker')).toHaveLength(0);
    await pool.query("UPDATE outbox_events SET delivery_state='not_attempted',lease_token=NULL,lease_owner=NULL,lease_until=NULL,effect_valid_until=now()-interval '1 second' WHERE id=$1", [a]);
    await pool.query("UPDATE tenants SET lifecycle_status='pilot' WHERE id=$1", [tenantA]);
    expect(await claimOutboxBatch(pool, tenantA, 10, 'worker')).toHaveLength(0);
    expect(await row(tenantA, a)).toMatchObject({ delivery_state: 'dead_letter', last_error_code: 'EVENT_OBSOLETE' });
  });

  it('stores only minimized references and safe codes in payload/error/evidence', async () => {
    const id = await enqueue();
    const [claimed] = await claimOutboxBatch(pool, tenantA, 1, 'worker');
    await dispatchClaimedOutboxEvent(pool, tenantA, id, claimed.lease_token, {
      async execute(event) {
        expect(event.payload_jsonb).toEqual({ appointmentId: expect.any(String) });
        return { outcome: 'unknown_outcome', code: 'SAFE_TIMEOUT', evidence: { requestId: 'opaque-123', customerName: 'Jane Doe' } };
      },
    });
    const persisted = JSON.stringify(await row(tenantA, id));
    expect(persisted).not.toContain('Jane');
    expect(persisted).not.toContain('+34');
    expect(persisted).not.toContain('1234ABC');
    expect((await row(tenantA, id)).evidence_jsonb).toEqual({ requestId: 'opaque-123' });
  });
});
