import { BAKEOFF_SCENARIOS, COMPARABLE_CALLS_PER_PROVIDER, INITIAL_GATE_CALLS_PER_PROVIDER } from './scenarios.js';
import type { VoiceProviderName } from '../ports/voice-provider.js';

export interface PlannedCall {
  provider: VoiceProviderName;
  phase: 'initial_gate' | 'comparable_twenty';
  scenarioId: string;
  run: number;
}

export function buildInitialGatePlan(provider: VoiceProviderName): PlannedCall[] {
  return BAKEOFF_SCENARIOS.map((scenario, index) => ({ provider, phase: 'initial_gate', scenarioId: scenario.id, run: index + 1 }));
}

export function buildComparablePlan(provider: VoiceProviderName): PlannedCall[] {
  return Array.from({ length: COMPARABLE_CALLS_PER_PROVIDER }, (_, index) => ({
    provider,
    phase: 'comparable_twenty',
    scenarioId: BAKEOFF_SCENARIOS[index % INITIAL_GATE_CALLS_PER_PROVIDER].id,
    run: index + 1,
  }));
}
