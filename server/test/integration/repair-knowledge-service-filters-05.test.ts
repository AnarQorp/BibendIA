import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Service Filters 05 — K9K',()=>{
  it('resolves Mégane III K9K636 air/cabin/fuel',async()=>{
    for(const [repairJobCode,ref] of [
      ['JOB_MAINT_AIR_FILTER','C 25 115'],
      ['JOB_MAINT_CABIN_FILTER','FP 26 005'],
      ['JOB_MAINT_FUEL_FILTER','WK 9012 x'],
    ] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Renault',model:'Mégane III',engineCode:'K9K 636',repairJobCode,
      });
      expect(result?.components).toHaveLength(1);
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0].automationEligible).toBe(true);
    }
  });

  it('forces Qashqai air/fuel variant selection but resolves cabin directly',async()=>{
    const air=await resolveRepairKnowledgeProgressively(apiPool,{
      make:'Nissan',model:'Qashqai II',engineCode:'K9K 636',repairJobCode:'JOB_MAINT_AIR_FILTER',
    });
    expect(air).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});

    const fuel=await resolveRepairKnowledgeProgressively(apiPool,{
      make:'Nissan',model:'Qashqai II',engineCode:'K9K 872',repairJobCode:'JOB_MAINT_FUEL_FILTER',
    });
    expect(fuel).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});

    const cabin=await resolveRepairKnowledge(apiPool,{
      make:'Nissan',model:'Qashqai II',engineCode:'K9K 872',repairJobCode:'JOB_MAINT_CABIN_FILTER',
    });
    expect(cabin?.components[0].notes).toContain('CU 25 003');
  });

  it('keeps Kangoo MAHLE and Sogefi fuel housings separate',async()=>{
    for(const engineCode of ['K9K 636','K9K 872'] as const){
      const result=await resolveRepairKnowledgeProgressively(apiPool,{
        make:'Renault',model:'Kangoo II / Grand Kangoo',engineCode,repairJobCode:'JOB_MAINT_FUEL_FILTER',
      });
      expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
      if(result?.status!=='DISAMBIGUATION_REQUIRED')throw new Error('expected fuel-housing disambiguation');
      expect(result.options).toHaveLength(2);
    }
  });

  it('resolves exact Kangoo air/cabin filters',async()=>{
    for(const engineCode of ['K9K 636','K9K 872'] as const){
      const air=await resolveRepairKnowledge(apiPool,{
        make:'Renault',model:'Kangoo II / Grand Kangoo',engineCode,repairJobCode:'JOB_MAINT_AIR_FILTER',
      });
      expect(air?.components[0].notes).toContain('C 2510/1');
      const cabin=await resolveRepairKnowledge(apiPool,{
        make:'Renault',model:'Kangoo II / Grand Kangoo',engineCode,repairJobCode:'JOB_MAINT_CABIN_FILTER',
      });
      expect(cabin?.components[0].notes).toContain('CU 2418-2');
    }
  });

  it('adds 21 K9K filter applications idempotently',async()=>{
    const before=await counts();
    await asMigrator('SELECT apply_repair_knowledge_service_filters_05()');
    await asMigrator('SELECT apply_repair_knowledge_service_filters_05()');
    expect(await counts()).toEqual(before);
    expect(Number(before.applicability)).toBe(21);
    expect(Number(before.edges)).toBe(21);
    expect(Number(before.evidence)).toBe(21);
  });
});

async function counts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_FILTER5_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_FILTER5_%') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_FILTER5_%') evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
