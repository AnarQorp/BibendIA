import type { RepairKnowledgeEdge } from './repair-knowledge.js';

export type EstimateAutomationStatus = 'AUTO_INCLUDED' | 'REVIEW_REQUIRED' | 'OPTIONAL' | 'BLOCKED';
export type EstimateLineDecision = { automationStatus: EstimateAutomationStatus; selected: boolean; reviewRequired: boolean };

export function decideEstimateLine(edge: RepairKnowledgeEdge): EstimateLineDecision {
  if (!edge.automationEligible) return { automationStatus: 'BLOCKED', selected: false, reviewRequired: true };
  if (edge.requirementType === 'REQUIRED') return { automationStatus: 'AUTO_INCLUDED', selected: true, reviewRequired: false };
  if (edge.requirementType === 'CONDITIONAL') return { automationStatus: 'REVIEW_REQUIRED', selected: false, reviewRequired: true };
  return { automationStatus: 'OPTIONAL', selected: false, reviewRequired: false };
}
