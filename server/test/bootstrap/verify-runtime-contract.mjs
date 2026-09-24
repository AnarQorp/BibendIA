import pg from 'pg';
import { checkDatabaseReadiness } from '../../dist/src/runtime/readiness.js';

const required = ['API_DATABASE_URL', 'WORKER_DATABASE_URL', 'MIGRATOR_DATABASE_URL'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const pools = {
  api: new pg.Pool({ connectionString: process.env.API_DATABASE_URL }),
  worker: new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL }),
  migrator: new pg.Pool({ connectionString: process.env.MIGRATOR_DATABASE_URL }),
};

const expectDenied = async (promise, label) => {
  try {
    await promise;
    throw new Error(`${label} unexpectedly succeeded`);
  } catch (error) {
    if (error?.code !== '42501') throw error;
  }
};

try {
  for (const [processName, role] of [['api', 'bibendia_api'], ['worker', 'bibendia_worker']]) {
    const readiness = await checkDatabaseReadiness(pools[processName], role);
    if (!readiness.ready) throw new Error(`${processName} readiness failed: ${readiness.code}`);
    await expectDenied(pools[processName].query('CREATE TABLE public.forbidden_bootstrap_gate(id integer)'), `${processName} DDL`);
    await expectDenied(pools[processName].query('SELECT name FROM public.schema_migrations'), `${processName} migration read`);
    await expectDenied(pools[processName].query('SET ROLE bibendia_migrator'), `${processName} migrator assumption`);
  }

  const roles = await pools.migrator.query(
    `SELECT rolname, rolcanlogin, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolbypassrls
     FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname`,
    [['bibendia_api', 'bibendia_migrator', 'bibendia_worker']],
  );
  if (roles.rowCount !== 3 || roles.rows.some((role) =>
    role.rolcanlogin || role.rolsuper || role.rolinherit || role.rolcreaterole || role.rolcreatedb || role.rolbypassrls
  )) throw new Error('capability role attributes violate least privilege');

  const membership = await pools.migrator.query(
    `SELECT
       pg_has_role(session_user,'bibendia_migrator','member') AS migrator,
       pg_has_role(session_user,'bibendia_api','member') AS api,
       pg_has_role(session_user,'bibendia_worker','member') AS worker`,
  );
  if (!membership.rows[0]?.migrator || membership.rows[0]?.api || membership.rows[0]?.worker) {
    throw new Error('migrator login has incorrect capability membership');
  }
  const login = await pools.migrator.query(
    `SELECT rolcanlogin, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolbypassrls
     FROM pg_roles WHERE rolname=session_user`,
  );
  if (!login.rows[0]?.rolcanlogin || login.rows[0].rolsuper || login.rows[0].rolinherit
      || login.rows[0].rolcreaterole || login.rows[0].rolcreatedb || login.rows[0].rolbypassrls) {
    throw new Error('migrator login attributes violate least privilege');
  }

  const rls = await pools.migrator.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c
     JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped
     WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
       AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)`,
  );
  if (rls.rowCount) throw new Error(`tenant tables without FORCE RLS: ${rls.rows.map((row) => row.relname).join(',')}`);

  const client = await pools.migrator.connect();
  try {
    await client.query('SET ROLE bibendia_migrator');
    await client.query('BEGIN');
    await client.query('CREATE TABLE public.migrator_ddl_probe(id integer)');
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  process.stdout.write('bootstrap runtime contract: PASS\n');
} finally {
  await Promise.all(Object.values(pools).map((pool) => pool.end()));
}
