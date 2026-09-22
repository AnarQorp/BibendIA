import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const pool = createPool('migrator');
const client = await pool.connect();
try {
  const assumeMigratorRole = async () => {
    const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname='bibendia_migrator'");
    if (process.env.NODE_ENV === 'production' && !role.rowCount) throw new Error('bibendia_migrator role is not provisioned');
    if (role.rowCount) {
      const membership = await client.query("SELECT pg_has_role(session_user, 'bibendia_migrator', 'member') AS allowed");
      if (!membership.rows[0]?.allowed) throw new Error('database identity cannot assume bibendia_migrator');
      await client.query('SET ROLE bibendia_migrator');
    }
  };
  await assumeMigratorRole();
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const legacy = await client.query("SELECT to_regclass('public.tenants') AS tenants");
  if (legacy.rows[0].tenants) await client.query("INSERT INTO schema_migrations(name) VALUES ('001_vertical_slice.sql') ON CONFLICT DO NOTHING");
  const directory = resolve(here, '../../migrations');
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    await assumeMigratorRole();
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (applied.rowCount) continue;
    try {
      await client.query('BEGIN');
      await client.query(await readFile(resolve(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${name}\n`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally {
  client.release();
  await pool.end();
}
