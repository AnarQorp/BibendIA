import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_TIMING_BELT_WATER_PUMP';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Coverage Expansion 09 — legacy DV6 9HZ/9HY/9HX', () => {
  it('resolves C4 I 9HZ to the verified 137-tooth family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Citroen', model: 'C4 I', engineCode: '9HZ (DV6TED4)', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('137 teeth / 25 mm');
    expect(result?.components[0].notes).toContain('KP15598XS');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves the evidenced PSA legacy DV6 applications', async () => {
    const cases = [
      ['Citroen','C4 Sedan','9HZ (DV6TED4)'],
      ['Citroen','C4 Grand Picasso I','9HZ (DV6TED4)'],
      ['Peugeot','308 SW','9HY (DV6TED4)'],
      ['Peugeot','207','9HY (DV6TED4)'],
      ['Citroen','Xsara Picasso','9HX (DV6ATED4)'],
      ['Citroen','C3 II','9HX (DV6ATED4)'],
      ['Citroen','Berlingo First','9HX (DV6ATED4)'],
    ] as const;

    for (const [make, model, engineCode] of cases) {
      const result = await resolveRepairKnowledge(apiPool, { make, model, engineCode, repairJobCode: job });
      expect(result?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('137 teeth / 25 mm');
      expect(result?.components[0].evidence).toHaveLength(2);
    }
  });

  it('does not collapse the later 141-tooth DV6C family into legacy DV6', async () => {
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Peugeot', model: '308 I', engineCode: '9HR (DV6C)', repairJobCode: job,
    })).resolves.not.toBeNull();

    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Citroen', model: 'C4 I', engineCode: '9HR (DV6C)', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('keeps legacy DV6 coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_09()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_09()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(8);
    expect(Number(before.edges)).toBe(8);
    expect(Number(before.evidence)).toBe(16);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_CITROEN_C4I_9HZ_DV6TED4_TB_KIT','APP_CITROEN_C4SEDAN_9HZ_DV6TED4_TB_KIT',
      'APP_CITROEN_C4GRANDPICASSO1_9HZ_DV6TED4_TB_KIT','APP_PEUGEOT_308SW_9HY_DV6TED4_TB_KIT',
      'APP_PEUGEOT_207_9HY_DV6TED4_TB_KIT','APP_CITROEN_XSARAPICASSO_9HX_DV6ATED4_TB_KIT',
      'APP_CITROEN_C3II_9HX_DV6ATED4_TB_KIT','APP_CITROEN_BERLINGOFIRST_9HX_DV6ATED4_TB_KIT'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_C4I_9HZ_DV6TED4_TB_KIT_001','EDGE_C4SEDAN_9HZ_DV6TED4_TB_KIT_001',
      'EDGE_C4GRANDPICASSO1_9HZ_DV6TED4_TB_KIT_001','EDGE_308SW_9HY_DV6TED4_TB_KIT_001',
      'EDGE_207_9HY_DV6TED4_TB_KIT_001','EDGE_XSARAPICASSO_9HX_DV6ATED4_TB_KIT_001',
      'EDGE_C3II_9HX_DV6ATED4_TB_KIT_001','EDGE_BERLINGOFIRST_9HX_DV6ATED4_TB_KIT_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_C4I_9HZ_DV6TED4_TB_KIT_001','EDGE_C4SEDAN_9HZ_DV6TED4_TB_KIT_001',
      'EDGE_C4GRANDPICASSO1_9HZ_DV6TED4_TB_KIT_001','EDGE_308SW_9HY_DV6TED4_TB_KIT_001',
      'EDGE_207_9HY_DV6TED4_TB_KIT_001','EDGE_XSARAPICASSO_9HX_DV6ATED4_TB_KIT_001',
      'EDGE_C3II_9HX_DV6ATED4_TB_KIT_001','EDGE_BERLINGOFIRST_9HX_DV6ATED4_TB_KIT_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
