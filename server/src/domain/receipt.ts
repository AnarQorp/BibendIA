export type ActionOutcome = 'succeeded' | 'failed' | 'unknown_outcome';

export interface ActionReceipt<T> {
  outcome: ActionOutcome;
  actionIntentId: string;
  idempotencyKey: string;
  occurredAt: string;
  evidenceRef?: string;
  value?: T;
  safeMessage?: string;
}

export function mayClaimExternalSuccess(receipt: ActionReceipt<unknown>): boolean {
  return receipt.outcome === 'succeeded' && Boolean(receipt.evidenceRef);
}
