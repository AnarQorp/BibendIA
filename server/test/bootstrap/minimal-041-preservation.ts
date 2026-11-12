// [TEST ONLY] Synthetic fixtures; never connect to an existing workshop database.
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertIsolatedTestDatabase } from '../../src/persistence/test-database-guard.js';
import { createPool } from '../../src/persistence/pool.js';

assertIsolatedTestDatabase(process.env);
const pool = createPool('migrator');
const client = await pool.connect();
try {
  const applied = (await client.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r => r.name);
  assert.equal(applied.at(-1), '040_repair_knowledge_clutch_01_priority.sql', 'Must start from schema 040');
  await client.query('BEGIN');
  const tenant = randomUUID(), user = randomUUID();
  await client.query(`INSERT INTO tenants(id,name,lifecycle_status,operating_mode) VALUES($1,'Existing synthetic tenant','active','standard')`, [tenant]);
  await client.query(`INSERT INTO workshops(tenant_id,name) VALUES($1,'Existing synthetic workshop')`, [tenant]);
  await client.query(`INSERT INTO users(id,status) VALUES($1,'active')`, [user]);
  await client.query(`INSERT INTO external_identities(user_id,issuer,subject) VALUES($1,'https://existing.example.invalid/',$2)`, [user, user]);
  await client.query(`INSERT INTO tenant_memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`, [tenant,user]);
  const names = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY tablename`)).rows.map(r => r.tablename as string);
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const name of names) {
      const quoted = '"' + name.replaceAll('"','""') + '"';
      result[name] = (await client.query(`SELECT count(*)::text AS count,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS digest FROM public.${quoted} t`)).rows[0];
    }
    return result;
  }
  const before = await snapshot();
  await client.query('SET LOCAL ROLE bibendia_migrator');
  await client.query(await readFile(new URL('../../migrations/041_workshop_invitations.sql', import.meta.url), 'utf8'));
  await client.query(`INSERT INTO schema_migrations(name) VALUES('041_workshop_invitations.sql')`);
  await client.query('RESET ROLE');
  assert.deepEqual(await snapshot(), before, '041 must preserve every existing business-table row');
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='plan_code'`)).rows[0].n, 0);
  assert.equal((await client.query('SELECT compatible FROM runtime_schema_status()')).rows[0].compatible, true);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM workshop_invitations')).rows[0].n, 0);
  console.log(`PASS: 040→041 preserves ${names.length} existing business tables exactly, creates no invitations or plan column, and reports schema compatible`);
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
