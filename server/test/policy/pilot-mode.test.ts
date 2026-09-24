import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../../src/modules/policy/pilot-mode.js';

describe('tenant pilot supervised mode', () => {
  it('hardens auto-low-risk actions through the normal approval result', () => {
    expect(evaluatePolicy(
      { operatingMode: 'pilot_supervised', policyVersion: 'pilot-v1' },
      { requestedLevel: 'auto_low_risk', customerConfirmationRecorded: true, requiredFactsVerified: true,
        requiresVerifiedIdentity: false, identityVerified: false, risk: 'low' },
    )).toMatchObject({ effect: 'require_human_approval', policyVersion: 'pilot-v1' });
  });

  it('still requires explicit customer confirmation for appointment creation', () => {
    expect(evaluatePolicy(
      { operatingMode: 'pilot_supervised', policyVersion: 'pilot-v1' },
      { requestedLevel: 'customer_confirmed', customerConfirmationRecorded: false, requiredFactsVerified: true,
        requiresVerifiedIdentity: false, identityVerified: false, risk: 'low' },
    ).effect).toBe('require_customer_confirmation');
  });

  it('allows a customer-confirmed action when facts and confirmation are recorded', () => {
    expect(evaluatePolicy(
      { operatingMode: 'pilot_supervised', policyVersion: 'pilot-v1' },
      { requestedLevel: 'customer_confirmed', customerConfirmationRecorded: true, requiredFactsVerified: true,
        requiresVerifiedIdentity: false, identityVerified: false, risk: 'low' },
    ).effect).toBe('allow');
  });

  it('blocks protected-data operations unless identity is verified', () => {
    expect(evaluatePolicy(
      { operatingMode: 'pilot_supervised', policyVersion: 'pilot-v1' },
      { requestedLevel: 'customer_confirmed', customerConfirmationRecorded: true, requiredFactsVerified: true,
        requiresVerifiedIdentity: true, identityVerified: false, risk: 'low' },
    ).effect).toBe('require_human_approval');
  });
});
