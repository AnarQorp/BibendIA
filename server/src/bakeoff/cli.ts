import { buildComparablePlan, buildInitialGatePlan } from './plan.js';
import { BAKEOFF_SCENARIOS } from './scenarios.js';

const plan = {
  generatedAt: new Date().toISOString(),
  note: 'Planning only. No call or product action is simulated or claimed.',
  scenarios: BAKEOFF_SCENARIOS,
  providers: ['vapi', 'elevenlabs'].map((provider) => ({
    provider,
    initialGate: buildInitialGatePlan(provider as 'vapi' | 'elevenlabs'),
    comparableTwentyAfterGate: buildComparablePlan(provider as 'vapi' | 'elevenlabs'),
  })),
};

process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
