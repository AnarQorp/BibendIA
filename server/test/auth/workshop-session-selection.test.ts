import { describe, expect, it } from 'vitest';
import { selectWorkshopTenant } from '../../../src/services/humanSession.js';

describe('workshop session tenant selection', () => {
  it('opens the invited active tenant even when another membership is listed first', () => {
    expect(selectWorkshopTenant({ tenantIds: ['existing', 'invited'], activeTenantId: 'invited' })).toBe('invited');
  });
  it('never selects an active tenant outside the authorized memberships', () => {
    expect(selectWorkshopTenant({ tenantIds: ['authorized'], activeTenantId: 'unauthorized' })).toBe('authorized');
  });
  it('preserves legacy selection when activeTenantId is absent', () => {
    expect(selectWorkshopTenant({ tenantIds: ['legacy'] })).toBe('legacy');
    expect(selectWorkshopTenant({ tenantIds: [] })).toBeNull();
    expect(selectWorkshopTenant({ tenantIds: [], activeTenantId: 'unauthorized' })).toBeNull();
  });
});
