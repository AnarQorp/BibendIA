import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { inAuthorizedTenantTransaction } from '../../src/auth/tenant-authorization.js';
import { buildApi } from '../../src/api/app.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const ids = {
  tenantA: randomUUID(), tenantB: randomUUID(),
  workshopA: randomUUID(), workshopB: randomUUID(),
  userA: randomUUID(), userAB: randomUUID(), userMembershipSuspended: randomUUID(),
  userSuspended: randomUUID(), platformA: randomUUID(), platformReadonly: randomUUID(),
};
const future = new Date(Date.now() + 60 * 60_000).toISOString();
const authenticatedAt = new Date().toISOString();

const workshopPrincipal = (userId: string): PrincipalContext => ({
  kind: 'workshop_user', audience: 'workshop', userId, issuer: 'integration-test', subject: userId,
  sessionId: randomUUID(), authenticatedAt, expiresAt: future, assurance: 'single_factor',
});
const platformPrincipal = (userId: string): PrincipalContext => ({
  kind: 'platform_user', audience: 'platform', userId, issuer: 'integration-test', subject: userId,
  sessionId: randomUUID(), authenticatedAt, expiresAt: future, assurance: 'mfa',
});

const principals = new Map<string, PrincipalContext>([
  ['Bearer user-a', workshopPrincipal(ids.userA)],
  ['Bearer user-ab', workshopPrincipal(ids.userAB)],
  ['Bearer membership-suspended', workshopPrincipal(ids.userMembershipSuspended)],
  ['Bearer user-suspended', workshopPrincipal(ids.userSuspended)],
  ['Bearer platform-a', platformPrincipal(ids.platformA)],
  ['Bearer platform-readonly', platformPrincipal(ids.platformReadonly)],
]);
const authentication: AuthenticationAdapter = {
  async authenticate(request) { return request.authorization ? principals.get(request.authorization) ?? null : null; },
};

beforeAll(async () => {
  await pool.query('RESET ROLE');
  await pool.query(
    `INSERT INTO tenants(id,name) VALUES ($1,'Tenant A'),($2,'Tenant B')`,
    [ids.tenantA, ids.tenantB],
  );
  await pool.query(
    `INSERT INTO workshops(id,tenant_id,name) VALUES ($1,$2,'Workshop A'),($3,$4,'Workshop B')`,
    [ids.workshopA, ids.tenantA, ids.workshopB, ids.tenantB],
  );
  await pool.query(
    `INSERT INTO users(id,status,display_name) VALUES
      ($1,'active','User A'),($2,'active','User AB'),($3,'active','Membership suspended'),
      ($4,'suspended','User suspended'),($5,'active','Platform A'),($6,'active','Platform readonly')`,
    [ids.userA, ids.userAB, ids.userMembershipSuspended, ids.userSuspended, ids.platformA, ids.platformReadonly],
  );
  await pool.query(
    `INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES
      ($1,$2,'OWNER','active'),
      ($3,$2,'MANAGER','active'),($3,$4,'MANAGER','active'),
      ($5,$2,'RECEPTION','suspended'),
      ($6,$2,'OWNER','active')`,
    [ids.userA, ids.tenantA, ids.userAB, ids.tenantB, ids.userMembershipSuspended, ids.userSuspended],
  );
  await pool.query(
    `INSERT INTO platform_access_grants(user_id,role,scope_type,tenant_id) VALUES
      ($1,'PLATFORM_OPERATOR','tenant',$2),($3,'SUPPORT_READONLY','tenant',$2)`,
    [ids.platformA, ids.tenantA, ids.platformReadonly],
  );
});

afterAll(async () => {
  await pool.query('RESET ROLE');
  await pool.query('DELETE FROM platform_access_grants WHERE user_id IN ($1,$2)', [ids.platformA, ids.platformReadonly]);
  await pool.query('DELETE FROM tenant_memberships WHERE user_id = ANY($1::uuid[])', [[ids.userA, ids.userAB, ids.userMembershipSuspended, ids.userSuspended]]);
  await pool.query('DELETE FROM workshops WHERE tenant_id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [Object.values(ids).filter((id) => ![ids.tenantA, ids.tenantB, ids.workshopA, ids.workshopB].includes(id))]);
  await pool.query('DELETE FROM tenants WHERE id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.end();
});

async function authorize(principal: PrincipalContext, tenantId: string, capability: Parameters<typeof inAuthorizedTenantTransaction>[1]['capability']) {
  return inAuthorizedTenantTransaction(pool, {
    principal, requestedTenantId: tenantId, capability, correlationId: randomUUID(),
  }, async (_client, context) => context);
}

describe('P0.3 tenant authorization', () => {
  it('allows a Workshop user only in active memberships', async () => {
    await expect(authorize(workshopPrincipal(ids.userA), ids.tenantA, 'workshop:appointments:read')).resolves.toMatchObject({ tenantId: ids.tenantA });
    await expect(authorize(workshopPrincipal(ids.userA), ids.tenantB, 'workshop:appointments:read')).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('allows a multi-tenant user to select each membership independently', async () => {
    await expect(authorize(workshopPrincipal(ids.userAB), ids.tenantA, 'workshop:appointments:read')).resolves.toMatchObject({ tenantId: ids.tenantA });
    await expect(authorize(workshopPrincipal(ids.userAB), ids.tenantB, 'workshop:appointments:read')).resolves.toMatchObject({ tenantId: ids.tenantB });
  });

  it('denies suspended membership and suspended user', async () => {
    await expect(authorize(workshopPrincipal(ids.userMembershipSuspended), ids.tenantA, 'workshop:appointments:read')).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    await expect(authorize(workshopPrincipal(ids.userSuspended), ids.tenantA, 'workshop:appointments:read')).rejects.toMatchObject({ code: 'PRINCIPAL_INACTIVE' });
  });

  it('does not let Workshop roles acquire Platform capabilities', async () => {
    await expect(authorize(workshopPrincipal(ids.userA), ids.tenantA, 'platform:tenant:update')).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('enforces Platform scope and readonly capabilities', async () => {
    await expect(authorize(platformPrincipal(ids.platformA), ids.tenantA, 'platform:tenant:update')).resolves.toMatchObject({ tenantId: ids.tenantA });
    await expect(authorize(platformPrincipal(ids.platformA), ids.tenantB, 'platform:tenant:update')).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    await expect(authorize(platformPrincipal(ids.platformReadonly), ids.tenantA, 'platform:tenant:read')).resolves.toMatchObject({ tenantId: ids.tenantA });
    await expect(authorize(platformPrincipal(ids.platformReadonly), ids.tenantA, 'platform:tenant:update')).rejects.toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('keeps RLS effective when an authorized query omits its tenant predicate', async () => {
    const visible = await inAuthorizedTenantTransaction(pool, {
      principal: workshopPrincipal(ids.userA), requestedTenantId: ids.tenantA,
      capability: 'workshop:configuration:read', correlationId: randomUUID(),
    }, (client) => client.query<{ tenant_id: string }>('SELECT tenant_id FROM workshops ORDER BY tenant_id'));
    expect(visible.rows.map((row) => row.tenant_id)).toEqual([ids.tenantA]);
  });

  it('uses URL tenant selection and ignores contradictory tenant headers', async () => {
    const app = buildApi(pool, { authentication });
    const allowed = await app.inject({
      method: 'GET',
      url: `/v1/workshop/tenants/${ids.tenantA}/appointments`,
      headers: { authorization: 'Bearer user-a', 'x-tenant-id': ids.tenantB },
      payload: { tenantId: ids.tenantB },
    });
    expect(allowed.statusCode).toBe(200);
    const manipulated = await app.inject({
      url: `/v1/workshop/tenants/${ids.tenantB}/appointments`,
      headers: { authorization: 'Bearer user-a', 'x-tenant-id': ids.tenantA },
    });
    expect(manipulated.statusCode).toBe(403);
    await app.close();
  });

  it('does not allow Platform principals through Workshop routes', async () => {
    const app = buildApi(pool, { authentication });
    const response = await app.inject({
      url: `/v1/workshop/tenants/${ids.tenantA}/appointments`,
      headers: { authorization: 'Bearer platform-a' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
