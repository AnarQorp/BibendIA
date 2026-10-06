import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

const job = 'JOB_TIMING_BELT_WATER_PUMP';

describe('RK Coverage Expansion 06 — VAG 1.9 TDI BKC/BLS/BXE', () => {
  it('resolves Golf V BXE to the verified KP55569XS-2 / VKMC 01250-2 family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf V', engineCode: 'BXE', repairJobCode: job,
    });
    expect(result?.applicability).toMatchObject({
      generation: '1K1', variant: '1.9 TDI 105', engineCode: 'BXE',
    });
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'timing_belt_kit_water_pump' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('KP55569XS-2');
    expect(result?.components[0].notes).toContain('VKMC 01250-2');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('collapses BKC/BLS/BXE when their technical result is equivalent', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Volkswagen', model: 'Golf V', repairJobCode: job,
    });
    expect(result).toMatchObject({ status: 'RESOLVED', validForMultipleVariants: true });
    if (result?.status !== 'RESOLVED') throw new Error('expected equivalent 1.9 TDI variants to resolve');
    expect(result.matchedApplicabilities).toHaveLength(3);
    expect(result.matchedApplicabilities.map((a) => a.engineCode).sort()).toEqual(['BKC','BLS','BXE']);
    expect(result.components[0].notes).toContain('KP55569XS-2');
  });

  it('resolves all five vehicle families for an exact BLS engine code', async () => {
    const cases = [
      ['Volkswagen','Golf V'],
      ['Audi','A3 8P'],
      ['Seat','León II'],
      ['Skoda','Octavia II Combi'],
      ['Volkswagen','Touran I'],
    ] as const;

    for (const [make, model] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make, model, engineCode: 'BLS', repairJobCode: job,
      });
      expect(result?.components[0]).toMatchObject({
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
      expect(result?.components[0].notes).toContain('120 teeth / 30 mm');
      expect(result?.components[0].evidence).toHaveLength(2);
    }
  });

  it('does not infer unseeded BJB coverage from family similarity', async () => {
    await expect(resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf V', engineCode: 'BJB', repairJobCode: job,
    })).resolves.toBeNull();
  });

  it('keeps VAG 1.9 TDI coverage migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_coverage_06()');
    await asMigrator('SELECT apply_repair_knowledge_coverage_06()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(15);
    expect(Number(before.edges)).toBe(15);
    expect(Number(before.evidence)).toBe(30);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities
      WHERE code LIKE 'APP_%_19TDI_%_TB_KIT') applicability,
    (SELECT count(*)::text FROM repair_bom_edges
      WHERE code LIKE 'EDGE_%_19TDI_%_TB_KIT_001') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      WHERE e.code LIKE 'EDGE_%_19TDI_%_TB_KIT_001') evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
