import pg from 'pg';

export const DEFAULT_DATABASE_URL = 'postgres://bibendia:bibendia@127.0.0.1:55432/bibendia';

export function createPool(connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

export async function inTenantTransaction<T>(pool: pg.Pool, tenantId: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_runtime');
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
