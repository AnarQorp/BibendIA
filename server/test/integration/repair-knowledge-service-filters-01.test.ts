import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const apiPool = createPool('api');

afterAll(async () => { await apiPool.end(); await pool.end(); });

describe('RK Service Filters 01 — air/fuel/cabin', () => {
  it('resolves Golf VII CLHA air and cabin filters from exact MANN fitment', async () => {
    const air = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen', model:'Golf VII', engineCode:'CLHA',
      repairJobCode:'JOB_MAINT_AIR_FILTER',
    });
    expect(air?.components[0]).toMatchObject({
      partRole:{code:'air_filter'}, quantity:1,
      confidenceState:'VERIFIED_MANUFACTURER', automationEligible:true,
    });
    expect(air?.components[0].notes).toContain('C 30 005');

    const cabin = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen', model:'Golf VII', engineCode:'CLHA',
      repairJobCode:'JOB_MAINT_CABIN_FILTER',
    });
    expect(cabin?.components[0].notes).toContain('CU 26 009');
  });

  it('requires Golf VII fuel-housing disambiguation', async () => {
    const result = await resolveRepairKnowledgeProgressively(apiPool, {
      make:'Volkswagen', model:'Golf VII', engineCode:'CLHA',
      repairJobCode:'JOB_MAINT_FUEL_FILTER',
    });
    expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
    if (result?.status !== 'DISAMBIGUATION_REQUIRED') throw new Error('expected fuel housing disambiguation');
    expect(result.options.map((x) => x.variant)).toEqual(expect.arrayContaining([
      '1.6 TDI CLHA — fuel housing without water sensor',
      '1.6 TDI CLHA — fuel housing with water sensor',
    ]));

    const withSensor = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen',model:'Golf VII',engineCode:'CLHA',
      variant:'1.6 TDI CLHA — fuel housing with water sensor',
      repairJobCode:'JOB_MAINT_FUEL_FILTER',
    });
    expect(withSensor?.components[0].notes).toContain('PU 8014');

    const withoutSensor = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen',model:'Golf VII',engineCode:'CLHA',
      variant:'1.6 TDI CLHA — fuel housing without water sensor',
      repairJobCode:'JOB_MAINT_FUEL_FILTER',
    });
    expect(withoutSensor?.components[0].notes).toContain('PU 8021');
  });

  it('resolves Golf VI CAYC air/cabin filters without inventing a fuel filter', async () => {
    const air = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen',model:'Golf VI',engineCode:'CAYC',
      repairJobCode:'JOB_MAINT_AIR_FILTER',
    });
    expect(air?.components[0].notes).toContain('C 35 154');

    const cabin = await resolveRepairKnowledge(apiPool, {
      make:'Volkswagen',model:'Golf VI',engineCode:'CAYC',
      repairJobCode:'JOB_MAINT_CABIN_FILTER',
    });
    expect(cabin?.components[0].notes).toContain('CU 2939');

    await expect(resolveRepairKnowledge(apiPool, {
      make:'Volkswagen',model:'Golf VI',engineCode:'CAYC',
      repairJobCode:'JOB_MAINT_FUEL_FILTER',
    })).resolves.toBeNull();
  });

  it('resolves Clio IV K9K646 air/cabin and MAHLE-housing fuel filters', async () => {
    const cases = [
      ['JOB_MAINT_AIR_FILTER','C 27 029'],
      ['JOB_MAINT_CABIN_FILTER','CU 22 011'],
      ['JOB_MAINT_FUEL_FILTER','PU 9011 z KIT'],
    ] as const;
    for (const [repairJobCode, ref] of cases) {
      const result = await resolveRepairKnowledge(apiPool, {
        make:'Renault',model:'Clio IV',engineCode:'K9K 646',repairJobCode,
      });
      expect(result?.components[0]).toMatchObject({
        confidenceState:'VERIFIED_MANUFACTURER',
        automationEligible:true,
      });
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0].evidence).toHaveLength(1);
    }
  });

  it('creates three new jobs, three roles and nine applicability rows idempotently', async () => {
    const before = await counts();
    await asMigrator('SELECT apply_repair_knowledge_service_filters_01()');
    await asMigrator('SELECT apply_repair_knowledge_service_filters_01()');
    expect(await counts()).toEqual(before);
    expect(Number(before.jobs)).toBe(3);
    expect(Number(before.roles)).toBe(3);
    expect(Number(before.applicability)).toBe(9);
    expect(Number(before.edges)).toBe(9);
    expect(Number(before.evidence)).toBe(9);
  });
});

async function counts() {
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_jobs WHERE code IN ('JOB_MAINT_AIR_FILTER','JOB_MAINT_FUEL_FILTER','JOB_MAINT_CABIN_FILTER')) jobs,
    (SELECT count(*)::text FROM repair_part_roles WHERE code IN ('air_filter','fuel_filter','cabin_filter')) roles,
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_SVCFLT_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_SVCFLT_%') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_SVCFLT_%') evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string) {
  const client=await pool.connect();
  try { await client.query('SET ROLE bibendia_migrator'); return await client.query(sql); }
  finally { await client.query('RESET ROLE'); client.release(); }
}
