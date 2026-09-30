import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listRepairKnowledgeVehicleFacets, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

beforeAll(async () => {
  await asMigrator(`
    INSERT INTO repair_vehicle_applicabilities(code,make,model,generation,variant,engine_code)
    VALUES ('TEST_DISCOVERY_DIFF_A','Test','Ambiguous','G1','1.0','ENG-A'),('TEST_DISCOVERY_DIFF_B','Test','Ambiguous','G1','2.0','ENG-B'),
           ('TEST_DISCOVERY_SAME_A','Test','Equivalent','G1','1.0','ENG-A'),('TEST_DISCOVERY_SAME_B','Test','Equivalent','G1','2.0','ENG-B');
    INSERT INTO repair_bom_edges(code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,bom_classification,confidence_state,replace_once,notes)
    SELECT 'TEST_DISCOVERY_EDGE_DIFF_A',a.id,j.id,r.id,'PART_ROLE',1,'REQUIRED','EXPLICIT_BOM','UNKNOWN',false,'test'
      FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r WHERE a.code='TEST_DISCOVERY_DIFF_A' AND j.code='JOB_MAINT_SERVICE' AND r.code='oil_filter';
    INSERT INTO repair_bom_edges(code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,bom_classification,confidence_state,replace_once,notes)
    SELECT 'TEST_DISCOVERY_EDGE_DIFF_B',a.id,j.id,r.id,'PART_ROLE',2,'REQUIRED','EXPLICIT_BOM','UNKNOWN',false,'test'
      FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r WHERE a.code='TEST_DISCOVERY_DIFF_B' AND j.code='JOB_MAINT_SERVICE' AND r.code='oil_filter';
    INSERT INTO repair_bom_edges(code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,bom_classification,confidence_state,replace_once,notes)
    SELECT 'TEST_DISCOVERY_EDGE_SAME_' || right(a.code,1),a.id,j.id,r.id,'PART_ROLE',1,'REQUIRED','EXPLICIT_BOM','UNKNOWN',false,'same'
      FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
      WHERE a.code IN ('TEST_DISCOVERY_SAME_A','TEST_DISCOVERY_SAME_B') AND j.code='JOB_MAINT_SERVICE' AND r.code='oil_filter';
  `);
});

afterAll(async () => {
  await asMigrator("DELETE FROM repair_bom_edges WHERE code LIKE 'TEST_DISCOVERY_%'");
  await asMigrator("DELETE FROM repair_vehicle_applicabilities WHERE code LIKE 'TEST_DISCOVERY_%'");
  await apiPool.end(); await pool.end();
});

describe('RK vehicle discovery', () => {
  it('derives the complete production catalog as facets without a parallel vehicle catalog', async () => {
    const facets = await listRepairKnowledgeVehicleFacets(apiPool, {});
    expect(facets.makes).toEqual(expect.arrayContaining(['Volkswagen','Seat','Renault']));
    expect(facets.models).toEqual(expect.arrayContaining(['Golf VII','León 5F','Mégane IV']));
    expect(facets.engines.map((item) => item.engineCode)).toEqual(expect.arrayContaining(['CLHA','CRMB','K9K 872']));
    expect(facets.repairJobs.map((item) => item.code)).toEqual(expect.arrayContaining([
      'JOB_TIMING_BELT_WATER_PUMP','JOB_BRAKE_DISCS_PADS_FRONT','JOB_CLUTCH_DMF_KIT','JOB_MAINT_SERVICE',
    ]));
    const golf = await listRepairKnowledgeVehicleFacets(apiPool, { make: 'Volkswagen', model: 'Golf VII' });
    expect(golf.engines).toContainEqual({ engineCode: 'CLHA', variant: '1.6 TDI', generation: '5G1/BQ1', label: '1.6 TDI — CLHA' });
  });

  it('resolves without engine when one applicability matches', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool,
      { make: 'Volkswagen', model: 'Golf VII', repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });
    expect(result).toMatchObject({ status: 'RESOLVED', validForMultipleVariants: false, applicability: { engineCode: 'CLHA' } });
  });

  it('requires disambiguation when engine changes the technical result', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool,
      { make: 'Test', model: 'Ambiguous', repairJobCode: 'JOB_MAINT_SERVICE' });
    expect(result).toMatchObject({ status: 'DISAMBIGUATION_REQUIRED', reason: 'VARIANT_REQUIRED' });
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected disambiguation');
    expect(result.options.map((item) => item.engineCode)).toEqual(['ENG-A','ENG-B']);
  });

  it('resolves equivalent technical results across engines and records the scope', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool,
      { make: 'Test', model: 'Equivalent', repairJobCode: 'JOB_MAINT_SERVICE' });
    expect(result).toMatchObject({ status: 'RESOLVED', validForMultipleVariants: true });
    if (result?.status !== 'RESOLVED') throw new Error('expected resolution');
    expect(result.matchedApplicabilities).toHaveLength(2);
  });
});

async function asMigrator(sql: string) {
  const client = await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
