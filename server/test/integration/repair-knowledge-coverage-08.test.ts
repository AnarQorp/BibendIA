import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';

describe('RK Coverage Expansion 08 — Opel 1.7 CDTI A17DTR/Z17DTR', () => {
  it('resolves Astra J A17DTR to the verified 131-tooth family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Opel', model: 'Astra J', engineCode: 'A17DTR', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('131 teeth / 25 mm');
    expect(result?.components[0].notes).toContain('KP35623XS-1');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves the evidenced Astra/Zafira/Corsa 125 hp applications', async () => {
    const cases = [
      ['Astra H', 'Z17DTR'],
      ['Astra H', 'A17DTR'],
      ['Astra J Sports Tourer', 'A17DTR'],
      ['Zafira B', 'Z17DTR'],
      ['Zafira B', 'A17DTR'],
      ['Corsa D', 'Z17DTR'],
    ] as const;

    for (const [model, engineCode] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make: 'Opel', model, engineCode, repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('131 teeth / 25 mm');
      expect(result?.components[0].evidence).toHaveLength(2);
    }
  });

  it('does not leak coverage to the different Z17DTH 100/101 hp family', async () => {
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Opel', model: 'Astra H', engineCode: 'Z17DTH', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('keeps Opel 1.7 CDTI coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_08()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_08()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(7);
    expect(Number(before.edges)).toBe(7);
    expect(Number(before.evidence)).toBe(14);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code IN (
      'APP_OPEL_ASTRAH_L48_Z17DTR_TB_KIT','APP_OPEL_ASTRAH_L48_A17DTR_TB_KIT',
      'APP_OPEL_ASTRAJ_P10_A17DTR_TB_KIT','APP_OPEL_ASTRAJ_ST_P10_A17DTR_TB_KIT',
      'APP_OPEL_ZAFIRAB_Z17DTR_TB_KIT','APP_OPEL_ZAFIRAB_A17DTR_TB_KIT',
      'APP_OPEL_CORSAD_Z17DTR_TB_KIT'
    )) applicability,
    (SELECT count(*)::text FROM repair_bom_edges WHERE code IN (
      'EDGE_ASTRAH_L48_Z17DTR_TB_KIT_001','EDGE_ASTRAH_L48_A17DTR_TB_KIT_001',
      'EDGE_ASTRAJ_P10_A17DTR_TB_KIT_001','EDGE_ASTRAJ_ST_P10_A17DTR_TB_KIT_001',
      'EDGE_ZAFIRAB_Z17DTR_TB_KIT_001','EDGE_ZAFIRAB_A17DTR_TB_KIT_001',
      'EDGE_CORSAD_Z17DTR_TB_KIT_001'
    )) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id WHERE e.code IN (
      'EDGE_ASTRAH_L48_Z17DTR_TB_KIT_001','EDGE_ASTRAH_L48_A17DTR_TB_KIT_001',
      'EDGE_ASTRAJ_P10_A17DTR_TB_KIT_001','EDGE_ASTRAJ_ST_P10_A17DTR_TB_KIT_001',
      'EDGE_ZAFIRAB_Z17DTR_TB_KIT_001','EDGE_ZAFIRAB_A17DTR_TB_KIT_001',
      'EDGE_CORSAD_Z17DTR_TB_KIT_001'
    )) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
