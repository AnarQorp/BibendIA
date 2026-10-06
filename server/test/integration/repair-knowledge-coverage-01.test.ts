import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Coverage Expansion 01 — K9K 872', () => {
  it('corrects the Mégane IV K9K 872 timing references and narrows applicability', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Renault',
      model: 'Mégane IV',
      engineCode: 'K9K 872',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });

    expect(result?.applicability).toMatchObject({
      generation: 'LVA/M/N',
      variant: '1.5 Blue dCi 95 (LVA2)',
      engineCode: 'K9K 872',
      productionFrom: '2019-02-01',
    });

    const belt = result!.components.find((edge) => edge.code === 'EDGE_MEGANE4_K9K_TB_001');
    expect(belt?.notes).toContain('5712XS');
    expect(belt?.notes).not.toContain('5671XS');
    expect(belt).toMatchObject({ confidenceState: 'MULTI_SOURCE_VERIFIED', automationEligible: true });
    expect(belt?.evidence).toHaveLength(2);

    const coolant = result!.consumables.find((edge) => edge.code === 'EDGE_MEGANE4_K9K_TB_004');
    expect(coolant).toMatchObject({
      confidenceState: 'UNKNOWN',
      automationEligible: false,
      manualReviewRequired: true,
    });
    expect(coolant?.quantity).toBeNull();
  });

  it('resolves a Nissan Qashqai II K9K 872 timing kit with two independent fitment evidence records', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Nissan',
      model: 'Qashqai II',
      engineCode: 'K9K 872',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });

    expect(result?.applicability).toMatchObject({
      generation: 'J11/J11_',
      variant: '1.5 dCi 116',
      engineCode: 'K9K 872',
    });
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      requirementType: 'REQUIRED',
      bomClassification: 'DERIVED_FROM_KIT',
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('KP15712XS');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves technically equivalent Duster II K9K 872 variants without inventing a false distinction', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Dacia',
      model: 'Duster II',
      engineCode: 'K9K 872',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });

    expect(result).toMatchObject({ status: 'RESOLVED', validForMultipleVariants: true });
    if (result?.status !== 'RESOLVED') throw new Error('expected resolved Duster K9K 872 result');
    expect(result.matchedApplicabilities).toHaveLength(2);
    expect(result.components[0].notes).toContain('VKMC 06140');
  });


  it('resolves Sandero II and NV250 applications from the same evidenced K9K 872 kit family', async () => {
    const sandero = await resolveRepairKnowledge(apiPool, {
      make: 'Dacia',
      model: 'Sandero II',
      engineCode: 'K9K 872',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });
    expect(sandero?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(sandero?.components[0].evidence).toHaveLength(2);

    const nv250 = await resolveRepairKnowledge(apiPool, {
      make: 'Nissan',
      model: 'NV250 Van',
      engineCode: 'K9K 872',
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
    });
    expect(nv250?.applicability).toMatchObject({ generation: 'X61', variant: 'dCi 80', engineCode: 'K9K 872' });
    expect(nv250?.components[0].notes).toContain('KP15712XS');
  });

  it('keeps the coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_01()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_01()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(14);
    expect(Number(before.edges)).toBe(14);
    expect(Number(before.evidence)).toBe(28);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities
      WHERE code IN (
        'APP_NISSAN_QASHQAIJ11_15DCI_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_DUSTER2_15DCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_DUSTER2_15DCI115_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_RENAULT_KANGOO2EXP_15DCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_RENAULT_GRANDKANGOO2_15DCI115_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_LODGY_15BLUEDCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_LODGY_15BLUEDCI115_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_DOKKER_15BLUEDCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_DOKKEREXP_15BLUEDCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_LOGANMCV2_15BLUEDCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_DACIA_SANDERO2_15BLUEDCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_RENAULT_SYMBOL3_15DCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_NISSAN_NV250VAN_DCI80_K9K872_JOB_TIMING_BELT_WATER_PUMP',
        'APP_NISSAN_NV250BUS_DCI80_K9K872_JOB_TIMING_BELT_WATER_PUMP'
      )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges
      WHERE code IN (
        'EDGE_QASHQAIJ11_K9K872_TB_KIT_001',
        'EDGE_DUSTER2_K9K872_95_TB_KIT_001',
        'EDGE_DUSTER2_K9K872_115_TB_KIT_001',
        'EDGE_KANGOO2EXP_K9K872_95_TB_KIT_001',
        'EDGE_GRANDKANGOO2_K9K872_115_TB_KIT_001',
        'EDGE_LODGY_K9K872_95_TB_KIT_001',
        'EDGE_LODGY_K9K872_115_TB_KIT_001',
        'EDGE_DOKKER_K9K872_95_TB_KIT_001',
        'EDGE_DOKKEREXP_K9K872_95_TB_KIT_001',
        'EDGE_LOGANMCV2_K9K872_95_TB_KIT_001',
        'EDGE_SANDERO2_K9K872_95_TB_KIT_001',
        'EDGE_SYMBOL3_K9K872_95_TB_KIT_001',
        'EDGE_NV250VAN_K9K872_80_TB_KIT_001',
        'EDGE_NV250BUS_K9K872_80_TB_KIT_001'
      )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      WHERE e.code IN (
        'EDGE_QASHQAIJ11_K9K872_TB_KIT_001',
        'EDGE_DUSTER2_K9K872_95_TB_KIT_001',
        'EDGE_DUSTER2_K9K872_115_TB_KIT_001',
        'EDGE_KANGOO2EXP_K9K872_95_TB_KIT_001',
        'EDGE_GRANDKANGOO2_K9K872_115_TB_KIT_001',
        'EDGE_LODGY_K9K872_95_TB_KIT_001',
        'EDGE_LODGY_K9K872_115_TB_KIT_001',
        'EDGE_DOKKER_K9K872_95_TB_KIT_001',
        'EDGE_DOKKEREXP_K9K872_95_TB_KIT_001',
        'EDGE_LOGANMCV2_K9K872_95_TB_KIT_001',
        'EDGE_SANDERO2_K9K872_95_TB_KIT_001',
        'EDGE_SYMBOL3_K9K872_95_TB_KIT_001',
        'EDGE_NV250VAN_K9K872_80_TB_KIT_001',
        'EDGE_NV250BUS_K9K872_80_TB_KIT_001'
      )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
