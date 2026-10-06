import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_MAINT_SERVICE';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Maintenance Coverage 03 — K9K', () => {
  it('resolves Mégane IV K9K 872 with W 7032 and 5.7 L RN17 family', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Renault', model: 'Mégane IV', engineCode: 'K9K 872', repairJobCode: job,
    });
    expect(result?.components).toHaveLength(1);
    expect(result?.consumables).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'oil_filter' },
      confidenceState: 'VERIFIED_MANUFACTURER',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('W 7032');
    expect(result?.consumables[0]).toMatchObject({
      quantity: 5.7,
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.consumables[0].notes).toContain('RN17');
    expect(result?.consumables[0].condition).toContain('RN17 FE');
  });

  it('requires Qashqai K9K 872 filter-housing disambiguation', async () => {
    const ambiguous = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Nissan', model: 'Qashqai II', engineCode: 'K9K 872', repairJobCode: job,
    });
    expect(ambiguous).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (ambiguous?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected filter housing disambiguation');
    expect(ambiguous.options.map((x) => x.variant)).toEqual(expect.arrayContaining([
      '1.5 dCi 116 — spin-on filter',
      '1.5 dCi 116 — element filter',
    ]));

    const exact = await resolveRepairKnowledge(apiPool, {
      make: 'Nissan', model: 'Qashqai II', engineCode: 'K9K 872',
      variant: '1.5 dCi 116 — element filter', repairJobCode: job,
    });
    expect(exact?.components[0].notes).toContain('HU 618 y');
    expect(exact?.consumables[0].quantity).toBe(5.7);
  });

  it('requires Mégane III K9K 636 start-stop filter disambiguation', async () => {
    const ambiguous = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Renault', model: 'Mégane III', engineCode: 'K9K 636', repairJobCode: job,
    });
    expect(ambiguous).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });

    const startStop = await resolveRepairKnowledge(apiPool, {
      make: 'Renault', model: 'Mégane III', engineCode: 'K9K 636',
      variant: '1.5 dCi 110 — start-stop', repairJobCode: job,
    });
    const noStartStop = await resolveRepairKnowledge(apiPool, {
      make: 'Renault', model: 'Mégane III', engineCode: 'K9K 636',
      variant: '1.5 dCi 110 — without start-stop', repairJobCode: job,
    });
    expect(startStop?.components[0].notes).toContain('W 7032');
    expect(noStartStop?.components[0].notes).toContain('W 79');
    expect(startStop?.consumables[0]).toMatchObject({ quantity: 4.5, automationEligible: true });
    expect(startStop?.consumables[0].notes).toContain('RN0720');
  });

  it('resolves Sandero II K9K 872 with HU 618 y', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Dacia', model: 'Sandero II', engineCode: 'K9K 872', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      confidenceState: 'VERIFIED_MANUFACTURER',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('HU 618 y');
    expect(result?.consumables[0].quantity).toBe(5.7);
  });

  it('keeps K9K maintenance migration idempotent', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_maintenance_03()');
    await asMigrator('SELECT apply_repair_knowledge_maintenance_03()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(27);
    expect(Number(before.edges)).toBe(54);
    expect(Number(before.evidence)).toBe(54);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities
      WHERE code LIKE 'APP_MAINT_%'
        AND engine_code IN ('K9K 872','K9K 636','K9K 646')) applicability,
    (SELECT count(*)::text FROM repair_bom_edges e
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_MAINT_%'
        AND a.engine_code IN ('K9K 872','K9K 636','K9K 646')
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_MAINT_SERVICE')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_MAINT_%'
        AND a.engine_code IN ('K9K 872','K9K 636','K9K 646')
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_MAINT_SERVICE')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
