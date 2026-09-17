import { findCriticalFailures } from './gate.js';
import type { BakeoffPhase, CallObservation, ProviderScore } from './types.js';

const average = (values: number[]): number => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const ratio = (values: boolean[]): number => average(values.map((value) => value ? 1 : 0));
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function scoreProvider(phase: BakeoffPhase, observations: readonly CallObservation[]): ProviderScore {
  if (observations.length === 0) throw new Error('At least one call observation is required');

  const provider = observations[0].provider;
  if (observations.some((observation) => observation.provider !== provider)) {
    throw new Error('A provider score cannot mix observations from different providers');
  }

  const criticalFailures = findCriticalFailures(observations);
  const dimensions = {
    entityAccuracy: average(observations.map((o) => ratio([o.nameCorrect, o.plateCorrect, o.finalDateCorrect]))),
    confirmationIntegrity: ratio(observations.map((o) => !o.appointmentCreated || o.explicitConfirmationCaptured)),
    toolReliability: ratio(observations.map((o) => o.toolSchemaValid && o.appointmentCount <= 1)),
    conversationalHandling: ratio(observations.map((o) => o.recoveredFromToolFailure !== false && o.transferSucceeded !== false)),
    artifactCompleteness: ratio(observations.map((o) => o.artifactsVerifiable)),
    latency: average(observations.map((o) => clamp(1 - Math.max(0, o.latencyMsP95 - 800) / 2200))),
    cost: average(observations.map((o) => clamp(1 - (o.totalCostEur / Math.max(o.durationSeconds / 60, 0.25)) / 1.0))),
  };

  const weightedScore = (
    dimensions.entityAccuracy * 0.25 +
    dimensions.confirmationIntegrity * 0.20 +
    dimensions.toolReliability * 0.20 +
    dimensions.conversationalHandling * 0.10 +
    dimensions.artifactCompleteness * 0.10 +
    dimensions.latency * 0.10 +
    dimensions.cost * 0.05
  ) * 100;

  return {
    provider,
    phase,
    eligible: criticalFailures.length === 0,
    criticalFailures,
    score: Math.round(weightedScore * 100) / 100,
    dimensions,
  };
}
