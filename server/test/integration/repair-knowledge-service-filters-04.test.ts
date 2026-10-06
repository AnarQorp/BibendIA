import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Service Filters 04 — Touran',()=>{
  it('resolves Touran 1T3 CAYC air and fuel filters',async()=>{
    for(const [repairJobCode,ref] of [
      ['JOB_MAINT_AIR_FILTER','C 35 154'],
      ['JOB_MAINT_FUEL_FILTER','PU 825 x'],
    ] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Volkswagen',model:'Touran',engineCode:'CAYC',repairJobCode,
      });
      expect(result?.components).toHaveLength(1);
      expect(result?.components[0].notes).toContain(ref);
      expect(result?.components[0]).toMatchObject({confidenceState:'VERIFIED_MANUFACTURER',automationEligible:true});
    }
  });

  it('resolves BKC/BLS/BXE standard air filters',async()=>{
    for(const engineCode of ['BKC','BLS','BXE'] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Volkswagen',model:'Touran I',engineCode,repairJobCode:'JOB_MAINT_AIR_FILTER',
      });
      expect(result?.components[0].notes).toContain('C 35 154');
    }
  });

  it('preserves late UFI fuel-housing restriction for Touran 1.9 TDI',async()=>{
    for(const engineCode of ['BKC','BLS','BXE'] as const){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Volkswagen',model:'Touran I',engineCode,
        variant:`1.9 TDI ${engineCode} — UFI fuel housing — chassis from 1T_6_047275`,
        repairJobCode:'JOB_MAINT_FUEL_FILTER',
      });
      expect(result?.components[0].notes).toContain('PU 825 x');
      expect(result?.components[0].notes).toContain('1T_6_047275');
      expect(result?.components[0].notes).toContain('3C0 127 400 B/C');
    }
  });

  it('adds 8 exact applications idempotently',async()=>{
    const before=await counts();
    await asMigrator('SELECT apply_repair_knowledge_service_filters_04()');
    await asMigrator('SELECT apply_repair_knowledge_service_filters_04()');
    expect(await counts()).toEqual(before);
    expect(Number(before.applicability)).toBe(8);
    expect(Number(before.edges)).toBe(8);
    expect(Number(before.evidence)).toBe(8);
  });
});

async function counts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_FILTER4_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_FILTER4_%') edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id WHERE a.code LIKE 'APP_FILTER4_%') evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
