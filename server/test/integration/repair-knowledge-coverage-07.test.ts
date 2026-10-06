import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';

describe('RK Coverage Expansion 07 — K9K 636/646', () => {
  it('resolves Qashqai J11 K9K 636 to the verified KP15675XS family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Nissan', model: 'Qashqai II', engineCode: 'K9K 636', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('KP15675XS');
    expect(result?.components[0].notes).toContain('119 teeth / 27 mm');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('collapses Qashqai K9K 636/646 after the 110 hp variant excludes K9K 872', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Nissan', model: 'Qashqai II', variant: '1.5 dCi 110', repairJobCode: job,
    });
    expect(result).toMatchObject({ status: 'RESOLVED', validForMultipleVariants: true });
    if (result?.status !== 'RESOLVED') throw new Error('expected equivalent Qashqai K9K variants to resolve');
    expect(result.matchedApplicabilities).toHaveLength(2);
    expect(result.matchedApplicabilities.some((code) => code.includes('K9K636'))).toBe(true);
    expect(result.matchedApplicabilities.some((code) => code.includes('K9K646'))).toBe(true);
  });

  it('resolves the narrow Renault K9K set', async () => {
    const cases = [
      ['Mégane III', 'K9K 636'],
      ['Mégane III Grandtour', 'K9K 636'],
      ['Kangoo II / Grand Kangoo', 'K9K 636'],
      ['Kangoo II / Grand Kangoo', 'K9K 646'],
      ['Captur I', 'K9K 646'],
      ['Clio IV', 'K9K 646'],
    ] as const;
    for (const [model, engineCode] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make: 'Renault', model, engineCode, repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('KP15675XS');
      expect(result?.components[0].evidence).toHaveLength(2);
    }
  });

  it('does not leak adjacent K9K 647/648/649 coverage', async () => {
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Renault', model: 'Kangoo II / Grand Kangoo', engineCode: 'K9K 648', repairJobCode: job,
    })).resolves.toBeNull();
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Renault', model: 'Captur I', engineCode: 'K9K 856', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('keeps K9K 636/646 coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_07()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_07()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(8);
    expect(Number(before.edges)).toBe(8);
    expect(Number(before.evidence)).toBe(16);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_NISSAN_QASHQAIJ11_K9K636_TB_KIT','APP_NISSAN_QASHQAIJ11_K9K646_TB_KIT',
      'APP_RENAULT_MEGANE3_BZ_K9K636_TB_KIT','APP_RENAULT_MEGANE3_KZ_K9K636_TB_KIT',
      'APP_RENAULT_KANGOO2_K9K636_TB_KIT','APP_RENAULT_KANGOO2_K9K646_TB_KIT',
      'APP_RENAULT_CAPTUR1_K9K646_TB_KIT','APP_RENAULT_CLIO4_K9K646_TB_KIT'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_QASHQAIJ11_K9K636_TB_KIT_001','EDGE_QASHQAIJ11_K9K646_TB_KIT_001',
      'EDGE_MEGANE3_BZ_K9K636_TB_KIT_001','EDGE_MEGANE3_KZ_K9K636_TB_KIT_001',
      'EDGE_KANGOO2_K9K636_TB_KIT_001','EDGE_KANGOO2_K9K646_TB_KIT_001',
      'EDGE_CAPTUR1_K9K646_TB_KIT_001','EDGE_CLIO4_K9K646_TB_KIT_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_QASHQAIJ11_K9K636_TB_KIT_001','EDGE_QASHQAIJ11_K9K646_TB_KIT_001',
      'EDGE_MEGANE3_BZ_K9K636_TB_KIT_001','EDGE_MEGANE3_KZ_K9K636_TB_KIT_001',
      'EDGE_KANGOO2_K9K636_TB_KIT_001','EDGE_KANGOO2_K9K646_TB_KIT_001',
      'EDGE_CAPTUR1_K9K646_TB_KIT_001','EDGE_CLIO4_K9K646_TB_KIT_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
