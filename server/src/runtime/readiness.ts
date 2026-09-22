import type pg from 'pg';
import { EXPECTED_SCHEMA_VERSION } from './config.js';

export type ReadinessResult = { ready: true; schemaVersion: string } | { ready: false; code: string };

export async function checkDatabaseReadiness(pool: pg.Pool, requiredRole: 'bibendia_api' | 'bibendia_worker'): Promise<ReadinessResult> {
  try {
    const client = await pool.connect();
    try {
      const role = await client.query<{ member: boolean; migrator: boolean }>(
        `SELECT pg_has_role(current_user,$1,'member') AS member,
          pg_has_role(current_user,'bibendia_migrator','member') AS migrator`, [requiredRole],
      );
      if (!role.rows[0]?.member || role.rows[0]?.migrator) return { ready: false, code: 'DATABASE_IDENTITY_INVALID' };
      await client.query(`SET ROLE ${requiredRole}`);
      const schema = await client.query<{ schema_version: string; compatible: boolean }>('SELECT schema_version,compatible FROM runtime_schema_status()');
      if (schema.rowCount !== 1 || !schema.rows[0].compatible || schema.rows[0].schema_version !== EXPECTED_SCHEMA_VERSION) {
        return { ready: false, code: 'SCHEMA_INCOMPATIBLE' };
      }
      return { ready: true, schemaVersion: schema.rows[0].schema_version };
    } finally { client.release(); }
  } catch (error) {
    const code = (error as { code?: string }).code;
    return { ready: false, code: code === '42883' || code === '42501' ? 'SCHEMA_INCOMPATIBLE' : 'DATABASE_UNAVAILABLE' };
  }
}
