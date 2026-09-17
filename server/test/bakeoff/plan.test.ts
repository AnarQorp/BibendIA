import { describe, expect, it } from 'vitest';
import { buildComparablePlan, buildInitialGatePlan } from '../../src/bakeoff/plan.js';
import { BAKEOFF_SCENARIOS } from '../../src/bakeoff/scenarios.js';

describe('progressive bake-off plan', () => {
  it('runs 3–5 initial calls per provider and covers all required capabilities', () => {
    const plan = buildInitialGatePlan('vapi');
    const coveredCapabilities = new Set(BAKEOFF_SCENARIOS.flatMap((scenario) => scenario.capabilities));

    expect(plan).toHaveLength(5);
    expect(coveredCapabilities).toEqual(new Set([
      'spanish_es',
      'basque_names',
      'spoken_plate',
      'barge_in',
      'date_change',
      'workshop_noise',
      'long_unstructured',
      'tool_failure',
      'human_transfer',
    ]));
  });

  it('only defines the twenty-call phase as a separate post-gate plan', () => {
    expect(buildComparablePlan('elevenlabs')).toHaveLength(20);
  });
});
