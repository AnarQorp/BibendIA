import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

beforeAll(async () => { await asMigrator('SELECT seed_repair_knowledge_poc_v1()'); });
afterAll(async () => { await asMigrator('SELECT seed_repair_knowledge_poc_v1()'); await apiPool.end(); await pool.end(); });

describe('RK01 PostgreSQL repair knowledge foundation', () => {
  it('resolves the documented CLHA timing intervention with edge evidence and confidence decisions', async () => {
    const result = await resolveRepairKnowledge(apiPool, { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });
    expect(result?.applicability.engineCode).toBe('CLHA');
    expect([...result!.components, ...result!.consumables]).toHaveLength(6);
    const crankBolt = result!.components.find((edge) => edge.code === 'EDGE_GOLF7_CLHA_TB_005');
    expect(crankBolt).toMatchObject({ requirementType: 'REQUIRED', replaceOnce: true, confidenceState: 'VERIFIED_OEM', automationEligible: true });
    expect(crankBolt?.evidence[0]).toMatchObject({ source: 'Elring Technical Guide / VAG erWin RMI', confidenceState: 'VERIFIED_OEM' });
    const kitDerived = result!.components.find((edge) => edge.code === 'EDGE_GOLF7_CLHA_TB_003');
    expect(kitDerived).toMatchObject({ requirementType: 'REQUIRED', confidenceState: 'DERIVED_FROM_KIT', automationEligible: false });
  });

  it('does not apply CLHA knowledge to an incompatible engine code', async () => {
    await expect(resolveRepairKnowledge(apiPool, { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CRMB', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' })).resolves.toBeNull();
  });

  it('seeds exactly the documented JSON blocks and is idempotent', async () => {
    const before = await counts();
    await asMigrator('SELECT seed_repair_knowledge_poc_v1()');
    await asMigrator('SELECT seed_repair_knowledge_poc_v1()');
    expect(await counts()).toEqual(before);
    expect(before).toEqual({ jobs: '4', pocApplicability: '7', pocEdges: '21', pocEvidence: '21' });
  });

  it('blocks elevation when matching edge evidence is absent', async () => {
    await asMigrator("DELETE FROM repair_bom_evidence WHERE edge_id=(SELECT id FROM repair_bom_edges WHERE code='EDGE_GOLF7_CLHA_TB_005')");
    const result = await resolveRepairKnowledge(apiPool, { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });
    expect(result!.components.find((edge) => edge.code === 'EDGE_GOLF7_CLHA_TB_005')).toMatchObject({ automationEligible: false, confidenceReason: 'EVIDENCE_REQUIRED' });
    await asMigrator('SELECT seed_repair_knowledge_poc_v1()');
  });

  it('exposes only the explicit global catalog and no tenant-private vehicle rows to an unscoped API role', async () => {
    const client = await apiPool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE bibendia_api');
      expect(Number((await client.query('SELECT count(*) count FROM repair_bom_edges')).rows[0].count)).toBeGreaterThanOrEqual(21);
      expect((await client.query('SELECT id FROM vehicles')).rowCount).toBe(0);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });
});

async function counts() {
  const result = await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_jobs) jobs,
    (SELECT count(*)::text FROM repair_vehicle_applicabilities
      WHERE code IN (
        'APP_VAG_GOLF7_16TDI_CLHA_JOB_TIMING_BELT_WATER_PUMP',
        'APP_VAG_GOLF7_16TDI_CLHA_JOB_BRAKE_DISCS_PADS_FRONT',
        'APP_VAG_GOLF7_16TDI_CLHA_JOB_CLUTCH_DMF_KIT',
        'APP_VAG_GOLF7_16TDI_CLHA_JOB_MAINT_SERVICE',
        'APP_SEAT_LEON5F_20TDI_CRMB_JOB_TIMING_BELT_WATER_PUMP',
        'APP_SEAT_LEON5F_20TDI_CRMB_JOB_BRAKE_DISCS_PADS_FRONT',
        'APP_RENAULT_MEGANE4_15DCI_K9K872_JOB_TIMING_BELT_WATER_PUMP'
      )) poc_applicability,
    (SELECT count(*)::text FROM repair_bom_edges
      WHERE code LIKE 'EDGE_GOLF7_CLHA_%'
         OR code LIKE 'EDGE_LEON5F_CRMB_%'
         OR code LIKE 'EDGE_MEGANE4_K9K_%') poc_edges,
    (SELECT count(*)::text FROM repair_bom_evidence v
      JOIN repair_bom_edges e ON e.id=v.edge_id
      WHERE e.code LIKE 'EDGE_GOLF7_CLHA_%'
         OR e.code LIKE 'EDGE_LEON5F_CRMB_%'
         OR e.code LIKE 'EDGE_MEGANE4_K9K_%') poc_evidence`);
  return {
    jobs: result.rows[0].jobs,
    pocApplicability: result.rows[0].poc_applicability,
    pocEdges: result.rows[0].poc_edges,
    pocEvidence: result.rows[0].poc_evidence,
  };
}

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
