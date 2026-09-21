import { describe, expect, it } from 'vitest';
import { operationDecision, type TenantControlState, type TenantLifecycle } from '../../src/modules/tenant-control/tenant-control.js';

function state(lifecycle: TenantLifecycle, killed = false): TenantControlState {
  return {
    lifecycle,
    lifecycleUpdatedAt: null,
    lifecycleUpdatedBy: null,
    lifecycleReason: null,
    killSwitch: { enabled: killed, updatedAt: null, updatedBy: null, reason: null },
    version: 1,
  };
}

describe('P0.5 lifecycle operation policy', () => {
  it.each(['pilot', 'active'] as const)('permits reads and mutations in %s', (lifecycle) => {
    expect(operationDecision(state(lifecycle), 'workshop_read')).toEqual({ allowed: true });
    expect(operationDecision(state(lifecycle), 'domain_mutation')).toEqual({ allowed: true });
    expect(operationDecision(state(lifecycle), 'external_effect')).toEqual({ allowed: true });
  });

  it('keeps provisioning limited to control-plane reads', () => {
    expect(operationDecision(state('provisioning'), 'platform_read')).toEqual({ allowed: true });
    expect(operationDecision(state('provisioning'), 'provider_ingress_capture')).toEqual({ allowed: true });
    expect(operationDecision(state('provisioning'), 'workshop_read')).toMatchObject({ allowed: false });
    expect(operationDecision(state('provisioning'), 'domain_mutation')).toMatchObject({ allowed: false });
  });

  it('allows retained reads but denies mutations while suspended', () => {
    expect(operationDecision(state('suspended'), 'platform_read')).toEqual({ allowed: true });
    expect(operationDecision(state('suspended'), 'workshop_read')).toEqual({ allowed: true });
    expect(operationDecision(state('suspended'), 'conversation_start')).toMatchObject({ allowed: false });
    expect(operationDecision(state('suspended'), 'external_effect')).toMatchObject({ allowed: false });
  });

  it('allows only Platform/control-plane capture reads after deactivation', () => {
    expect(operationDecision(state('deactivated'), 'platform_read')).toEqual({ allowed: true });
    expect(operationDecision(state('deactivated'), 'provider_ingress_capture')).toEqual({ allowed: true });
    expect(operationDecision(state('deactivated'), 'workshop_read')).toEqual({ allowed: false, code: 'TENANT_DEACTIVATED' });
    expect(operationDecision(state('deactivated'), 'domain_mutation')).toEqual({ allowed: false, code: 'TENANT_DEACTIVATED' });
  });

  it('uses one reversible kill switch that blocks risky work but not reads or ingress capture', () => {
    const killed = state('active', true);
    expect(operationDecision(killed, 'workshop_read')).toEqual({ allowed: true });
    expect(operationDecision(killed, 'platform_read')).toEqual({ allowed: true });
    expect(operationDecision(killed, 'provider_ingress_capture')).toEqual({ allowed: true });
    expect(operationDecision(killed, 'conversation_start')).toEqual({ allowed: false, code: 'KILL_SWITCH_ENABLED' });
    expect(operationDecision(killed, 'domain_mutation')).toEqual({ allowed: false, code: 'KILL_SWITCH_ENABLED' });
    expect(operationDecision(killed, 'external_effect')).toEqual({ allowed: false, code: 'KILL_SWITCH_ENABLED' });
  });
});
