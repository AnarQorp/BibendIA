import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const tenantA = randomUUID();
const tenantB = randomUUID();

beforeAll(async () => {
  await pool.query("RESET ROLE");
  await pool.query("INSERT INTO tenants(id,name) VALUES ($1,'Role test A'),($2,'Role test B')", [tenantA, tenantB]);
  await inTenantTransaction(pool, tenantA, async (client) => {
    await client.query(
      "INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb) VALUES ($1,'tenant',$1,'role.test','{}')",
      [tenantA],
    );
  });
});

afterAll(async () => {
  await pool.query('RESET ROLE');
  await pool.query('DELETE FROM outbox_events WHERE tenant_id IN ($1,$2)', [tenantA, tenantB]);
  await pool.query('DELETE FROM tenants WHERE id IN ($1,$2)', [tenantA, tenantB]);
  await pool.end();
});

describe('P0.1 database role isolation', () => {
  it('keeps all runtime roles non-privileged and unable to bypass RLS', async () => {
    const result = await pool.query(
      `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
       FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname`,
      [['bibendia_api', 'bibendia_migrator', 'bibendia_worker']],
    );
    expect(result.rows).toHaveLength(3);
    for (const role of result.rows) {
      expect(role).toMatchObject({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false });
    }
  });

  it('forces RLS on every tenant-owned table', async () => {
    const result = await pool.query(
      `SELECT DISTINCT c.relname, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped
       WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')`,
    );
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('does not expose another tenant outbox row to the worker', async () => {
    const rows = await inTenantTransaction(
      pool,
      tenantB,
      (client) => client.query('SELECT id FROM outbox_events'),
      'bibendia_worker',
    );
    expect(rows.rowCount).toBe(0);
  });

  it('does not let the worker read business tables', async () => {
    await expect(inTenantTransaction(
      pool,
      tenantA,
      (client) => client.query('SELECT id FROM appointments'),
      'bibendia_worker',
    )).rejects.toMatchObject({ code: '42501' });
  });

  it('does not let API runtime read migration state or create schema objects', async () => {
    await expect(inTenantTransaction(
      pool,
      tenantA,
      (client) => client.query('SELECT name FROM schema_migrations'),
    )).rejects.toMatchObject({ code: '42501' });
    await expect(inTenantTransaction(
      pool,
      tenantA,
      (client) => client.query('CREATE TABLE forbidden_runtime_ddl(id integer)'),
    )).rejects.toMatchObject({ code: '42501' });
  });

  it('does not let Worker runtime read migration state or create schema objects', async () => {
    await expect(inTenantTransaction(
      pool, tenantA, (client) => client.query('SELECT name FROM schema_migrations'), 'bibendia_worker',
    )).rejects.toMatchObject({ code: '42501' });
    await expect(inTenantTransaction(
      pool, tenantA, (client) => client.query('CREATE TABLE forbidden_worker_ddl(id integer)'), 'bibendia_worker',
    )).rejects.toMatchObject({ code: '42501' });
  });
});
