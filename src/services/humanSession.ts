export type HumanSession = {
  principal: { kind: 'workshop_user' | 'platform_user'; audience: 'workshop' | 'platform'; userId: string; assurance: 'single_factor' | 'mfa' };
  tenantIds: string[];
  activeTenantId?: string;
  expiresAt: string;
};

export function selectWorkshopTenant(session: Pick<HumanSession, 'tenantIds' | 'activeTenantId'>): string | null {
  if (session.activeTenantId && session.tenantIds.includes(session.activeTenantId)) return session.activeTenantId;
  return session.tenantIds[0] ?? null;
}

export async function loadHumanSession(): Promise<HumanSession | null> {
  const response = await fetch('/auth/session', { credentials: 'include', headers: { accept: 'application/json' } });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`SESSION_HTTP_${response.status}`);
  return response.json() as Promise<HumanSession>;
}

export async function logoutHumanSession(): Promise<void> {
  const response = await fetch('/auth/logout', { method: 'POST', credentials: 'include', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`LOGOUT_HTTP_${response.status}`);
  const body = await response.json() as { logoutUrl: string };
  window.location.assign(body.logoutUrl);
}
