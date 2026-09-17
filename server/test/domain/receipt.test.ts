import { describe, expect, it } from 'vitest';
import { mayClaimExternalSuccess } from '../../src/domain/receipt.js';

describe('external action truthfulness', () => {
  it('only permits success claims with a succeeded receipt and evidence', () => {
    const base = { actionIntentId: 'action-1', idempotencyKey: 'idem-1', occurredAt: new Date().toISOString() };

    expect(mayClaimExternalSuccess({ ...base, outcome: 'succeeded', evidenceRef: 'provider:vapi:event-1' })).toBe(true);
    expect(mayClaimExternalSuccess({ ...base, outcome: 'succeeded' })).toBe(false);
    expect(mayClaimExternalSuccess({ ...base, outcome: 'unknown_outcome', evidenceRef: 'request-only' })).toBe(false);
    expect(mayClaimExternalSuccess({ ...base, outcome: 'failed', evidenceRef: 'failure' })).toBe(false);
  });
});
