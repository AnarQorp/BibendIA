import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';

describe('RK Coverage Expansion 08 — DV6 141-tooth exact codes', () => {
  it('resolves 9HP DV6DTED applications in C3 II, 207 and C3 Picasso', async () => {
    for (const [make, model] of [
      ['Citroen','C3 II'],
      ['Peugeot','207'],
      ['Citroen','C3 Picasso'],
    ] as const) {
      const result = await resolveRepairKnowledge(apiPool, {
        make, model, engineCode: '9HP (DV6DTED)', repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        partRole: { code: 'timing_belt_kit_water_pump' },
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('KP15656XS');
      expect(result?.components[0].notes).toContain('141 teeth / 25.4 mm');
      expect(result?.components[0].evidence).toHaveLength(2);
    }
  });

  it('resolves Peugeot 208 I 9HD DV6C without treating all DV6C as interchangeable', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Peugeot', model: '208 I', engineCode: '9HD (DV6C)', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('VKMC 03316');

    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Peugeot', model: '208 I', engineCode: '9HR (DV6C)', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('resolves Ford T3DA and T3JA exact applications', async () => {
    const focus = await resolveRepairKnowledge(apiPool, {
      make: 'Ford', model: 'Focus III', engineCode: 'T3DA', repairJobCode: job,
    });
    expect(focus?.components[0]).toMatchObject({
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(focus?.components[0].notes).toContain('KP15656XS');
    expect(focus?.components[0].evidence).toHaveLength(2);

    const fiesta = await resolveRepairKnowledge(apiPool, {
      make: 'Ford', model: 'Fiesta VI', engineCode: 'T3JA', repairJobCode: job,
    });
    expect(fiesta?.components[0]).toMatchObject({
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(fiesta?.components[0].evidence).toHaveLength(2);
  });

  it('does not infer related Ford TZJA/TZJB without explicit applicability rows', async () => {
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Ford', model: 'Fiesta VI', engineCode: 'TZJA', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('keeps DV6 141-tooth expansion idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_08()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_08()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(6);
    expect(Number(before.edges)).toBe(6);
    expect(Number(before.evidence)).toBe(12);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_CITROEN_C3II_9HP_DV6DTED_TB_KIT','APP_PEUGEOT_207_9HP_DV6DTED_TB_KIT',
      'APP_CITROEN_C3PICASSO_9HP_DV6DTED_TB_KIT','APP_PEUGEOT_208I_9HD_DV6C_TB_KIT',
      'APP_FORD_FOCUS3_T3DA_DV6_TB_KIT','APP_FORD_FIESTA6_T3JA_DV6_TB_KIT'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_C3II_9HP_DV6DTED_TB_KIT_001','EDGE_207_9HP_DV6DTED_TB_KIT_001',
      'EDGE_C3PICASSO_9HP_DV6DTED_TB_KIT_001','EDGE_208I_9HD_DV6C_TB_KIT_001',
      'EDGE_FOCUS3_T3DA_DV6_TB_KIT_001','EDGE_FIESTA6_T3JA_DV6_TB_KIT_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_C3II_9HP_DV6DTED_TB_KIT_001','EDGE_207_9HP_DV6DTED_TB_KIT_001',
      'EDGE_C3PICASSO_9HP_DV6DTED_TB_KIT_001','EDGE_208I_9HD_DV6C_TB_KIT_001',
      'EDGE_FOCUS3_T3DA_DV6_TB_KIT_001','EDGE_FIESTA6_T3JA_DV6_TB_KIT_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
