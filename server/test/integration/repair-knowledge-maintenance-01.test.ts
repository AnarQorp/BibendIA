import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_MAINT_SERVICE';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Maintenance Coverage 01 — VAG + Opel oil/filter', () => {
  it('corrects Golf VII CLHA maintenance to HU 7020 z + 4.6 L VW 507 00', async () => {
    const legacy = await asMigrator(
      "SELECT count(*)::int count FROM repair_vehicle_applicabilities WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_MAINT_SERVICE'",
    );
    expect(legacy.rows[0].count).toBe(0);

    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: job,
    });
    expect(result?.components).toHaveLength(1);
    expect(result?.consumables).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'oil_filter' },
      confidenceState: 'VERIFIED_MANUFACTURER',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('HU 7020 z');
    expect(result?.components[0].notes).not.toContain('HU 7008 z');
    expect(result?.consumables[0]).toMatchObject({
      partRole: { code: 'engine_oil' },
      quantity: 4.6,
      confidenceState: 'VERIFIED_OEM',
      automationEligible: true,
    });
    expect(result?.consumables[0].notes).toContain('VW 507 00');
  });

  it('resolves CAYC maintenance with HU 7008 z and 4.3 L', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VI', engineCode: 'CAYC', repairJobCode: job,
    });
    expect(result?.components[0].notes).toContain('HU 7008 z');
    expect(result?.consumables[0]).toMatchObject({ quantity: 4.3, automationEligible: true });
    expect(result?.consumables[0].notes).toContain('VW 507 00');
  });

  it('keeps BKC/BXE 3.8 L distinct from BLS 4.3 L', async () => {
    const bkc = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf V', engineCode: 'BKC', repairJobCode: job,
    });
    const bxe = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf V', engineCode: 'BXE', repairJobCode: job,
    });
    const bls = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf V', engineCode: 'BLS', repairJobCode: job,
    });
    expect(bkc?.components[0].notes).toContain('HU 719/7 x');
    expect(bkc?.consumables[0].quantity).toBe(3.8);
    expect(bxe?.consumables[0].quantity).toBe(3.8);
    expect(bls?.consumables[0].quantity).toBe(4.3);
  });

  it('resolves Opel A17DTR/Z17DTR with HU 820/1 y and 5.4 L dexos2', async () => {
    for (const [model, engineCode] of [['Astra J','A17DTR'],['Zafira B','Z17DTR']] as const) {
      const result = await resolveRepairKnowledge(apiPool, {
        make: 'Opel', model, engineCode, repairJobCode: job,
      });
      expect(result?.components[0].notes).toContain('HU 820/1 y');
      expect(result?.consumables[0]).toMatchObject({ quantity: 5.4, automationEligible: true });
      expect(result?.consumables[0].notes).toContain('dexos2');
    }
  });

  it('creates all 37 VAG/Opel maintenance applications idempotently', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_maintenance_01()');
    await asMigrator('SELECT apply_repair_knowledge_maintenance_01()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(37);
    expect(Number(before.edges)).toBe(74);
    expect(Number(before.evidence)).toBe(74);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities
      WHERE code LIKE 'APP_MAINT_%'
        AND engine_code IN ('CLHA','CRMB','CAYC','BKC','BLS','BXE','A17DTR','Z17DTR')) applicability,
    (SELECT count(*)::text FROM repair_bom_edges e
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_MAINT_%'
        AND a.engine_code IN ('CLHA','CRMB','CAYC','BKC','BLS','BXE','A17DTR','Z17DTR')
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_MAINT_SERVICE')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_MAINT_%'
        AND a.engine_code IN ('CLHA','CRMB','CAYC','BKC','BLS','BXE','A17DTR','Z17DTR')
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_MAINT_SERVICE')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
