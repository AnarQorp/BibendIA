export type TenantOperatingMode = 'standard' | 'pilot_supervised';
export type AutonomyLevel = 'observe' | 'draft' | 'customer_confirmed' | 'auto_low_risk' | 'human_approval' | 'forbidden';

export interface TenantPolicySettings {
  operatingMode: TenantOperatingMode;
  policyVersion: string;
}

export interface PolicyRequest {
  requestedLevel: AutonomyLevel;
  customerConfirmationRecorded: boolean;
  requiredFactsVerified: boolean;
  risk: 'low' | 'medium' | 'high';
}

export interface PolicyDecision {
  effect: 'allow' | 'require_customer_confirmation' | 'require_human_approval' | 'deny';
  policyVersion: string;
  reason: string;
}

/**
 * Pilot mode is a stricter policy configuration, not an alternate execution path.
 * The same decision is persisted through the normal Policy/Approvals ledger.
 */
export function evaluatePolicy(settings: TenantPolicySettings, request: PolicyRequest): PolicyDecision {
  if (request.requestedLevel === 'forbidden' || request.risk === 'high') {
    return { effect: 'deny', policyVersion: settings.policyVersion, reason: 'Action forbidden by risk policy' };
  }

  if (!request.requiredFactsVerified) {
    return { effect: 'require_human_approval', policyVersion: settings.policyVersion, reason: 'Required facts are not verified' };
  }

  if (request.requestedLevel === 'customer_confirmed' && !request.customerConfirmationRecorded) {
    return { effect: 'require_customer_confirmation', policyVersion: settings.policyVersion, reason: 'Explicit customer confirmation is required' };
  }

  if (settings.operatingMode === 'pilot_supervised' && request.requestedLevel === 'auto_low_risk') {
    return { effect: 'require_human_approval', policyVersion: settings.policyVersion, reason: 'Pilot supervised mode hardens automatic actions' };
  }

  if (request.requestedLevel === 'human_approval') {
    return { effect: 'require_human_approval', policyVersion: settings.policyVersion, reason: 'Action requires human approval' };
  }

  return { effect: 'allow', policyVersion: settings.policyVersion, reason: 'Policy requirements satisfied' };
}
