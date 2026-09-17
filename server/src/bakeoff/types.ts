import type { VoiceProviderName } from '../ports/voice-provider.js';

export type BakeoffPhase = 'initial_gate' | 'comparable_twenty';

export type ScenarioCapability =
  | 'spanish_es'
  | 'basque_names'
  | 'spoken_plate'
  | 'barge_in'
  | 'date_change'
  | 'workshop_noise'
  | 'long_unstructured'
  | 'tool_failure'
  | 'human_transfer';

export interface BakeoffScenario {
  id: string;
  title: string;
  capabilities: ScenarioCapability[];
  script: string[];
  expected: {
    customerName?: string;
    plate?: string;
    finalDate?: string;
    mustTransfer?: boolean;
    confirmationRequired: boolean;
  };
}

export interface CallObservation {
  provider: VoiceProviderName;
  scenarioId: string;
  run: number;
  tenantResolvedCorrectly: boolean;
  appointmentCreated: boolean;
  appointmentCount: number;
  explicitConfirmationCaptured: boolean;
  nameCorrect: boolean;
  plateCorrect: boolean;
  finalDateCorrect: boolean;
  toolSchemaValid: boolean;
  transferSucceeded?: boolean;
  artifactsVerifiable: boolean;
  recoveredFromToolFailure?: boolean;
  latencyMsP50: number;
  latencyMsP95: number;
  totalCostEur: number;
  durationSeconds: number;
  notes?: string;
}

export interface CriticalFailure {
  provider: VoiceProviderName;
  scenarioId: string;
  run: number;
  code: 'TENANT_MISMATCH' | 'UNCONFIRMED_APPOINTMENT' | 'DUPLICATE_APPOINTMENT' | 'UNVERIFIABLE_ARTIFACTS';
}

export interface ProviderScore {
  provider: VoiceProviderName;
  phase: BakeoffPhase;
  eligible: boolean;
  criticalFailures: CriticalFailure[];
  score: number;
  dimensions: {
    entityAccuracy: number;
    confirmationIntegrity: number;
    toolReliability: number;
    conversationalHandling: number;
    artifactCompleteness: number;
    latency: number;
    cost: number;
  };
}
