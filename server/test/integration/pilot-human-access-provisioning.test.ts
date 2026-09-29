import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../../src/persistence/pool.js';
import { provisionPilotHumanAccess } from '../../src/provisioning/pilot-human-access.js';

const pool = createPool('migrator');
const tenantId = randomUUID();
const suffix = randomUUID();
const issuer = 'https://pilot-provisioning.test/';
const subjects = {
  aketza: `auth0|aketza-${suffix}`,
  zaq: `auth0|zaq-${suffix}`,
  arkaitz: `auth0|arkaitz-${suffix}`,
};
const environment = {
  OIDC_ISSUER: issuer,
  HUMAN_AUTH_PILOT_TENANT_ID: tenantId,
  PILOT_AKETZA_OIDC_SUBJECT: subjects.aketza,
  PILOT_ZAQ_OIDC_SUBJECT: subjects.zaq,
  PILOT_ARKAITZ_OIDC_SUBJECT: subjects.arkaitz,
};
let userIds: string[] = [];

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Provisioning test','pilot')", [tenantId]);
});

afterAll(async () => {
  await pool.query('DELETE FROM platform_access_grants WHERE user_id=ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM tenant_memberships WHERE user_id=ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM external_identities WHERE user_id=ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]);
  await pool.query('DELETE FROM tenants WHERE id=$1', [tenantId]);
  await pool.end();
});

describe('pilot human access provisioning', () => {
  it('creates system UUIDs and safely reuses them on retry without duplicate authority', async () => {
    const first = await provisionPilotHumanAccess(pool, environment);
    const second = await provisionPilotHumanAccess(pool, environment);
    userIds = first.map(({ userId }) => userId);

    expect(first).toHaveLength(3);
    expect(second.map(({ userId }) => userId)).toEqual(userIds);
    expect(new Set(userIds).size).toBe(3);
    expect(userIds.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);

    const identities = await pool.query(
      'SELECT user_id,subject FROM external_identities WHERE issuer=$1 AND subject=ANY($2::text[]) ORDER BY subject',
      [issuer, Object.values(subjects)],
    );
    expect(identities.rowCount).toBe(3);
    expect(new Set(identities.rows.map(({ user_id }) => user_id))).toEqual(new Set(userIds));

    const grants = await pool.query(
      'SELECT role,scope_type,tenant_id FROM platform_access_grants WHERE user_id=ANY($1::uuid[]) ORDER BY role',
      [userIds],
    );
    expect(grants.rows).toEqual([
      { role: 'PLATFORM_ADMIN', scope_type: 'global', tenant_id: null },
      { role: 'PLATFORM_OPERATOR', scope_type: 'tenant', tenant_id: tenantId },
    ]);
    const memberships = await pool.query(
      'SELECT role,status,tenant_id FROM tenant_memberships WHERE user_id=ANY($1::uuid[])', [userIds],
    );
    expect(memberships.rows).toEqual([{ role: 'OWNER', status: 'active', tenant_id: tenantId }]);
  });
});
