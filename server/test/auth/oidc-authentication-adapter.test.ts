import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { assuranceFromPayload, OidcAuthenticationAdapter, parseCookies, type HumanAuthenticationConfig } from '../../src/auth/oidc-authentication-adapter.js';

const userId = '00000000-0000-4000-8000-000000000010';
const tenantId = '00000000-0000-4000-8000-000000000001';
const config: HumanAuthenticationConfig = {
  issuer: 'https://bibendia.eu.auth0.com', sessionKey: Buffer.alloc(32, 7).toString('base64url'), sessionTtlSeconds: 3600,
  workshop: { audience: 'workshop', clientId: 'workshop', clientSecret: 'secret', origin: 'https://app.bibendia.com', cookieName: '__Host-bibendia_workshop', requireMfa: false, authorizationTenantId: tenantId },
  platform: { audience: 'platform', clientId: 'platform', clientSecret: 'secret', origin: 'https://admin.bibendia.com', cookieName: '__Host-bibendia_platform', requireMfa: true, authorizationTenantId: tenantId },
};

function pool(state: { active?: boolean; identity?: boolean; authority?: boolean } = {}): pg.Pool {
  const settings = { active: true, identity: true, authority: true, ...state };
  const client = {
    async query(sql: string) {
      if (sql.includes('FROM external_identities')) return { rows: settings.identity ? [{ user_id: userId }] : [], rowCount: settings.identity ? 1 : 0 };
      if (sql.includes('FROM users')) return { rows: [{ status: settings.active ? 'active' : 'suspended' }], rowCount: 1 };
      if (sql.includes('FROM tenant_memberships') || sql.includes('FROM platform_access_grants')) {
        return { rows: settings.authority ? [{ tenant_id: tenantId }] : [], rowCount: settings.authority ? 1 : 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  return { async connect() { return client; } } as unknown as pg.Pool;
}

const request = (cookie: string) => ({ method: 'GET', url: '/', path: '/', cookie, headers: {} });

describe('OIDC human session adapter', () => {
  it('issues a surface-bound encrypted session and resolves active PostgreSQL authority', async () => {
    const adapter = new OidcAuthenticationAdapter(pool(), config);
    const sealed = adapter.sealSession({ userId, issuer: `${config.issuer}/`, subject: 'auth0|arkaitz', audience: 'workshop', assurance: 'single_factor', authenticatedAt: new Date().toISOString() });
    const cookie = `${config.workshop.cookieName}=${sealed.value}`;
    expect((await adapter.authenticate(request(cookie), 'workshop'))?.kind).toBe('workshop_user');
    expect(await adapter.authenticate(request(cookie), 'platform')).toBeNull();
  });

  it('rejects expired, tampered, suspended, unbound and authority-less sessions', async () => {
    const valid = new OidcAuthenticationAdapter(pool(), config);
    const body = { v: 1, userId, issuer: `${config.issuer}/`, subject: 'auth0|arkaitz', sessionId: 's', audience: 'workshop', assurance: 'single_factor', authenticatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() } as const;
    const expired = valid.seal(body, 'session:workshop');
    expect(await valid.authenticate(request(`${config.workshop.cookieName}=${expired}`), 'workshop')).toBeNull();
    expect(await valid.authenticate(request(`${config.workshop.cookieName}=${expired}x`), 'workshop')).toBeNull();
    for (const state of [{ active: false }, { identity: false }, { authority: false }]) {
      const adapter = new OidcAuthenticationAdapter(pool(state), config);
      const sealed = adapter.sealSession({ userId, issuer: `${config.issuer}/`, subject: 'auth0|arkaitz', audience: 'workshop', assurance: 'single_factor', authenticatedAt: new Date().toISOString() });
      expect(await adapter.authenticate(request(`${config.workshop.cookieName}=${sealed.value}`), 'workshop')).toBeNull();
    }
  });

  it('parses cookies without accepting malformed values', () => {
    expect(parseCookies('a=1; broken; b=hello%20world')).toEqual({ a: '1', b: 'hello world' });
  });

  it('recognizes MFA only from authentication method evidence', () => {
    expect(assuranceFromPayload({ amr: ['pwd'] })).toBe('single_factor');
    expect(assuranceFromPayload({ amr: ['pwd', 'mfa'] })).toBe('mfa');
    expect(assuranceFromPayload({ amr: ['webauthn'] })).toBe('mfa');
  });
});
