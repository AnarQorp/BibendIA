import type { CallObservation, CriticalFailure } from './types.js';

export function findCriticalFailures(observations: readonly CallObservation[]): CriticalFailure[] {
  const failures: CriticalFailure[] = [];

  for (const observation of observations) {
    const base = { provider: observation.provider, scenarioId: observation.scenarioId, run: observation.run };

    if (!observation.tenantResolvedCorrectly) failures.push({ ...base, code: 'TENANT_MISMATCH' });
    if (observation.appointmentCreated && !observation.explicitConfirmationCaptured) failures.push({ ...base, code: 'UNCONFIRMED_APPOINTMENT' });
    if (observation.appointmentCount > 1) failures.push({ ...base, code: 'DUPLICATE_APPOINTMENT' });
    if (!observation.artifactsVerifiable) failures.push({ ...base, code: 'UNVERIFIABLE_ARTIFACTS' });
  }

  return failures;
}
