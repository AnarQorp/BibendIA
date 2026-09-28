import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { buildApi } from '../../src/api/app.js';
import { OidcAuthenticationAdapter, type HumanAuthenticationConfig } from '../../src/auth/oidc-authentication-adapter.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const config: HumanAuthenticationConfig = {
  issuer: 'https://bibendia.eu.auth0.com', sessionKey: Buffer.alloc(32, 7).toString('base64url'), sessionTtlSeconds: 3600,
  workshop: { audience: 'workshop', clientId: 'workshop-client', clientSecret: 'secret', origin: 'https://app.bibendia.com', cookieName: '__Host-bibendia_workshop', requireMfa: false, authorizationTenantId: tenantId },
  platform: { audience: 'platform', clientId: 'platform-client', clientSecret: 'secret', origin: 'https://admin.bibendia.com', cookieName: '__Host-bibendia_platform', requireMfa: true, authorizationTenantId: tenantId },
};
const pool = { connect: async () => { throw new Error('database not expected'); } } as unknown as pg.Pool;
const app = buildApi(pool, { humanAuthentication: new OidcAuthenticationAdapter(pool, config) });

describe('human auth routes', () => {
  it('separates Workshop and Platform login transactions and requests fresh Admin authentication', async () => {
    const workshop = await app.inject({ url: '/auth/login', headers: { host: 'app.bibendia.com' } });
    expect(workshop.statusCode).toBe(302);
    expect(workshop.headers.location).toContain('client_id=workshop-client');
    expect(workshop.headers.location).not.toContain('max_age=0');
    expect(workshop.headers['set-cookie']).toContain('__Host-bibendia_workshop_oidc=');

    const platform = await app.inject({ url: '/auth/login', headers: { host: 'admin.bibendia.com' } });
    expect(platform.statusCode).toBe(302);
    expect(platform.headers.location).toContain('client_id=platform-client');
    expect(platform.headers.location).toContain('max_age=0');
    expect(platform.headers['set-cookie']).toContain('__Host-bibendia_platform_oidc=');
  });

  it('clears only the current surface cookies and returns an allowlisted Auth0 logout target', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout', headers: { host: 'admin.bibendia.com' } });
    expect(response.statusCode).toBe(200);
    const cookies = String(response.headers['set-cookie']);
    expect(cookies).toContain('__Host-bibendia_platform=');
    expect(cookies).not.toContain('__Host-bibendia_workshop=');
    expect(response.json().logoutUrl).toContain(encodeURIComponent('https://admin.bibendia.com'));
  });

  it('does not expose auth routes on unknown hosts', async () => {
    expect((await app.inject({ url: '/auth/login', headers: { host: 'evil.example' } })).statusCode).toBe(404);
  });
});
