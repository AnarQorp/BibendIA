import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const pool = createPool('migrator');
try {
  const assumeMigratorRole = async () => {
    const role = await pool.query("SELECT 1 FROM pg_roles WHERE rolname='bibendia_migrator'");
    if (role.rowCount) await pool.query('SET ROLE bibendia_migrator');
  };
  await assumeMigratorRole();
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const legacy = await pool.query("SELECT to_regclass('public.tenants') AS tenants");
  if (legacy.rows[0].tenants) await pool.query("INSERT INTO schema_migrations(name) VALUES ('001_vertical_slice.sql') ON CONFLICT DO NOTHING");
  const directory = resolve(here, '../../migrations');
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    await assumeMigratorRole();
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (applied.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(resolve(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${name}\n`);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
} finally {
  await pool.end();
}
