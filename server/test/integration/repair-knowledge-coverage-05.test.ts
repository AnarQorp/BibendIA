import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';

describe('RK Coverage Expansion 05 — DV6C', () => {
  it('resolves Peugeot 308 I 9HR DV6C to the 141-tooth verified kit family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Peugeot', model: '308 I', engineCode: '9HR (DV6C)', repairJobCode: job,
    });
    expect(result?.applicability).toMatchObject({
      generation: '4A/4C', variant: '1.6 HDi 112', engineCode: '9HR (DV6C)',
    });
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('KP15656XS');
    expect(result?.components[0].notes).toContain('VKMC 03316');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves PSA DV6C applications without broadening into older DV6 codes', async () => {
    for (const [make, model] of [
      ['Citroen', 'C4 II'],
      ['Citroen', 'C4 Picasso I'],
      ['Peugeot', '508 I'],
    ] as const) {
      const result = await resolveRepairKnowledge(apiPool, {
        make, model, engineCode: '9HR (DV6C)', repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('141 teeth');
      expect(result?.components[0].evidence).toHaveLength(2);
    }

    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Peugeot', model: '308 I', engineCode: '9HZ (DV6TED4)', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('resolves Ford Focus and C-Max T1DA with OEM corroboration', async () => {
    for (const model of ['Focus III', 'C-Max II'] as const) {
      const result = await resolveRepairKnowledge(apiPool, {
        make: 'Ford', model, engineCode: 'T1DA', repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('Ford 2008686');
      expect(result?.components[0].evidence).toHaveLength(3);
    }
  });

  it('keeps DV6C coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_05()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_05()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(6);
    expect(Number(before.edges)).toBe(6);
    expect(Number(before.evidence)).toBe(14);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_PEUGEOT_308I_9HR_DV6C_TB_KIT','APP_CITROEN_C4II_9HR_DV6C_TB_KIT',
      'APP_CITROEN_C4PICASSO1_9HR_DV6C_TB_KIT','APP_PEUGEOT_508I_9HR_DV6C_TB_KIT',
      'APP_FORD_FOCUS3_T1DA_DV6_TB_KIT','APP_FORD_CMAX2_T1DA_DV6_TB_KIT'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_308I_9HR_DV6C_TB_KIT_001','EDGE_C4II_9HR_DV6C_TB_KIT_001',
      'EDGE_C4PICASSO1_9HR_DV6C_TB_KIT_001','EDGE_508I_9HR_DV6C_TB_KIT_001',
      'EDGE_FOCUS3_T1DA_DV6_TB_KIT_001','EDGE_CMAX2_T1DA_DV6_TB_KIT_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_308I_9HR_DV6C_TB_KIT_001','EDGE_C4II_9HR_DV6C_TB_KIT_001',
      'EDGE_C4PICASSO1_9HR_DV6C_TB_KIT_001','EDGE_508I_9HR_DV6C_TB_KIT_001',
      'EDGE_FOCUS3_T1DA_DV6_TB_KIT_001','EDGE_CMAX2_T1DA_DV6_TB_KIT_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
