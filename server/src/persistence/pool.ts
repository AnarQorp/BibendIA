import pg from 'pg';

export const DEFAULT_DATABASE_URL = 'postgres://bibendia:bibendia@127.0.0.1:55432/bibendia';

export type DatabaseProcess = 'api' | 'worker' | 'migrator';
export type RuntimeDatabaseRole = 'bibendia_api' | 'bibendia_worker';

function connectionStringFor(processKind: DatabaseProcess): string {
  const processUrl = {
    api: process.env.API_DATABASE_URL,
    worker: process.env.WORKER_DATABASE_URL,
    migrator: process.env.MIGRATOR_DATABASE_URL,
  }[processKind];
  if (process.env.NODE_ENV === 'production' && !processUrl) {
    throw new Error(`${processKind.toUpperCase()}_DATABASE_URL is required in production`);
  }
  return processUrl ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function createPool(processKind: DatabaseProcess = 'api', connectionString = connectionStringFor(processKind)): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

export async function inTenantTransaction<T>(
  pool: pg.Pool,
  tenantId: string,
  work: (client: pg.PoolClient) => Promise<T>,
  role: RuntimeDatabaseRole = 'bibendia_api',
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
