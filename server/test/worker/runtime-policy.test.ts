import { describe, expect, it } from 'vitest';
import type { WorkerRuntimeConfig } from '../../src/runtime/config.js';
import { workerCapability } from '../../src/worker/runtime.js';

const base: WorkerRuntimeConfig = {
  version: '1.0.0', commit: 'a'.repeat(40), mode: 'disabled', healthPort: 3101,
  shutdownTimeoutMs: 10000, workerId: 'test', pollIntervalMs: 1000,
};

describe('Worker production capability', () => {
  it('reports disabled and adapter-less modes as non-operational', () => {
    expect(workerCapability(base, new Map())).toEqual({ operational: false, eventTypes: [], code: 'WORKER_DISABLED' });
    expect(workerCapability({ ...base, mode: 'enabled', activationNotBefore: new Date() }, new Map())).toMatchObject({ operational: false, code: 'WORKER_ADAPTER_NOT_CONFIGURED' });
  });

  it('exposes only explicitly registered handlers', () => {
    const adapter = { async execute() { return { outcome: 'succeeded' as const, receiptRef: 'test:receipt' }; } };
    expect(workerCapability({ ...base, mode: 'enabled', activationNotBefore: new Date() }, new Map([
      ['public_lead.notification_requested', adapter],
    ]))).toEqual({ operational: true, eventTypes: ['public_lead.notification_requested'] });
  });
});
