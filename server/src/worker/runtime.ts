import type pg from 'pg';
import type { WorkerRuntimeConfig } from '../runtime/config.js';
import { operationalLog } from '../runtime/logging.js';
import { claimOutboxBatch, dispatchClaimedOutboxEvent, listWorkerTenantIds, type OutboxEffectAdapter } from './outbox.js';

export type WorkerAdapterRegistry = ReadonlyMap<string, OutboxEffectAdapter>;
export type WorkerCapability = { operational: boolean; eventTypes: readonly string[]; code?: string };

export function workerCapability(config: WorkerRuntimeConfig, adapters: WorkerAdapterRegistry): WorkerCapability {
  if (config.mode === 'disabled') return { operational: false, eventTypes: [], code: 'WORKER_DISABLED' };
  if (!config.activationNotBefore || adapters.size === 0) return { operational: false, eventTypes: [], code: 'WORKER_ADAPTER_NOT_CONFIGURED' };
  return { operational: true, eventTypes: [...adapters.keys()].sort() };
}

export class WorkerDispatcher {
  private stopping = false;
  private running?: Promise<void>;
  constructor(private pool: pg.Pool, private config: WorkerRuntimeConfig, private adapters: WorkerAdapterRegistry) {}

  start(): void {
    if (this.running || !workerCapability(this.config, this.adapters).operational) return;
    this.running = this.loop();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.running;
  }

  async runOnce(): Promise<number> {
    const capability = workerCapability(this.config, this.adapters);
    if (!capability.operational) return 0;
    let processed = 0;
    for (const tenantId of await listWorkerTenantIds(this.pool)) {
      if (this.stopping) break;
      const events = await claimOutboxBatch(this.pool, tenantId, 20, this.config.workerId, {
        eventTypes: capability.eventTypes, occurredNotBefore: this.config.activationNotBefore,
      });
      for (const event of events) {
        if (this.stopping) break;
        const adapter = this.adapters.get(event.event_type);
        if (!adapter) continue;
        const state = await dispatchClaimedOutboxEvent(this.pool, tenantId, event.id, event.lease_token, adapter);
        processed += 1;
        operationalLog('info', 'worker', this.config, 'OUTBOX_EVENT_FINALIZED', { eventId: event.id, eventType: event.event_type, state });
      }
    }
    return processed;
  }

  private async loop(): Promise<void> {
    while (!this.stopping) {
      try { await this.runOnce(); }
      catch { operationalLog('error', 'worker', this.config, 'WORKER_DISPATCH_CYCLE_FAILED'); }
      if (!this.stopping) await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
    }
  }
}
