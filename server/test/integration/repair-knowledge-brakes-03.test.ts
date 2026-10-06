import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');
const job='JOB_BRAKE_DISCS_PADS_FRONT';

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Brakes Coverage 03 — verified non-VAG',()=>{
  it('resolves exact PSA brake packages',async()=>{
    const cases=[
      ['Citroen','C4 Picasso I','9HR (DV6C)','1.6 HDi 112 — Teves — 283 mm','09.9619.11','P 61 083'],
      ['Citroen','C3 II','9HX (DV6ATED4)','1.6 HDi 90 — to 06/2010 — 266 mm','09.8695.11','P 61 066'],
      ['Citroen','Berlingo First','9HX (DV6ATED4)','1.6 HDi 90 — ESP — 283 mm','09.9619.11','P 23 119'],
    ] as const;
    for(const [make,model,engineCode,variant,discRef,padRef] of cases){
      const result=await resolveRepairKnowledge(apiPool,{make,model,engineCode,variant,repairJobCode:job});
      expect(result?.components).toHaveLength(2);
      expect(result?.components.every((x)=>x.automationEligible)).toBe(true);
      expect(result?.components.find((x)=>x.partRole.code==='brake_disc_front')?.notes).toContain(discRef);
      expect(result?.components.find((x)=>x.partRole.code==='brake_pad_front')?.notes).toContain(padRef);
    }
  });

  it('resolves Corsa D Z17DTR 278 mm package',async()=>{
    const result=await resolveRepairKnowledge(apiPool,{
      make:'Opel',model:'Corsa D',engineCode:'Z17DTR',
      variant:'1.7 CDTI 125 — 278 mm',repairJobCode:job,
    });
    expect(result?.components.find((x)=>x.partRole.code==='brake_disc_front')?.notes).toContain('09.A861.14');
    expect(result?.components.find((x)=>x.partRole.code==='brake_pad_front')?.notes).toContain('P 59 053');
  });

  it('requires Astra J Sports Tourer brake-size disambiguation',async()=>{
    const result=await resolveRepairKnowledgeProgressively(apiPool,{
      make:'Opel',model:'Astra J Sports Tourer',engineCode:'A17DTR',repairJobCode:job,
    });
    expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
    if(result?.status!=='DISAMBIGUATION_REQUIRED')throw new Error('expected Astra J ST disambiguation');
    expect(result.options.map((x)=>x.variant)).toEqual(expect.arrayContaining([
      '1.7 CDTI 125 — 15 inch brakes — 276 mm',
      '1.7 CDTI 125 — 16 inch brakes — 300 mm',
    ]));
  });

  it('keeps Zafira B Z17DTR/A17DTR and 280/308 mm choices explicit',async()=>{
    for(const engineCode of ['Z17DTR','A17DTR'] as const){
      const progressive=await resolveRepairKnowledgeProgressively(apiPool,{
        make:'Opel',model:'Zafira B',engineCode,repairJobCode:job,
      });
      expect(progressive).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
      if(progressive?.status!=='DISAMBIGUATION_REQUIRED')throw new Error('expected Zafira brake disambiguation');
      expect(progressive.options).toHaveLength(2);

      const exact=await resolveRepairKnowledge(apiPool,{
        make:'Opel',model:'Zafira B',engineCode,
        variant:`1.7 CDTI 125 ${engineCode} — 308 mm`,repairJobCode:job,
      });
      expect(exact?.components.find((x)=>x.partRole.code==='brake_disc_front')?.notes).toContain('09.9369.11');
      expect(exact?.components.find((x)=>x.partRole.code==='brake_pad_front')?.notes).toContain('P 59 045');
    }
  });

  it('adds 10 applicability rows and stays idempotent',async()=>{
    const before=await coverageCounts();
    await asMigrator('SELECT apply_repair_knowledge_brakes_03()');
    await asMigrator('SELECT apply_repair_knowledge_brakes_03()');
    expect(await coverageCounts()).toEqual(before);
    expect(Number(before.applicability)).toBe(10);
    expect(Number(before.edges)).toBe(20);
    expect(Number(before.evidence)).toBe(20);
  });
});

async function coverageCounts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_BRAKE3_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRAKE3_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRAKE3_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) evidence`);
  return result.rows[0];
}

async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
