import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { OidcAuthenticationAdapter, type HumanAuthenticationConfig } from '../../src/auth/oidc-authentication-adapter.js';
import { createPool } from '../../src/persistence/pool.js';

const fixture = createPool('migrator');
const runtime = createPool('api');
const ids = { tenant: randomUUID(), otherTenant: randomUUID(), workshop: randomUUID(), otherWorkshop: randomUUID(), arkaitz: randomUUID(), zaq: randomUUID() };
const issuer = 'https://bibendia.eu.auth0.com/';
const config: HumanAuthenticationConfig = {
  issuer, sessionKey: Buffer.alloc(32, 9).toString('base64url'), sessionTtlSeconds: 3600,
  workshop: { audience: 'workshop', clientId: 'workshop', clientSecret: 'secret', origin: 'https://app.bibendia.com', cookieName: '__Host-bibendia_workshop', requireMfa: false, authorizationTenantId: ids.tenant },
  platform: { audience: 'platform', clientId: 'platform', clientSecret: 'secret', origin: 'https://admin.bibendia.com', cookieName: '__Host-bibendia_platform', requireMfa: true, authorizationTenantId: ids.tenant },
};
const adapter = new OidcAuthenticationAdapter(runtime, config);
const app = buildApi(runtime, { humanAuthentication: adapter });
const workshopSession = () => adapter.sealSession({ userId: ids.arkaitz, issuer, subject: 'auth0|arkaitz', audience: 'workshop', assurance: 'single_factor', authenticatedAt: new Date().toISOString() }).value;
const platformSession = () => adapter.sealSession({ userId: ids.zaq, issuer, subject: 'auth0|zaq', audience: 'platform', assurance: 'mfa', authenticatedAt: new Date().toISOString() }).value;

beforeAll(async () => {
  await fixture.query(`INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Jarrisons','pilot'),($2,'Other','pilot')`, [ids.tenant, ids.otherTenant]);
  await fixture.query(`INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Jarrisons'),($3,$4,'Other')`, [ids.workshop, ids.tenant, ids.otherWorkshop, ids.otherTenant]);
  await fixture.query(`INSERT INTO users(id,status) VALUES($1,'active'),($2,'active')`, [ids.arkaitz, ids.zaq]);
  await fixture.query(`INSERT INTO external_identities(user_id,issuer,subject) VALUES($1,$3,'auth0|arkaitz'),($2,$3,'auth0|zaq')`, [ids.arkaitz, ids.zaq, issuer]);
  await fixture.query(`INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'OWNER')`, [ids.arkaitz, ids.tenant]);
  await fixture.query(`INSERT INTO platform_access_grants(user_id,role,scope_type,tenant_id) VALUES($1,'PLATFORM_OPERATOR','tenant',$2)`, [ids.zaq, ids.tenant]);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await fixture.query('DELETE FROM platform_access_grants WHERE user_id=$1', [ids.zaq]);
  await fixture.query('DELETE FROM tenant_memberships WHERE user_id=$1', [ids.arkaitz]);
  await fixture.query('DELETE FROM external_identities WHERE user_id IN ($1,$2)', [ids.arkaitz, ids.zaq]);
  await fixture.query('DELETE FROM users WHERE id IN ($1,$2)', [ids.arkaitz, ids.zaq]);
  await fixture.query('DELETE FROM workshops WHERE id IN ($1,$2)', [ids.workshop, ids.otherWorkshop]);
  await fixture.query('DELETE FROM tenants WHERE id IN ($1,$2)', [ids.tenant, ids.otherTenant]);
  await fixture.end();
});

describe('human authentication with PostgreSQL authority', () => {
  it('allows Arkaitz only into Jarrisons and rejects cross-tenant access', async () => {
    const cookie = `${config.workshop.cookieName}=${workshopSession()}`;
    expect((await app.inject({ url: `/v1/workshop/tenants/${ids.tenant}/appointments`, headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ url: `/v1/workshop/tenants/${ids.otherTenant}/appointments`, headers: { cookie } })).statusCode).toBe(403);
  });

  it('allows the scoped Platform operator and rejects cookies from the other surface', async () => {
    const platformCookie = `${config.platform.cookieName}=${platformSession()}`;
    expect((await app.inject({ url: `/v1/platform/tenants/${ids.tenant}/control`, headers: { cookie: platformCookie } })).statusCode).toBe(200);
    expect((await app.inject({ url: `/v1/platform/tenants/${ids.otherTenant}/control`, headers: { cookie: platformCookie } })).statusCode).toBe(403);
    expect((await app.inject({ url: `/v1/platform/tenants/${ids.tenant}/control`, headers: { cookie: `${config.workshop.cookieName}=${workshopSession()}` } })).statusCode).toBe(401);
    expect((await app.inject({ url: `/v1/workshop/tenants/${ids.tenant}/appointments`, headers: { cookie: platformCookie } })).statusCode).toBe(401);
  });

  it('revokes the next request after membership or user suspension', async () => {
    const cookie = `${config.workshop.cookieName}=${workshopSession()}`;
    await fixture.query(`UPDATE tenant_memberships SET status='suspended' WHERE user_id=$1 AND tenant_id=$2`, [ids.arkaitz, ids.tenant]);
    expect((await app.inject({ url: `/v1/workshop/tenants/${ids.tenant}/appointments`, headers: { cookie } })).statusCode).toBe(401);
    await fixture.query(`UPDATE tenant_memberships SET status='active' WHERE user_id=$1 AND tenant_id=$2`, [ids.arkaitz, ids.tenant]);
    await fixture.query(`UPDATE users SET status='suspended' WHERE id=$1`, [ids.arkaitz]);
    expect((await app.inject({ url: `/v1/workshop/tenants/${ids.tenant}/appointments`, headers: { cookie } })).statusCode).toBe(401);
    await fixture.query(`UPDATE users SET status='active' WHERE id=$1`, [ids.arkaitz]);
  });
});
