import { describe, expect, it } from 'vitest';
import { evaluateRepairKnowledgeConfidence, type ConfidenceState } from '../../src/modules/repair-knowledge/confidence-policy.js';

const decide = (confidenceState: ConfidenceState, hasValidEvidence = true) => evaluateRepairKnowledgeConfidence({
  confidenceState, hasValidEvidence, bomClassification: confidenceState === 'DERIVED_FROM_KIT' ? 'DERIVED_FROM_KIT' : 'TECHNICAL_RULE',
  requirementType: 'REQUIRED',
});

describe('RK01 centralized confidence policy', () => {
  it.each(['VERIFIED_OEM', 'VERIFIED_MANUFACTURER', 'MULTI_SOURCE_VERIFIED'] as const)('%s is automation eligible with valid evidence', (state) => {
    expect(decide(state)).toMatchObject({ automationEligible: true, manualReviewRequired: false });
  });

  it('does not turn kit derivation into an automatic technical obligation', () => {
    expect(decide('DERIVED_FROM_KIT')).toMatchObject({ automationEligible: false, reason: 'DERIVED_FROM_KIT_REVIEW' });
  });

  it.each(['INFERRED', 'UNKNOWN'] as const)('%s requires manual review', (state) => {
    expect(decide(state)).toMatchObject({ automationEligible: false, manualReviewRequired: true });
  });

  it('cannot silently elevate a verified state without matching evidence', () => {
    expect(decide('VERIFIED_OEM', false)).toEqual({ automationEligible: false, manualReviewRequired: true, reason: 'EVIDENCE_REQUIRED' });
  });
});
