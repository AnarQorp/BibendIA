import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Service Filters 02 — León II VAG families',()=>{
  it('resolves CAYC air, cabin and fuel filters',async()=>{
    const cases=[
      ['JOB_MAINT_AIR_FILTER','C 35 154'],
      ['JOB_MAINT_CABIN_FILTER','CU 2939'],
      ['JOB_MAINT_FUEL_FILTER','PU 825 x'],
    ] as const;
    for(const [repairJobCode,ref] of cases){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Seat',model:'León II',engineCode:'CAYC',repairJobCode,
      });
      expect(result?.components).toHaveLength(1);
      expect(result?.components[0]).toMatchObject({
        confidenceState:'VERIFIED_MANUFACTURER',automationEligible:true,
      });
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0].evidence).toHaveLength(1);
    }
  });

  it('retains BKC/BLS/BXE as exact engine-code filter applications',async()=>{
    for(const engineCode of ['BKC','BLS','BXE'] as const){
      for(const [repairJobCode,ref] of [
        ['JOB_MAINT_AIR_FILTER','C 35 154'],
        ['JOB_MAINT_CABIN_FILTER','CU 2939'],
      ] as const){
        const result=await resolveRepairKnowledge(apiPool,{
          make:'Seat',model:'León II',engineCode,repairJobCode,
        });
        expect(result?.components[0].notes).toContain(ref);
        expect(result?.components[0].automationEligible).toBe(true);
      }
    }
  });

  it('keeps 1.9 TDI fuel-filter chassis restriction explicit',async()=>{
    for(const engineCode of ['BKC','BLS','BXE'] as const){
      const result=await resolveRepairKnowledgeProgressively(apiPool,{
        make:'Seat',model:'León II',engineCode,repairJobCode:'JOB_MAINT_FUEL_FILTER',
      });
      expect(result).toMatchObject({status:'RESOLVED'});
      if(result?.status!=='RESOLVED')throw new Error('expected late-chassis fuel filter to resolve');
      expect(result.result.components[0].notes).toContain('PU 825 x');
      expect(result.result.components[0].notes).toContain('1P_6_014786');
    }
  });

  it('adds 12 exact filter applications idempotently',async()=>{
    const before=await counts();
    await asMigrator('SELECT apply_repair_knowledge_service_filters_02()');
    await asMigrator('SELECT apply_repair_knowledge_service_filters_02()');
    expect(await counts()).toEqual(before);
    expect(Number(before.applicability)).toBe(12);
    expect(Number(before.edges)).toBe(12);
    expect(Number(before.evidence)).toBe(12);
  });
});

async function counts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_FILTER2_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_FILTER2_%') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_FILTER2_%') evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
