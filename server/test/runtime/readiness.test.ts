import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { checkDatabaseReadiness } from '../../src/runtime/readiness.js';

function pool(responses: Array<{ rows?: unknown[]; rowCount?: number } | Error>): pg.Pool {
  let index = 0;
  const client = {
    query: async () => {
      const response = responses[index++];
      if (response instanceof Error) throw response;
      return response;
    },
    release() {},
  };
  return { connect: async () => client } as unknown as pg.Pool;
}

describe('runtime readiness', () => {
  it('passes only for the expected role and exact schema', async () => {
    const result = await checkDatabaseReadiness(pool([
      { rows: [{ member: true, migrator: false }] }, { rows: [] },
      { rows: [{ schema_version: '010_real_scheduling_acquisition.sql', compatible: true }], rowCount: 1 },
    ]), 'bibendia_api');
    expect(result).toEqual({ ready: true, schemaVersion: '010_real_scheduling_acquisition.sql' });
  });

  it('fails closed for wrong identity, old/new schema, and database outage', async () => {
    expect(await checkDatabaseReadiness(pool([{ rows: [{ member: false, migrator: false }] }]), 'bibendia_api')).toEqual({ ready: false, code: 'DATABASE_IDENTITY_INVALID' });
    const missingFunction = Object.assign(new Error('function details'), { code: '42883' });
    expect(await checkDatabaseReadiness(pool([{ rows: [{ member: true, migrator: false }] }, { rows: [] }, missingFunction]), 'bibendia_worker')).toEqual({ ready: false, code: 'SCHEMA_INCOMPATIBLE' });
    const unavailable = { connect: async () => { throw new Error('secret database details'); } } as unknown as pg.Pool;
    expect(await checkDatabaseReadiness(unavailable, 'bibendia_api')).toEqual({ ready: false, code: 'DATABASE_UNAVAILABLE' });
  });
});
