import { afterAll, describe, expect, it } from 'vitest';
import { listRepairKnowledgeVehicleFacets, resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';
const withSwitch = '1.6 TDI CLHA — pump with switch contact';
const withoutSwitch = '1.6 TDI CLHA — pump without switch contact';

describe('RK Coverage Expansion 02 — CLHA', () => {
  it('preserves but retires the ambiguous historical Golf timing applicability', async () => {
    const result = await asMigrator(
      `SELECT a.active,count(DISTINCT e.id)::int edges,count(DISTINCT v.id)::int evidence
       FROM repair_vehicle_applicabilities a
       JOIN repair_bom_edges e ON e.applicability_id=a.id
       LEFT JOIN repair_bom_evidence v ON v.edge_id=e.id
       WHERE a.code='APP_VAG_GOLF7_16TDI_CLHA_JOB_TIMING_BELT_WATER_PUMP'
       GROUP BY a.active`,
    );
    expect(result.rows[0]).toMatchObject({ active: false, edges: 6, evidence: 6 });

    const facets = await listRepairKnowledgeVehicleFacets(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: job,
    });
    expect(facets.variants).not.toContain('1.6 TDI');
  });

  it('requires pump-configuration disambiguation for Golf VII CLHA', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: job,
    });
    expect(result).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected variant disambiguation');
    expect(result.options.map((item) => item.variant)).toEqual(expect.arrayContaining([withSwitch, withoutSwitch]));
  });

  it('resolves switch-contact and no-switch-contact kits as different verified technical results', async () => {
    const switchResult = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', variant: withSwitch, repairJobCode: job,
    });
    const noSwitchResult = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', variant: withoutSwitch, repairJobCode: job,
    });

    expect(switchResult?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(switchResult?.components[0].notes).toContain('VKMC 01278');
    expect(switchResult?.components[0].notes).toContain('VKPC 81278');
    expect(switchResult?.components[0].evidence).toHaveLength(2);

    expect(noSwitchResult?.components[0].notes).toContain('VKMC 01278-1');
    expect(noSwitchResult?.components[0].notes).toContain('VKPC 81178');
    expect(noSwitchResult?.components[0].evidence).toHaveLength(2);
    expect(noSwitchResult?.components[0].notes).not.toBe(switchResult?.components[0].notes);
  });

  it('expands the same explicit configurations to A3, León and Octavia without collapsing them', async () => {
    const cases = [
      ['Audi', 'A3 Sportback 8V'],
      ['Seat', 'León III'],
      ['Skoda', 'Octavia III'],
    ] as const;

    for (const [make, model] of cases) {
      const ambiguous = await resolveRepairKnowledgeProgressively(apiPool, {
        make, model, engineCode: 'CLHA', repairJobCode: job,
      });
      expect(ambiguous).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });

      const exact = await resolveRepairKnowledge(apiPool, {
        make, model, engineCode: 'CLHA', variant: withSwitch, repairJobCode: job,
      });
      expect(exact?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(exact?.components[0].notes).toContain('VKMC 01278');
      expect(exact?.components[0].evidence).toHaveLength(2);
    }
  });

  it('keeps CLHA coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_02()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_02()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(8);
    expect(Number(before.edges)).toBe(8);
    expect(Number(before.evidence)).toBe(16);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_VW_GOLF7_CLHA_TB_SWITCH','APP_VW_GOLF7_CLHA_TB_NO_SWITCH',
      'APP_AUDI_A3_8VA_CLHA_TB_SWITCH','APP_AUDI_A3_8VA_CLHA_TB_NO_SWITCH',
      'APP_SEAT_LEON5F1_CLHA_TB_SWITCH','APP_SEAT_LEON5F1_CLHA_TB_NO_SWITCH',
      'APP_SKODA_OCTAVIA3_CLHA_TB_SWITCH','APP_SKODA_OCTAVIA3_CLHA_TB_NO_SWITCH'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_GOLF7_CLHA_TB_SWITCH_001','EDGE_GOLF7_CLHA_TB_NO_SWITCH_001',
      'EDGE_A3_8VA_CLHA_TB_SWITCH_001','EDGE_A3_8VA_CLHA_TB_NO_SWITCH_001',
      'EDGE_LEON5F1_CLHA_TB_SWITCH_001','EDGE_LEON5F1_CLHA_TB_NO_SWITCH_001',
      'EDGE_OCTAVIA3_CLHA_TB_SWITCH_001','EDGE_OCTAVIA3_CLHA_TB_NO_SWITCH_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_GOLF7_CLHA_TB_SWITCH_001','EDGE_GOLF7_CLHA_TB_NO_SWITCH_001',
      'EDGE_A3_8VA_CLHA_TB_SWITCH_001','EDGE_A3_8VA_CLHA_TB_NO_SWITCH_001',
      'EDGE_LEON5F1_CLHA_TB_SWITCH_001','EDGE_LEON5F1_CLHA_TB_NO_SWITCH_001',
      'EDGE_OCTAVIA3_CLHA_TB_SWITCH_001','EDGE_OCTAVIA3_CLHA_TB_NO_SWITCH_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
