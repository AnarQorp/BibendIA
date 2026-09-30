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
  it('serves authorized progressive vehicle facets from Repair Knowledge', async () => {
    const app = buildApi(pool, { authentication });
    const response = await app.inject({ method: 'GET',
      url: `/v1/workshop/tenants/${ids.tenant}/repair-knowledge/vehicle-facets?make=Volkswagen&model=Golf%20VII`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ makes: ['Volkswagen'], models: ['Golf VII'] });
    expect(response.json().data.engines).toContainEqual({ engineCode: 'CLHA', variant: '1.6 TDI', generation: '5G1/BQ1', label: '1.6 TDI — CLHA' });
    await app.close();
  });

  it('resolves and creates a draft without requiring engine when RK is unambiguous', async () => {
    const app = buildApi(pool, { authentication });
    const query = new URLSearchParams({ make: 'Volkswagen', model: 'Golf VII', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });
    const resolved = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/repair-knowledge/resolve?${query}`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().data).toMatchObject({ status: 'RESOLVED', applicability: { engineCode: 'CLHA' } });
    const created = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
      headers: { authorization: 'Bearer rk-user' }, payload: { vehicleId: ids.vehicle, idempotencyKey: 'rk05-no-engine-001',
        vehicle: { make: 'Volkswagen', model: 'Golf VII' }, repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' } });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.applicabilityCode).toBe('APP_VAG_GOLF7_16TDI_CLHA_JOB_TIMING_BELT_WATER_PUMP');
    const explicitEngine = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
      headers: { authorization: 'Bearer rk-user' }, payload: { vehicleId: ids.vehicle, idempotencyKey: 'rk05-with-engine-001',
        vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' }, repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' } });
    expect(explicitEngine.statusCode).toBe(201);
    expect(explicitEngine.json().data.knowledgeRevision).toBe(created.json().data.knowledgeRevision);
    await app.close();
  });

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
    const facets = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.otherTenant}/repair-knowledge/vehicle-facets`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(facets.statusCode).toBe(403);
    await app.close();
  });

  it('persists quote edits, manual pricing, provenance and retry across an API restart', async () => {
    let app = buildApi(pool, { authentication });
    const createBody = { vehicleId: ids.vehicle, idempotencyKey: 'rk04-demo-draft-001',
      vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' }, repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' };
    const created = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
      headers: { authorization: 'Bearer rk-user' }, payload: createBody });
    expect(created.statusCode).toBe(201);
    const draft = created.json().data;
    const rkLine = draft.lines.find((line: any) => line.lineSource === 'REPAIR_KNOWLEDGE');
    const patch = { expectedVersion: draft.version, idempotencyKey: 'rk04-edit-001', lines: [
      { id: rkLine.id, description: `${rkLine.description} editado`, itemType: rkLine.itemType, quantity: 2,
        unitPrice: 125.5, currency: 'EUR', selected: true },
      { mutationKey: 'manual-labor-001', description: 'Mano de obra distribución', itemType: 'LABOR', quantity: 3,
        unitPrice: null, currency: null, selected: true },
    ] };
    const edited = await app.inject({ method: 'PATCH', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${draft.id}`,
      headers: { authorization: 'Bearer rk-user' }, payload: patch });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().data.version).toBe(draft.version + 1);
    expect(edited.json().data.lines.find((line: any) => line.id === rkLine.id)).toMatchObject({
      unitPrice: 125.5, currency: 'EUR', pricingStatus: 'MANUALLY_PRICED', pricingProvenance: 'MANUAL_WORKSHOP',
      repairBomEdgeId: rkLine.repairBomEdgeId, evidence: rkLine.evidence,
    });
    expect(edited.json().data.lines.find((line: any) => line.lineSource === 'MANUAL_WORKSHOP')).toMatchObject({
      itemType: 'LABOR', unitPrice: null, pricingStatus: 'PENDING', evidence: [],
    });

    const replay = await app.inject({ method: 'PATCH', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${draft.id}`,
      headers: { authorization: 'Bearer rk-user' }, payload: patch });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.lines.filter((line: any) => line.lineSource === 'MANUAL_WORKSHOP')).toHaveLength(1);
    const stale = await app.inject({ method: 'PATCH', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${draft.id}`,
      headers: { authorization: 'Bearer rk-user' }, payload: { ...patch, idempotencyKey: 'rk04-edit-stale' } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe('ESTIMATE_VERSION_CONFLICT');

    const list = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((item: any) => item.id === draft.id)).toBe(true);
    await app.close();

    app = buildApi(pool, { authentication });
    const persisted = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${draft.id}`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(persisted.statusCode).toBe(200);
    expect(persisted.json().data.lines.find((line: any) => line.id === rkLine.id).unitPrice).toBe(125.5);
    const denied = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.otherTenant}/estimate-drafts/${draft.id}`,
      headers: { authorization: 'Bearer rk-user' } });
    expect(denied.statusCode).toBe(403);
    await app.close();
  });
});
