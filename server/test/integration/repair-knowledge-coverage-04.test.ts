import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';

describe('RK Coverage Expansion 04 — CAYC', () => {
  it('resolves Golf VI CAYC to the verified KP25649XS-1 / VKMC 01148-2 family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VI', engineCode: 'CAYC', repairJobCode: job,
    });
    expect(result?.applicability).toMatchObject({
      generation: '5K1', variant: '1.6 TDI 105', engineCode: 'CAYC',
    });
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('KP25649XS-1');
    expect(result?.components[0].notes).toContain('VKMC 01148-2');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves the same evidenced kit family across A3, León, Ibiza, Octavia, Touran, Altea and Roomster', async () => {
    const cases = [
      ['Audi', 'A3 Sportback 8P'],
      ['Seat', 'León II'],
      ['Seat', 'Ibiza IV SportCoupe'],
      ['Skoda', 'Octavia II'],
      ['Volkswagen', 'Touran'],
      ['Seat', 'Altea'],
      ['Skoda', 'Roomster'],
    ] as const;

    for (const [make, model] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make, model, engineCode: 'CAYC', repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        partRole: { code: 'timing_belt_kit_water_pump' },
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('160 teeth / 25 mm');
      expect(result?.components[0].evidence).toHaveLength(2);
    }
  });

  it('does not apply CAYC timing knowledge to CAYB', async () => {
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VI', engineCode: 'CAYB', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('keeps CAYC coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_04()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_04()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(8);
    expect(Number(before.edges)).toBe(8);
    expect(Number(before.evidence)).toBe(16);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_VW_GOLF6_CAYC_TB_KIT','APP_AUDI_A3_8PA_CAYC_TB_KIT',
      'APP_SEAT_LEON1P_CAYC_TB_KIT','APP_SEAT_IBIZA6JSC_CAYC_TB_KIT',
      'APP_SKODA_OCTAVIA2_CAYC_TB_KIT','APP_VW_TOURAN1T3_CAYC_TB_KIT',
      'APP_SEAT_ALTEA5P1_CAYC_TB_KIT','APP_SKODA_ROOMSTER5J_CAYC_TB_KIT'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_GOLF6_CAYC_TB_KIT_001','EDGE_A3_8PA_CAYC_TB_KIT_001',
      'EDGE_LEON1P_CAYC_TB_KIT_001','EDGE_IBIZA6JSC_CAYC_TB_KIT_001',
      'EDGE_OCTAVIA2_CAYC_TB_KIT_001','EDGE_TOURAN1T3_CAYC_TB_KIT_001',
      'EDGE_ALTEA5P1_CAYC_TB_KIT_001','EDGE_ROOMSTER5J_CAYC_TB_KIT_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_GOLF6_CAYC_TB_KIT_001','EDGE_A3_8PA_CAYC_TB_KIT_001',
      'EDGE_LEON1P_CAYC_TB_KIT_001','EDGE_IBIZA6JSC_CAYC_TB_KIT_001',
      'EDGE_OCTAVIA2_CAYC_TB_KIT_001','EDGE_TOURAN1T3_CAYC_TB_KIT_001',
      'EDGE_ALTEA5P1_CAYC_TB_KIT_001','EDGE_ROOMSTER5J_CAYC_TB_KIT_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
