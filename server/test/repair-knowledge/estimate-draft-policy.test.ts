import { describe, expect, it } from 'vitest';
import { decideEstimateLine } from '../../src/modules/repair-knowledge/estimate-draft-policy.js';
import type { RepairKnowledgeEdge } from '../../src/modules/repair-knowledge/repair-knowledge.js';

const edge = (overrides: Partial<RepairKnowledgeEdge>): RepairKnowledgeEdge => ({
  code: 'EDGE_TEST', itemKind: 'PART_ROLE', partRole: { code: 'test', name: 'Test', category: 'COMPONENT' }, quantity: 1,
  requirementType: 'REQUIRED', bomClassification: 'TECHNICAL_RULE', confidenceState: 'VERIFIED_OEM', condition: null,
  replaceOnce: false, side: null, axle: null, position: null, notes: null, automationEligible: true,
  manualReviewRequired: false, confidenceReason: 'ELIGIBLE_VERIFIED', evidence: [], ...overrides,
});

describe('RK02 estimate line policy', () => {
  it.each(['VERIFIED_OEM', 'MULTI_SOURCE_VERIFIED'] as const)('auto-includes REQUIRED + %s', (confidenceState) => {
    expect(decideEstimateLine(edge({ confidenceState }))).toEqual({ automationStatus: 'AUTO_INCLUDED', selected: true, reviewRequired: false });
  });
  it('keeps RECOMMENDED separate and unselected', () => {
    expect(decideEstimateLine(edge({ requirementType: 'RECOMMENDED' }))).toEqual({ automationStatus: 'OPTIONAL', selected: false, reviewRequired: false });
  });
  it('requires review for unresolved CONDITIONAL', () => {
    expect(decideEstimateLine(edge({ requirementType: 'CONDITIONAL' }))).toEqual({ automationStatus: 'REVIEW_REQUIRED', selected: false, reviewRequired: true });
  });
  it('does not auto-select OPTIONAL', () => {
    expect(decideEstimateLine(edge({ requirementType: 'OPTIONAL' }))).toEqual({ automationStatus: 'OPTIONAL', selected: false, reviewRequired: false });
  });
  it.each(['DERIVED_FROM_KIT', 'INFERRED', 'UNKNOWN'] as const)('blocks non-eligible %s', (confidenceState) => {
    expect(decideEstimateLine(edge({ confidenceState, automationEligible: false, manualReviewRequired: true })))
      .toEqual({ automationStatus: 'BLOCKED', selected: false, reviewRequired: true });
  });
  it('blocks a nominally verified edge when RK01 rejected missing evidence', () => {
    expect(decideEstimateLine(edge({ automationEligible: false, manualReviewRequired: true, confidenceReason: 'EVIDENCE_REQUIRED' })))
      .toEqual({ automationStatus: 'BLOCKED', selected: false, reviewRequired: true });
  });
});
