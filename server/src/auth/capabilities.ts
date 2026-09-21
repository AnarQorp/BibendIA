export type WorkshopRole = 'OWNER' | 'MANAGER' | 'RECEPTION' | 'VIEWER';
export type PlatformRole = 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR' | 'SUPPORT_READONLY' | 'SECURITY_AUDITOR';

export type Capability =
  | 'workshop:appointments:read'
  | 'workshop:cases:read'
  | 'workshop:configuration:read'
  | 'workshop:configuration:update'
  | 'workshop:memberships:manage'
  | 'platform:tenant:read'
  | 'platform:tenant:update'
  | 'platform:memberships:manage'
  | 'platform:configuration:read'
  | 'platform:configuration:update'
  | 'platform:activity:read'
  | 'platform:cost:read'
  | 'platform:incidents:read'
  | 'platform:audit:read'
  | 'platform:kill-switch:manage';

const workshopCapabilities: Record<WorkshopRole, readonly Capability[]> = {
  OWNER: ['workshop:appointments:read', 'workshop:cases:read', 'workshop:configuration:read', 'workshop:configuration:update', 'workshop:memberships:manage'],
  MANAGER: ['workshop:appointments:read', 'workshop:cases:read', 'workshop:configuration:read', 'workshop:configuration:update'],
  RECEPTION: ['workshop:appointments:read', 'workshop:cases:read'],
  VIEWER: ['workshop:appointments:read', 'workshop:cases:read'],
};

const allPlatformCapabilities: readonly Capability[] = [
  'platform:tenant:read', 'platform:tenant:update', 'platform:memberships:manage',
  'platform:configuration:read', 'platform:configuration:update', 'platform:activity:read',
  'platform:cost:read', 'platform:incidents:read', 'platform:audit:read', 'platform:kill-switch:manage',
];

const platformCapabilities: Record<PlatformRole, readonly Capability[]> = {
  PLATFORM_ADMIN: allPlatformCapabilities,
  PLATFORM_OPERATOR: allPlatformCapabilities.filter((capability) => capability !== 'platform:memberships:manage'),
  SUPPORT_READONLY: ['platform:tenant:read', 'platform:configuration:read', 'platform:activity:read', 'platform:cost:read', 'platform:incidents:read'],
  SECURITY_AUDITOR: ['platform:tenant:read', 'platform:audit:read'],
};

export function workshopRoleAllows(role: WorkshopRole, capability: Capability): boolean {
  return workshopCapabilities[role].includes(capability);
}

export function platformRoleAllows(role: PlatformRole, capability: Capability): boolean {
  return platformCapabilities[role].includes(capability);
}
