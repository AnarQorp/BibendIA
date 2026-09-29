export const confidenceStates = [
  'VERIFIED_OEM', 'VERIFIED_MANUFACTURER', 'MULTI_SOURCE_VERIFIED', 'DERIVED_FROM_KIT',
  'COMMUNITY_SUPPORTED', 'INFERRED', 'UNKNOWN',
] as const;

export type ConfidenceState = typeof confidenceStates[number];
export type BomClassification = 'EXPLICIT_BOM' | 'DERIVED_FROM_KIT' | 'MULTI_SOURCE_BOM' | 'TECHNICAL_RULE';
export type RequirementType = 'REQUIRED' | 'RECOMMENDED' | 'CONDITIONAL' | 'OPTIONAL';

export type ConfidenceDecision = {
  automationEligible: boolean;
  manualReviewRequired: boolean;
  reason: 'ELIGIBLE_VERIFIED' | 'EVIDENCE_REQUIRED' | 'DERIVED_FROM_KIT_REVIEW' | 'COMMUNITY_CRITICAL_REVIEW' | 'UNVERIFIED_REVIEW';
};

const verified = new Set<ConfidenceState>(['VERIFIED_OEM', 'VERIFIED_MANUFACTURER', 'MULTI_SOURCE_VERIFIED']);

export function evaluateRepairKnowledgeConfidence(input: {
  confidenceState: ConfidenceState;
  bomClassification: BomClassification;
  requirementType: RequirementType;
  hasValidEvidence: boolean;
}): ConfidenceDecision {
  if (!input.hasValidEvidence) return { automationEligible: false, manualReviewRequired: true, reason: 'EVIDENCE_REQUIRED' };
  if (input.confidenceState === 'DERIVED_FROM_KIT') {
    return { automationEligible: false, manualReviewRequired: true, reason: 'DERIVED_FROM_KIT_REVIEW' };
  }
  if (input.confidenceState === 'COMMUNITY_SUPPORTED') {
    return { automationEligible: false, manualReviewRequired: true, reason: 'COMMUNITY_CRITICAL_REVIEW' };
  }
  if (!verified.has(input.confidenceState)) {
    return { automationEligible: false, manualReviewRequired: true, reason: 'UNVERIFIED_REVIEW' };
  }
  return { automationEligible: true, manualReviewRequired: false, reason: 'ELIGIBLE_VERIFIED' };
}
