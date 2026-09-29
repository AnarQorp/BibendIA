import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), otherTenant: randomUUID(), user: randomUUID(), vehicle: randomUUID() };
const principal: PrincipalContext = { kind: 'workshop_user', audience: 'workshop', userId: ids.user, issuer: 'test', subject: ids.user,
  sessionId: randomUUID(), authenticatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), assurance: 'single_factor' };
const authentication: AuthenticationAdapter = { async authenticate(request) { return request.authorization === 'Bearer rk-user' ? principal : null; } };

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'RK API','pilot'),($2,'RK Other','pilot')", [ids.tenant, ids.otherTenant]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active')", [ids.user]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES($1,$2,'OWNER','active')", [ids.user, ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, (client) => insertProtectedVehicle(client, pii,
    { id: ids.vehicle, tenantId: ids.tenant, plate: '1111 RKC', make: 'Volkswagen', model: 'Golf VII' }));
});

afterAll(async () => {
  await pool.query('DELETE FROM estimate_draft_lines WHERE tenant_id=$1', [ids.tenant]);
  await pool.query('DELETE FROM estimate_drafts WHERE tenant_id=$1', [ids.tenant]);
  await pool.query('DELETE FROM vehicles WHERE tenant_id=$1', [ids.tenant]);
  await pool.query('DELETE FROM tenant_memberships WHERE user_id=$1', [ids.user]);
  await pool.query('DELETE FROM users WHERE id=$1', [ids.user]);
  await pool.query('DELETE FROM tenants WHERE id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.end();
});

describe('Repair Knowledge product API', () => {
  it('resolves the RK01 PoC with operation, applicability, components, consumables, and edge provenance', async () => {
    const app = buildApi(pool, { authentication });
    const query = new URLSearchParams({ make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });
    const response = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/repair-knowledge/resolve?${query}`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      applicability: { code: 'APP_VAG_GOLF7_16TDI_CLHA_JOB_TIMING_BELT_WATER_PUMP' },
      repairJob: { code: 'JOB_TIMING_BELT_WATER_PUMP' },
    });
    expect(response.json().data.components.length).toBeGreaterThan(0);
    expect(response.json().data.consumables.length).toBeGreaterThan(0);
    expect(response.json().data.components[0].evidence[0].reference).toBeTruthy();
    await app.close();
  });

  it('creates an idempotent tenant draft whose prices remain explicitly pending', async () => {
    const app = buildApi(pool, { authentication });
    const body = { vehicleId: ids.vehicle, idempotencyKey: 'rk-api-draft-001',
      vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' }, repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' };
    const first = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
      headers: { authorization: 'Bearer rk-user' }, payload: body });
    const replay = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
      headers: { authorization: 'Bearer rk-user' }, payload: body });
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.id).toBe(first.json().data.id);
    expect(first.json().data.operation).toMatchObject({ pricingStatus: 'PENDING', unitPrice: null, editable: true });
    expect(first.json().data.lines.every((line: any) => line.unitPrice === null && line.pricingStatus === 'PENDING')).toBe(true);
    await app.close();
  });

  it('denies cross-tenant access before consulting global knowledge', async () => {
    const app = buildApi(pool, { authentication });
    const query = new URLSearchParams({ make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });
    const response = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.otherTenant}/repair-knowledge/resolve?${query}`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
