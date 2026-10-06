import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_MAINT_SERVICE';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Maintenance Coverage 02 — PSA/Ford DV6', () => {
  it('resolves Peugeot 308 I DV6C with HU 716/2 x and 3.75 L', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Peugeot', model: '308 I', engineCode: '9HR (DV6C)', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'oil_filter' },
      confidenceState: 'VERIFIED_MANUFACTURER',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('HU 716/2 x');
    expect(result?.consumables[0]).toMatchObject({
      quantity: 3.75,
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.consumables[0].notes).toContain('PSA B71 2290');
    expect(result?.consumables[0].evidence).toHaveLength(2);
  });

  it('resolves legacy 9HY/9HZ DV6TED4 maintenance at 3.75 L', async () => {
    for (const [make, model, engineCode] of [
      ['Peugeot','207','9HY (DV6TED4)'],
      ['Citroen','C4 I','9HZ (DV6TED4)'],
    ] as const) {
      const result = await resolveRepairKnowledge(apiPool, { make, model, engineCode, repairJobCode: job });
      expect(result?.components[0].notes).toContain('HU 716/2 x');
      expect(result?.consumables[0]).toMatchObject({
        quantity: 3.75,
        confidenceState: 'MULTI_SOURCE_VERIFIED',
        automationEligible: true,
      });
    }
  });

  it('keeps 9HX oil specification manual-review-only while retaining verified capacity/filter', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Citroen', model: 'C3 II', engineCode: '9HX (DV6ATED4)', repairJobCode: job,
    });
    expect(result?.components[0]).toMatchObject({
      confidenceState: 'VERIFIED_MANUFACTURER',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('HU 716/2 x');
    expect(result?.consumables[0]).toMatchObject({
      quantity: 3.75,
      confidenceState: 'COMMUNITY_SUPPORTED',
      automationEligible: false,
      manualReviewRequired: true,
      confidenceReason: 'COMMUNITY_CRITICAL_REVIEW',
    });
    expect(result?.consumables[0].condition).toContain('FAP');
  });

  it('resolves Ford T1DA with official 3.8 L and WSS-M2C913-D', async () => {
    for (const model of ['Focus III','C-Max II']) {
      const result = await resolveRepairKnowledge(apiPool, {
        make: 'Ford', model, engineCode: 'T1DA', repairJobCode: job,
      });
      expect(result?.components[0].notes).toContain('HU 716/2 x');
      expect(result?.consumables[0]).toMatchObject({
        quantity: 3.8,
        confidenceState: 'VERIFIED_OEM',
        automationEligible: true,
      });
      expect(result?.consumables[0].notes).toContain('WSS-M2C913-D');
      expect(result?.consumables[0].evidence).toHaveLength(1);
    }
  });

  it('creates all 14 PSA/Ford maintenance applications idempotently', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_maintenance_02()');
    await asMigrator('SELECT apply_repair_knowledge_maintenance_02()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(14);
    expect(Number(before.edges)).toBe(28);
    expect(Number(before.evidence)).toBe(40);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities
      WHERE code LIKE 'APP_MAINT_%'
        AND engine_code IN ('9HR (DV6C)','T1DA','9HZ (DV6TED4)','9HY (DV6TED4)','9HX (DV6ATED4)')) applicability,
    (SELECT count(*)::text FROM repair_bom_edges e
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_MAINT_%'
        AND a.engine_code IN ('9HR (DV6C)','T1DA','9HZ (DV6TED4)','9HY (DV6TED4)','9HX (DV6ATED4)')
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_MAINT_SERVICE')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_MAINT_%'
        AND a.engine_code IN ('9HR (DV6C)','T1DA','9HZ (DV6TED4)','9HY (DV6TED4)','9HX (DV6ATED4)')
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_MAINT_SERVICE')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
