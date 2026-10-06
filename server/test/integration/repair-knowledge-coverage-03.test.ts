import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';
const withSwitch = '2.0 TDI CRMB — pump with switch contact';
const withoutSwitch = '2.0 TDI CRMB — pump without switch contact';

describe('RK Coverage Expansion 03 — CRMB', () => {
  it('removes the ambiguous historical León timing applicability without touching brakes', async () => {
    const timing = await asMigrator(
      "SELECT count(*)::int count FROM repair_vehicle_applicabilities WHERE code='APP_SEAT_LEON5F_20TDI_CRMB_JOB_TIMING_BELT_WATER_PUMP'",
    );
    expect(timing.rows[0].count).toBe(0);

    const brakes = await resolveRepairKnowledge(apiPool, {
      make: 'Seat', model: 'León 5F', engineCode: 'CRMB',
      repairJobCode: 'JOB_BRAKE_DISCS_PADS_FRONT',
    });
    expect(brakes?.components.length).toBeGreaterThan(0);
  });

  it('requires pump-configuration disambiguation for León 5F CRMB', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Seat', model: 'León 5F', engineCode: 'CRMB', repairJobCode: job,
    });
    expect(result).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected CRMB variant disambiguation');
    expect(result.options.map((item) => item.variant)).toEqual(expect.arrayContaining([withSwitch, withoutSwitch]));
  });

  it('resolves both CRMB pump configurations as distinct verified kit facts', async () => {
    const switchResult = await resolveRepairKnowledge(apiPool, {
      make: 'Seat', model: 'León 5F', engineCode: 'CRMB', variant: withSwitch, repairJobCode: job,
    });
    const noSwitchResult = await resolveRepairKnowledge(apiPool, {
      make: 'Seat', model: 'León 5F', engineCode: 'CRMB', variant: withoutSwitch, repairJobCode: job,
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
  });

  it('expands explicit CRMB configurations to Golf VII and Octavia III', async () => {
    for (const [make, model] of [['Volkswagen','Golf VII'],['Skoda','Octavia III']] as const) {
      const ambiguous = await resolveRepairKnowledgeProgressively(apiPool, {
        make, model, engineCode: 'CRMB', repairJobCode: job,
      });
      expect(ambiguous).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });

      const exact = await resolveRepairKnowledge(apiPool, {
        make, model, engineCode: 'CRMB', variant: withSwitch, repairJobCode: job,
      });
      expect(exact?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(exact?.components[0].notes).toContain('VKMC 01278');
      expect(exact?.components[0].evidence).toHaveLength(2);
    }
  });

  it('keeps CRMB coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_03()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_03()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(6);
    expect(Number(before.edges)).toBe(6);
    expect(Number(before.evidence)).toBe(12);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_SEAT_LEON5F_CRMB_TB_SWITCH','APP_SEAT_LEON5F_CRMB_TB_NO_SWITCH',
      'APP_VW_GOLF7_CRMB_TB_SWITCH','APP_VW_GOLF7_CRMB_TB_NO_SWITCH',
      'APP_SKODA_OCTAVIA3_CRMB_TB_SWITCH','APP_SKODA_OCTAVIA3_CRMB_TB_NO_SWITCH'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_LEON5F_CRMB_TB_SWITCH_001','EDGE_LEON5F_CRMB_TB_NO_SWITCH_001',
      'EDGE_GOLF7_CRMB_TB_SWITCH_001','EDGE_GOLF7_CRMB_TB_NO_SWITCH_001',
      'EDGE_OCTAVIA3_CRMB_TB_SWITCH_001','EDGE_OCTAVIA3_CRMB_TB_NO_SWITCH_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_LEON5F_CRMB_TB_SWITCH_001','EDGE_LEON5F_CRMB_TB_NO_SWITCH_001',
      'EDGE_GOLF7_CRMB_TB_SWITCH_001','EDGE_GOLF7_CRMB_TB_NO_SWITCH_001',
      'EDGE_OCTAVIA3_CRMB_TB_SWITCH_001','EDGE_OCTAVIA3_CRMB_TB_NO_SWITCH_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
