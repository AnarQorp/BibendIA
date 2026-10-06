import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_BRAKE_DISCS_PADS_FRONT';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Brakes Coverage 01 — priority front brakes', () => {
  it('replaces the generic Golf VII brake row with PR-code disambiguation', async () => {
    const legacy = await asMigrator(
      "SELECT count(*)::int count FROM repair_vehicle_applicabilities WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_BRAKE_DISCS_PADS_FRONT'",
    );
    expect(legacy.rows[0].count).toBe(0);

    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: job,
    });
    expect(result).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected PR-code disambiguation');
    expect(result.options.map((x) => x.variant)).toEqual(expect.arrayContaining([
      '1.6 TDI CLHA — PR 1ZF — 276 mm',
      '1.6 TDI CLHA — PR 1ZE/1ZP — 288 mm',
    ]));
  });

  it('resolves Golf VII PR 1ZE/1ZP to the 288 mm TRW package', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA',
      variant: '1.6 TDI CLHA — PR 1ZE/1ZP — 288 mm', repairJobCode: job,
    });
    expect(result?.components).toHaveLength(2);
    const disc = result!.components.find((x) => x.partRole.code === 'brake_disc_front');
    const pad = result!.components.find((x) => x.partRole.code === 'brake_pad_front');
    expect(disc).toMatchObject({ quantity: 2, confidenceState: 'VERIFIED_MANUFACTURER', automationEligible: true });
    expect(disc?.notes).toContain('09.9145.11');
    expect(pad?.notes).toContain('P 85 126');
    expect(pad?.notes).toContain('TRW');
  });

  it('resolves priority non-VAG brake packages', async () => {
    const cases = [
      ['Peugeot','308 I','9HR (DV6C)','1.6 HDi 112 — Bosch — 283 mm','09.9619.11','P 61 101'],
      ['Ford','Focus III','T1DA','1.6 TDCi 115 — standard brakes — 278 mm','09.A905.11','P 24 061'],
      ['Nissan','Qashqai II','K9K 636','1.5 dCi 110 — Akebono — 296 mm','09.C545.11','P 56 100'],
      ['Renault','Clio IV','K9K 646','1.5 dCi 110 — 15/16 inch brakes — 258 mm','09.9078.21','P 68 065'],
      ['Dacia','Duster II','K9K 872','1.5 dCi 115 — ESP — 280 mm','09.A727.11','P 68 050'],
    ] as const;

    for (const [make,model,engineCode,variant,discRef,padRef] of cases) {
      const result = await resolveRepairKnowledge(apiPool, { make,model,engineCode,variant,repairJobCode:job });
      expect(result?.components).toHaveLength(2);
      expect(result?.components.every((x) => x.automationEligible)).toBe(true);
      expect(result?.components.find((x) => x.partRole.code === 'brake_disc_front')?.notes).toContain(discRef);
      expect(result?.components.find((x) => x.partRole.code === 'brake_pad_front')?.notes).toContain(padRef);
    }
  });

  it('requires Astra J brake-size disambiguation', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make: 'Opel', model: 'Astra J', engineCode: 'A17DTR', repairJobCode: job,
    });
    expect(result).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected Astra brake-size disambiguation');
    expect(result.options.map((x) => x.variant)).toEqual(expect.arrayContaining([
      '1.7 CDTI 125 — 15 inch brakes — 276 mm',
      '1.7 CDTI 125 — 16 inch brakes — 300 mm',
    ]));
  });

  it('keeps brake coverage idempotent and evidence-complete', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_brakes_01()');
    await asMigrator('SELECT apply_repair_knowledge_brakes_01()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(16);
    expect(Number(before.edges)).toBe(32);
    expect(Number(before.evidence)).toBe(32);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_BRK_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRK_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRK_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
