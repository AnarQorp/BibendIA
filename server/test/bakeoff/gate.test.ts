import { describe, expect, it } from 'vitest';
import { findCriticalFailures } from '../../src/bakeoff/gate.js';
import type { CallObservation } from '../../src/bakeoff/types.js';

const validObservation: CallObservation = {
  provider: 'vapi',
  scenarioId: 'es-basque-name-plate',
  run: 1,
  tenantResolvedCorrectly: true,
  appointmentCreated: true,
  appointmentCount: 1,
  explicitConfirmationCaptured: true,
  nameCorrect: true,
  plateCorrect: true,
  finalDateCorrect: true,
  toolSchemaValid: true,
  artifactsVerifiable: true,
  latencyMsP50: 600,
  latencyMsP95: 1100,
  totalCostEur: 0.2,
  durationSeconds: 120,
};

describe('bake-off critical gate', () => {
  it('accepts an observation with tenant, confirmation, idempotency and evidence intact', () => {
    expect(findCriticalFailures([validObservation])).toEqual([]);
  });

  it('detects every early-discard condition', () => {
    const failures = findCriticalFailures([{
      ...validObservation,
      tenantResolvedCorrectly: false,
      appointmentCount: 2,
      explicitConfirmationCaptured: false,
      artifactsVerifiable: false,
    }]);

    expect(failures.map((failure) => failure.code)).toEqual([
      'TENANT_MISMATCH',
      'UNCONFIRMED_APPOINTMENT',
      'DUPLICATE_APPOINTMENT',
      'UNVERIFIABLE_ARTIFACTS',
    ]);
  });
});
