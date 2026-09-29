import { describe, expect, it } from 'vitest';
import { resolveServiceDuration, ServiceDurationPolicyError } from '../../src/modules/scheduling/service-duration-policy.js';

const policy = { version: 'jarrisons-v1', rules: { oil_service: 45, inspection: 60 }, fallbackMinutes: 75 };

describe('workshop service duration policy', () => {
  it('resolves an exact service intent rule', () => {
    expect(resolveServiceDuration({ policy, serviceIntent: 'oil_service' })).toEqual({
      estimatedDurationMinutes: 45, source: 'service_intent', policyVersion: 'jarrisons-v1',
    });
  });

  it('uses only an explicit workshop fallback', () => {
    expect(resolveServiceDuration({ policy, serviceIntent: 'generic_fault' })).toMatchObject({
      estimatedDurationMinutes: 75, source: 'workshop_fallback',
    });
    expect(() => resolveServiceDuration({
      policy: { ...policy, fallbackMinutes: null }, serviceIntent: 'generic_fault',
    })).toThrowError(ServiceDurationPolicyError);
  });

  it('keeps legacy duration input as an explicit compatibility path', () => {
    expect(resolveServiceDuration({ policy: {}, legacyDurationMinutes: 60 })).toMatchObject({
      estimatedDurationMinutes: 60, source: 'legacy_client_supplied',
    });
  });
});
