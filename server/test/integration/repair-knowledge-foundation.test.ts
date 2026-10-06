import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

beforeAll(async () => { await asMigrator('SELECT seed_repair_knowledge_poc_v1()'); });
afterAll(async () => { await asMigrator('SELECT seed_repair_knowledge_poc_v1()'); await apiPool.end(); await pool.end(); });

describe('RK01 PostgreSQL repair knowledge foundation', () => {
  it('requires explicit CLHA pump configuration and resolves evidenced kit variants', async () => {
    const ambiguous = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });
    expect(ambiguous).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (ambiguous?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected CLHA variant disambiguation');
    expect(ambiguous.options).toHaveLength(2);

    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA',
      variant: '1.6 TDI CLHA — pump with switch contact',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });
    expect(result?.applicability.engineCode).toBe('CLHA');
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('VKMC 01278');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('does not apply CLHA knowledge to an incompatible engine code', async () => {
    await expect(resolveRepairKnowledge(apiPool, { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CRMB', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' })).resolves.toBeNull();
  });

  it('seeds exactly the documented JSON blocks and is idempotent', async () => {
    const before = await counts();
    await asMigrator('SELECT seed_repair_knowledge_poc_v1()');
    await asMigrator('SELECT seed_repair_knowledge_poc_v1()');
    expect(await counts()).toEqual(before);
    expect(Number(before.jobs)).toBeGreaterThanOrEqual(4);
    expect(Number(before.applicability)).toBeGreaterThanOrEqual(1);
    expect(Number(before.edges)).toBeGreaterThanOrEqual(1);
    expect(Number(before.evidence)).toBeGreaterThanOrEqual(1);
  });

  it('blocks elevation when matching CLHA edge evidence is absent', async () => {
    await asMigrator("DELETE FROM repair_bom_evidence WHERE edge_id=(SELECT id FROM repair_bom_edges WHERE code='EDGE_GOLF7_CLHA_TB_SWITCH_001')");
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA',
      variant: '1.6 TDI CLHA — pump with switch contact',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });
    expect(result!.components[0]).toMatchObject({ automationEligible: false, confidenceReason: 'EVIDENCE_REQUIRED' });
    await asMigrator('SELECT seed_repair_knowledge_poc_v1()');
  });

  it('exposes only the explicit global catalog and no tenant-private vehicle rows to an unscoped API role', async () => {
    const client = await apiPool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE bibendia_api');
      expect(Number((await client.query('SELECT count(*) count FROM repair_bom_edges')).rows[0].count)).toBeGreaterThanOrEqual(21);
      expect((await client.query('SELECT id FROM vehicles')).rowCount).toBe(0);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });
});

async function counts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_jobs) jobs,
    (SELECT count(*)::text FROM repair_vehicle_applicabilities) applicability,
    (SELECT count(*)::text FROM repair_bom_edges) edges,
    (SELECT count(*)::text FROM repair_bom_evidence) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
