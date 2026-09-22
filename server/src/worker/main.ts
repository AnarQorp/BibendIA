import { createPool } from '../persistence/pool.js';
import { claimOutboxBatch, dispatchClaimedOutboxEvent, listWorkerTenantIds, type OutboxEffectAdapter } from './outbox.js';

// No external appointment publisher exists yet. Production must surface this as a permanent,
// inspectable failure rather than pretending that an integration ran.
const unavailableAdapter: OutboxEffectAdapter = {
  async execute() { return { outcome: 'permanent_failure', code: 'EFFECT_ADAPTER_NOT_CONFIGURED' }; },
};

const pool = createPool('worker');
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const abort = new AbortController();
let shuttingDown = false;

for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  shuttingDown = true;
  abort.abort();
});

try {
  for (const tenantId of await listWorkerTenantIds(pool)) {
    if (shuttingDown) break;
    const events = await claimOutboxBatch(pool, tenantId, 20, workerId);
    for (const event of events) {
      if (shuttingDown) break; // unstarted claims expire and are safely reclaimable.
      const adapter = event.event_type === 'appointment.created' ? unavailableAdapter : unavailableAdapter;
      await dispatchClaimedOutboxEvent(pool, tenantId, event.id, event.lease_token, adapter, abort.signal);
    }
  }
} finally {
  await pool.end();
}
