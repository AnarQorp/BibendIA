import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const ids = { tenant: randomUUID(), otherTenant: randomUUID(), user: randomUUID() };
const principal: PrincipalContext = { kind: 'workshop_user', audience: 'workshop', userId: ids.user, issuer: 'test', subject: ids.user,
  sessionId: randomUUID(), authenticatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), assurance: 'single_factor' };
const authentication: AuthenticationAdapter = { async authenticate(request) { return request.authorization === 'Bearer catalog-user' ? principal : null; } };

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Catalog API','pilot'),($2,'Catalog Other','pilot')", [ids.tenant, ids.otherTenant]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active')", [ids.user]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES($1,$2,'OWNER','active')", [ids.user, ids.tenant]);
});
afterAll(async () => {
  await pool.query('DELETE FROM tenant_memberships WHERE user_id=$1', [ids.user]);
  await pool.query('DELETE FROM users WHERE id=$1', [ids.user]);
  await pool.query('DELETE FROM tenants WHERE id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.end();
});

describe('RK06 VehiclesDB vehicle catalog', () => {
  it('pins provenance, imports the ES car/van slice, and reimports idempotently', async () => {
    const before = await counts();
    await pool.query('SELECT seed_vehicle_catalog_vehiclesdb_2026_09_1()');
    await pool.query('SELECT seed_vehicle_catalog_vehiclesdb_2026_09_1()');
    expect(await counts()).toEqual(before);
    expect(before).toEqual({ sources: 1, makes: 193, distinctMakes: 165, cars: 1189, vans: 195, availability: 1384, links: 3 });
    const source = (await pool.query(`SELECT dataset_version,artifact_sha256,license_spdx,attribution,attribution_sha256,active
      FROM vehicle_catalog_sources WHERE provider='VehiclesDB'`)).rows[0];
    expect(source).toMatchObject({ dataset_version: '2026.09.1',
      artifact_sha256: '5cbed181c933e16e7ffeaf2cb7fcbd831774e2223f35eea60d1bd6b115c7d2ca', license_spdx: 'CC-BY-4.0',
      attribution: 'Vehicle data by VehiclesDB (https://vehiclesdb.com)',
      attribution_sha256: 'c14cf3ed4869664b9c1c2263b872eb0e6cda0d405b6fa26980615f21fe21359d', active: true });
    expect((await pool.query(`SELECT count(*)::int n FROM (SELECT source_id,kind,make_id,slug,count(*) FROM vehicle_catalog_models
      GROUP BY source_id,kind,make_id,slug HAVING count(*)>1) duplicates`)).rows[0].n).toBe(0);
  });

  it('supports clean source rollback through cascading ownership', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("DELETE FROM vehicle_catalog_sources WHERE provider='VehiclesDB' AND dataset_version='2026.09.1'");
      expect((await client.query('SELECT count(*)::int n FROM vehicle_catalog_models')).rows[0].n).toBe(0);
      await client.query('ROLLBACK');
    } finally { client.release(); }
    expect((await counts()).cars).toBe(1189);
  });

  it('separates catalog existence from Repair Knowledge coverage', async () => {
    const app = buildApi(pool, { authentication });
    const peugeot = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/vehicle-catalog/facets?kind=car&make=peugeot&model=308`,
      headers: { authorization: 'Bearer catalog-user' } });
    expect(peugeot.statusCode).toBe(200);
    expect(peugeot.json().data.models).toContainEqual(expect.objectContaining({ name: '308', repairKnowledgeAvailable: false, repairKnowledgeTargets: [] }));
    const noFalseKnowledge = await app.inject({ method: 'GET',
      url: `/v1/workshop/tenants/${ids.tenant}/repair-knowledge/resolve?make=Peugeot&model=308&repairJobCode=JOB_MAINT_SERVICE`,
      headers: { authorization: 'Bearer catalog-user' } });
    expect(noFalseKnowledge.statusCode).toBe(404);
    const golf = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/vehicle-catalog/facets?kind=car&make=volkswagen&model=golf`,
      headers: { authorization: 'Bearer catalog-user' } });
    expect(golf.statusCode).toBe(200);
    expect(golf.json().data.models).toContainEqual(expect.objectContaining({ name: 'Golf', repairKnowledgeAvailable: true,
      repairKnowledgeTargets: [{ make: 'Volkswagen', model: 'Golf VII' }] }));
    expect(golf.json().data.source).toMatchObject({ provider: 'VehiclesDB', version: '2026.09.1', license: 'CC-BY-4.0' });
    await app.close();
  });

  it('links all three existing RK models and preserves tenant authorization', async () => {
    const links = await pool.query(`SELECT l.rk_make,l.rk_model,count(DISTINCT a.id)::int applicability
      FROM vehicle_catalog_rk_model_links l JOIN repair_vehicle_applicabilities a
        ON lower(a.make)=lower(l.rk_make) AND lower(a.model)=lower(l.rk_model)
      GROUP BY l.rk_make,l.rk_model ORDER BY l.rk_make`);
    expect(links.rows).toEqual([
      { rk_make: 'Renault', rk_model: 'Mégane IV', applicability: 1 },
      { rk_make: 'Seat', rk_model: 'León 5F', applicability: 2 },
      { rk_make: 'Volkswagen', rk_model: 'Golf VII', applicability: 4 },
    ]);
    const app = buildApi(pool, { authentication });
    const denied = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.otherTenant}/vehicle-catalog/facets`,
      headers: { authorization: 'Bearer catalog-user' } });
    expect(denied.statusCode).toBe(403);
    const anonymous = await app.inject({ method: 'GET', url: `/v1/workshop/tenants/${ids.tenant}/vehicle-catalog/facets` });
    expect(anonymous.statusCode).toBe(401);
    await app.close();
  });
});

async function counts() {
  const row = (await pool.query(`SELECT
    (SELECT count(*)::int FROM vehicle_catalog_sources) sources,
    (SELECT count(*)::int FROM vehicle_catalog_makes) makes,
    (SELECT count(DISTINCT source_make_id)::int FROM vehicle_catalog_makes) "distinctMakes",
    (SELECT count(*)::int FROM vehicle_catalog_models WHERE kind='car') cars,
    (SELECT count(*)::int FROM vehicle_catalog_models WHERE kind='van') vans,
    (SELECT count(*)::int FROM vehicle_catalog_availability WHERE country_code='ES') availability,
    (SELECT count(*)::int FROM vehicle_catalog_rk_model_links) links`)).rows[0];
  return row;
}
