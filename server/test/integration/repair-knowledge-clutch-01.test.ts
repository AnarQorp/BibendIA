import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');
const job = 'JOB_CLUTCH_DMF_KIT';

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Clutch Coverage 01 — priority clutch + DMF', () => {
  it('removes the incorrect historical Golf CLHA clutch applicability', async () => {
    const legacy = await asMigrator(
      "SELECT count(*)::int count FROM repair_vehicle_applicabilities WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_CLUTCH_DMF_KIT'",
    );
    expect(legacy.rows[0].count).toBe(0);
  });

  it('resolves Golf VII CLHA MWW with the corrected Sachs clutch + DMF combination', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA',
      variant: '1.6 TDI CLHA — MWW manual 5-speed', repairJobCode: job,
    });
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]).toMatchObject({
      partRole: { code: 'clutch_dmf_kit_complete' },
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].notes).toContain('3000 970 069');
    expect(result?.components[0].notes).toContain('3021 600 288');
    expect(result?.components[0].notes).not.toContain('600 0016 00');
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves A3 CLHA NTG to Valeo FULLPACK DMF 837074', async () => {
    const result = await resolveRepairKnowledge(apiPool, {
      make: 'Audi', model: 'A3 Sportback 8V', engineCode: 'CLHA',
      variant: '1.6 TDI CLHA — NTG manual 6-speed', repairJobCode: job,
    });
    expect(result?.components[0].notes).toContain('837074');
    expect(result?.components[0]).toMatchObject({
      confidenceState: 'MULTI_SOURCE_VERIFIED',
      automationEligible: true,
    });
    expect(result?.components[0].evidence).toHaveLength(2);
  });

  it('resolves CAYC no-StartStop LuK 600 0199 00 applications', async () => {
    const cases = [
      ['Volkswagen','Golf VI','1.6 TDI CAYC — manual 5-speed — without Start&Stop'],
      ['Audi','A3 Sportback 8P','1.6 TDI CAYC — manual — without Start&Stop'],
      ['Seat','León II','1.6 TDI CAYC — manual 5-speed — without Start&Stop'],
      ['Skoda','Octavia II','1.6 TDI CAYC — manual 5-speed — without Start&Stop'],
    ] as const;
    for (const [make,model,variant] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make,model,engineCode:'CAYC',variant,repairJobCode:job,
      });
      expect(result?.components[0].notes).toContain('600 0199 00');
      expect(result?.components[0].evidence).toHaveLength(2);
      expect(result?.components[0].automationEligible).toBe(true);
    }
  });

  it('resolves Focus T1DA and K9K TL4 packages', async () => {
    const focus = await resolveRepairKnowledge(apiPool, {
      make:'Ford',model:'Focus III',engineCode:'T1DA',
      variant:'1.6 TDCi 115 T1DA — manual 6-speed',repairJobCode:job,
    });
    expect(focus?.components[0].notes).toContain('600 0277 00');

    const qashqai = await resolveRepairKnowledge(apiPool, {
      make:'Nissan',model:'Qashqai II',engineCode:'K9K 636',
      variant:'1.5 dCi 110 K9K 636 — TL4 manual — to 05/2018',repairJobCode:job,
    });
    expect(qashqai?.components[0].notes).toContain('600 0197 00');

    const clio = await resolveRepairKnowledge(apiPool, {
      make:'Renault',model:'Clio IV',engineCode:'K9K 646',
      variant:'1.5 dCi 110 K9K 646 — TL4 manual',repairJobCode:job,
    });
    expect(clio?.components[0].notes).toContain('600 0197 00');
  });

  it('keeps clutch coverage idempotent and evidence-complete', async () => {
    const before = await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_clutch_01()');
    await asMigrator('SELECT apply_repair_knowledge_clutch_01()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(12);
    expect(Number(before.edges)).toBe(12);
    expect(Number(before.evidence)).toBe(24);
  });
});

async function coverageCounts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_CLT_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_CLT_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_CLUTCH_DMF_KIT')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_CLT_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_CLUTCH_DMF_KIT')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
