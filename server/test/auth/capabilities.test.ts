import { describe, expect, it } from 'vitest';
import { platformRoleAllows, workshopRoleAllows } from '../../src/auth/capabilities.js';

describe('pilot capability matrix', () => {
  it('keeps Workshop roles out of Platform capabilities', () => {
    expect(workshopRoleAllows('OWNER', 'workshop:appointments:read')).toBe(true);
    expect(workshopRoleAllows('OWNER', 'platform:tenant:update')).toBe(false);
  });

  it('keeps support readonly unable to mutate', () => {
    expect(platformRoleAllows('SUPPORT_READONLY', 'platform:tenant:read')).toBe(true);
    expect(platformRoleAllows('SUPPORT_READONLY', 'platform:tenant:update')).toBe(false);
    expect(platformRoleAllows('SUPPORT_READONLY', 'platform:kill-switch:manage')).toBe(false);
  });
});
