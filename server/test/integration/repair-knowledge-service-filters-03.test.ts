import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Service Filters 03 — broader VAG',()=>{
  it('resolves A3 8P CAYC air and fuel filters',async()=>{
    for(const [repairJobCode,ref] of [
      ['JOB_MAINT_AIR_FILTER','C 35 154'],
      ['JOB_MAINT_FUEL_FILTER','PU 825 x'],
    ] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Audi',model:'A3 Sportback 8P',engineCode:'CAYC',repairJobCode,
      });
      expect(result?.components).toHaveLength(1);
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0]).toMatchObject({
        confidenceState:'VERIFIED_MANUFACTURER',automationEligible:true,
      });
    }
  });

  it('resolves A3 8P BKC/BLS/BXE air/cabin and restricted UFI fuel filters',async()=>{
    for(const engineCode of ['BKC','BLS','BXE'] as const){
      const air=await resolveRepairKnowledge(apiPool,{
        make:'Audi',model:'A3 8P',engineCode,repairJobCode:'JOB_MAINT_AIR_FILTER',
      });
      expect(air?.components[0].notes).toContain('C 35 154');

      const cabin=await resolveRepairKnowledge(apiPool,{
        make:'Audi',model:'A3 8P',engineCode,repairJobCode:'JOB_MAINT_CABIN_FILTER',
      });
      expect(cabin?.components[0].notes).toContain('CU 2939');

      const fuel=await resolveRepairKnowledge(apiPool,{
        make:'Audi',model:'A3 8P',engineCode,
        variant:`1.9 TDI ${engineCode} — UFI fuel housing — chassis from 8P_6_176001`,
        repairJobCode:'JOB_MAINT_FUEL_FILTER',
      });
      expect(fuel?.components[0].notes).toContain('PU 825 x');
      expect(fuel?.components[0].notes).toContain('8P_6_176001');
    }
  });

  it('resolves Octavia II CAYC and Combi 1.9 TDI exact MANN applications',async()=>{
    for(const [repairJobCode,ref] of [
      ['JOB_MAINT_AIR_FILTER','C 35 154'],
      ['JOB_MAINT_FUEL_FILTER','PU 825 x'],
    ] as const){
      const cayc=await resolveRepairKnowledge(apiPool,{
        make:'Skoda',model:'Octavia II',engineCode:'CAYC',repairJobCode,
      });
      expect(cayc?.components[0].notes).toContain(ref);
    }

    for(const engineCode of ['BKC','BLS','BXE'] as const){
      const air=await resolveRepairKnowledge(apiPool,{
        make:'Skoda',model:'Octavia II Combi',engineCode,repairJobCode:'JOB_MAINT_AIR_FILTER',
      });
      expect(air?.components[0].notes).toContain('C 35 154');

      const fuel=await resolveRepairKnowledge(apiPool,{
        make:'Skoda',model:'Octavia II Combi',engineCode,
        variant:`1.9 TDI ${engineCode} — UFI fuel housing — from 09/2005`,
        repairJobCode:'JOB_MAINT_FUEL_FILTER',
      });
      expect(fuel?.components[0].notes).toContain('PU 825 x');
      expect(fuel?.components[0].notes).toContain('3C0 127 400 C');
    }
  });

  it('keeps Golf V coverage narrow where cabin/fuel fitment is not established here',async()=>{
    for(const engineCode of ['BKC','BLS','BXE'] as const){
      const air=await resolveRepairKnowledge(apiPool,{
        make:'Volkswagen',model:'Golf V',engineCode,repairJobCode:'JOB_MAINT_AIR_FILTER',
      });
      expect(air?.components[0].notes).toContain('C 35 154');
    }
  });

  it('resolves Altea CAYC air/cabin/fuel from exact MANN applications',async()=>{
    for(const [repairJobCode,ref] of [
      ['JOB_MAINT_AIR_FILTER','C 35 154'],
      ['JOB_MAINT_CABIN_FILTER','CU 2939'],
      ['JOB_MAINT_FUEL_FILTER','PU 825 x'],
    ] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Seat',model:'Altea',engineCode:'CAYC',repairJobCode,
      });
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0].automationEligible).toBe(true);
    }
  });

  it('adds 25 exact applications idempotently',async()=>{
    const before=await counts();
    await asMigrator('SELECT apply_repair_knowledge_service_filters_03()');
    await asMigrator('SELECT apply_repair_knowledge_service_filters_03()');
    expect(await counts()).toEqual(before);
    expect(Number(before.applicability)).toBe(25);
    expect(Number(before.edges)).toBe(25);
    expect(Number(before.evidence)).toBe(25);
  });
});

async function counts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_FILTER3_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_FILTER3_%') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_FILTER3_%') evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
