import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_BRAKE_DISCS_PADS_FRONT';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Brakes Coverage 02 — VAG expansion', () => {
  it('requires CRMB Golf brake PR-code disambiguation', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make:'Volkswagen', model:'Golf VII', engineCode:'CRMB', repairJobCode:job,
    });
    expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED', reason:'VARIANT_REQUIRED'});
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected CRMB Golf brake disambiguation');
    expect(result.options.map((x) => x.variant)).toEqual(expect.arrayContaining([
      '2.0 TDI CRMB — PR 1ZE/1ZP — 288 mm',
      '2.0 TDI CRMB — PR 1ZA/1ZB/1ZD — 312 mm',
    ]));
  });

  it('resolves CRMB MQB 288/312 packages from exact Brembo fitment', async () => {
    const cases = [
      ['Volkswagen','Golf VII','2.0 TDI CRMB — PR 1ZE/1ZP — 288 mm','09.9145.11','P 85 126'],
      ['Volkswagen','Golf VII','2.0 TDI CRMB — PR 1ZA/1ZB/1ZD — 312 mm','09.9772.11','P 85 126'],
      ['Seat','León 5F','2.0 TDI CRMB — PR 1ZE — 288 mm','09.9145.11','P 85 126'],
      ['Skoda','Octavia III','2.0 TDI CRMB — PR 1ZA/1ZB — 312 mm','09.9772.11','P 85 126'],
    ] as const;
    for (const [make,model,variant,discRef,padRef] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make,model,engineCode:'CRMB',variant,repairJobCode:job,
      });
      expect(result?.components).toHaveLength(2);
      expect(result?.components.every((x) => x.automationEligible)).toBe(true);
      expect(result?.components.find((x) => x.partRole.code === 'brake_disc_front')?.notes).toContain(discRef);
      expect(result?.components.find((x) => x.partRole.code === 'brake_pad_front')?.notes).toContain(padRef);
    }
  });

  it('resolves CAYC 280/288 variants without collapsing PR codes', async () => {
    const a3_280 = await resolveRepairKnowledge(apiPool, {
      make:'Audi',model:'A3 Sportback 8P',engineCode:'CAYC',
      variant:'1.6 TDI CAYC — PR 1ZF/1ZM — 280 mm',repairJobCode:job,
    });
    expect(a3_280?.components.find((x) => x.partRole.code === 'brake_disc_front')?.notes).toContain('09.9167.11');
    expect(a3_280?.components.find((x) => x.partRole.code === 'brake_pad_front')?.notes).toContain('P 85 072');

    const a3_288 = await resolveRepairKnowledge(apiPool, {
      make:'Audi',model:'A3 Sportback 8P',engineCode:'CAYC',
      variant:'1.6 TDI CAYC — PR 1ZE — 288 mm',repairJobCode:job,
    });
    expect(a3_288?.components.find((x) => x.partRole.code === 'brake_disc_front')?.notes).toContain('09.9145.11');
    expect(a3_288?.components.find((x) => x.partRole.code === 'brake_pad_front')?.notes).toContain('P 85 075');
  });

  it('keeps Roomster and Touran brake configurations explicit', async () => {
    const roomster = await resolveRepairKnowledgeProgressively(apiPool, {
      make:'Skoda',model:'Roomster',engineCode:'CAYC',repairJobCode:job,
    });
    expect(roomster).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
    if (roomster?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected Roomster brake disambiguation');
    expect(roomster.options.map((x) => x.variant)).toEqual(expect.arrayContaining([
      '1.6 TDI CAYC — PR 1LQ/1LR/1ZG — 256 mm',
      '1.6 TDI CAYC — PR 1ZC — 288 mm',
    ]));

    const touran = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen',model:'Touran',engineCode:'CAYC',
      variant:'1.6 TDI CAYC — PR 1ZP — 288 mm',repairJobCode:job,
    });
    expect(touran?.components.find((x) => x.partRole.code === 'brake_disc_front')?.notes).toContain('09.9145.11');
    expect(touran?.components.find((x) => x.partRole.code === 'brake_pad_front')?.notes).toContain('P 85 146');
  });

  it('retains BKC/BLS/BXE as separate applicability rows', async () => {
    for (const engineCode of ['BKC','BLS','BXE'] as const) {
      const result = await resolveRepairKnowledge(apiPool, {
        make:'Volkswagen',model:'Golf V',engineCode,
        variant:`1.9 TDI ${engineCode} — PR 1ZF/1ZM — 280 mm`,repairJobCode:job,
      });
      expect(result?.components).toHaveLength(2);
      expect(result?.components.find((x) => x.partRole.code === 'brake_disc_front')?.notes).toContain('09.9167.11');
      expect(result?.components.find((x) => x.partRole.code === 'brake_pad_front')?.notes).toContain('P 85 072');
    }
  });

  it('adds 38 brake variants / 76 edges idempotently without changing RK039 namespace', async () => {
    const historical = await asMigrator(
      "SELECT count(*)::int count FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_BRK\\_%' ESCAPE '\\'",
    );
    expect(historical.rows[0].count).toBe(16);

    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_brakes_02()');
    await asMigrator('SELECT apply_repair_knowledge_brakes_02()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(38);
    expect(Number(before.edges)).toBe(76);
    expect(Number(before.evidence)).toBe(76);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_BRAKE2_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRAKE2_%'
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRAKE2_%'
        AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql:string) {
  const client=await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
