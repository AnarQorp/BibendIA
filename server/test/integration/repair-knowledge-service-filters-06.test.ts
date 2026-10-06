import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Service Filters 06 — Dacia K9K872',()=>{
  it('resolves Lodgy 95/115 air and cabin filters',async()=>{
    for(const [variant,repairJobCode,ref] of [
      ['1.5 Blue dCi 95 K9K872 — air filter','JOB_MAINT_AIR_FILTER','C 27 030'],
      ['1.5 Blue dCi 95 K9K872 — particle cabin filter','JOB_MAINT_CABIN_FILTER','CU 25 012'],
      ['1.5 Blue dCi 115 K9K872 — air filter','JOB_MAINT_AIR_FILTER','C 27 030'],
      ['1.5 Blue dCi 115 K9K872 — particle cabin filter','JOB_MAINT_CABIN_FILTER','CU 25 012'],
    ] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Dacia',model:'Lodgy',engineCode:'K9K 872',variant,repairJobCode,
      });
      expect(result?.components).toHaveLength(1);
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0].automationEligible).toBe(true);
    }
  });

  it('requires Lodgy fuel-housing disambiguation',async()=>{
    const result=await resolveRepairKnowledgeProgressively(apiPool,{
      make:'Dacia',model:'Lodgy',engineCode:'K9K 872',
      repairJobCode:'JOB_MAINT_FUEL_FILTER',
    });
    expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
    if(result?.status!=='DISAMBIGUATION_REQUIRED')throw new Error('expected Lodgy fuel housing disambiguation');
    expect(result.options.map((x)=>x.variant)).toEqual(expect.arrayContaining([
      '1.5 Blue dCi 95 K9K872 — MAHLE fuel housing',
      '1.5 Blue dCi 95 K9K872 — Sogefi fuel housing',
      '1.5 Blue dCi 115 K9K872 — MAHLE fuel housing',
      '1.5 Blue dCi 115 K9K872 — Sogefi fuel housing',
    ]));
  });

  it('resolves Dokker, Sandero II and Logan MCV II exact service filters',async()=>{
    const cases=[
      ['Dokker','1.5 Blue dCi 95 K9K872 — air filter','JOB_MAINT_AIR_FILTER','C 27 030'],
      ['Dokker','1.5 Blue dCi 95 K9K872 — particle cabin filter','JOB_MAINT_CABIN_FILTER','CU 25 012'],
      ['Sandero II','1.5 dCi 95 K9K872 — air filter','JOB_MAINT_AIR_FILTER','C 27 030'],
      ['Sandero II','1.5 dCi 95 K9K872 — particle cabin filter','JOB_MAINT_CABIN_FILTER','CU 22 011'],
      ['Logan MCV II','1.5 Blue dCi 95 K9K872 — air filter','JOB_MAINT_AIR_FILTER','C 27 030'],
      ['Logan MCV II','1.5 Blue dCi 95 K9K872 — particle cabin filter','JOB_MAINT_CABIN_FILTER','CU 22 011'],
    ] as const;
    for(const [model,variant,repairJobCode,ref] of cases){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Dacia',model,engineCode:'K9K 872',variant,repairJobCode,
      });
      expect(result?.components[0].notes).toContain(ref);
    }
  });

  it('keeps MAHLE/Sogefi fuel housings explicit for Dokker/Sandero/Logan',async()=>{
    for(const [model,base] of [
      ['Dokker','1.5 Blue dCi 95 K9K872'],
      ['Sandero II','1.5 dCi 95 K9K872'],
      ['Logan MCV II','1.5 Blue dCi 95 K9K872'],
    ] as const){
      const result=await resolveRepairKnowledgeProgressively(apiPool,{
        make:'Dacia',model,engineCode:'K9K 872',repairJobCode:'JOB_MAINT_FUEL_FILTER',
      });
      expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
      if(result?.status!=='DISAMBIGUATION_REQUIRED')throw new Error('expected Dacia fuel housing disambiguation');
      expect(result.options.map((x)=>x.variant)).toEqual(expect.arrayContaining([
        `${base} — MAHLE fuel housing`,
        `${base} — Sogefi fuel housing`,
      ]));
    }
  });

  it('does not add Duster II filters until engine-subcode evidence is reconciled',async()=>{
    await expect(resolveRepairKnowledge(apiPool,{
      make:'Dacia',model:'Duster II',engineCode:'K9K 872',
      repairJobCode:'JOB_MAINT_AIR_FILTER',
    })).resolves.toBeNull();
  });

  it('adds 20 exact applications idempotently',async()=>{
    const before=await counts();
    await asMigrator('SELECT apply_repair_knowledge_service_filters_06()');
    await asMigrator('SELECT apply_repair_knowledge_service_filters_06()');
    expect(await counts()).toEqual(before);
    expect(Number(before.applicability)).toBe(20);
    expect(Number(before.edges)).toBe(20);
    expect(Number(before.evidence)).toBe(20);
  });
});

async function counts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_FILTER6_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_FILTER6_%') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_FILTER6_%') evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
