import { afterAll, describe, expect, it } from 'vitest';
import { resolveRepairKnowledge, resolveRepairKnowledgeProgressively } from '../../src/modules/repair-knowledge/repair-knowledge.js';
import { createPool } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const apiPool=createPool('api');
const job='JOB_BRAKE_DISCS_PADS_FRONT';

afterAll(async()=>{await apiPool.end();await pool.end();});

describe('RK Brakes Coverage 04 — PSA verified',()=>{
  it('resolves Peugeot 508 I 9HR 283 mm Teves package',async()=>{
    const result=await resolveRepairKnowledge(apiPool,{
      make:'Peugeot',model:'508 I',engineCode:'9HR (DV6C)',
      variant:'1.6 HDi 112 — Teves — 283 mm',repairJobCode:job,
    });
    expect(result?.components).toHaveLength(2);
    expect(result?.components.find((x)=>x.partRole.code==='brake_disc_front')?.notes).toContain('09.8303.11');
    expect(result?.components.find((x)=>x.partRole.code==='brake_pad_front')?.notes).toContain('P 61 112');
    expect(result?.components.every((x)=>x.automationEligible)).toBe(true);
  });

  it('resolves Peugeot 207 9HY Bosch 283 mm package',async()=>{
    const result=await resolveRepairKnowledge(apiPool,{
      make:'Peugeot',model:'207',engineCode:'9HY (DV6TED4)',
      variant:'1.6 HDi 109 — Bosch — 283 mm',repairJobCode:job,
    });
    expect(result?.components.find((x)=>x.partRole.code==='brake_disc_front')?.notes).toContain('09.9619.11');
    expect(result?.components.find((x)=>x.partRole.code==='brake_pad_front')?.notes).toContain('P 23 119');
  });

  it('requires Xsara Picasso brake-system/ESP disambiguation',async()=>{
    const result=await resolveRepairKnowledgeProgressively(apiPool,{
      make:'Citroen',model:'Xsara Picasso',engineCode:'9HX (DV6ATED4)',repairJobCode:job,
    });
    expect(result).toMatchObject({status:'DISAMBIGUATION_REQUIRED',reason:'VARIANT_REQUIRED'});
    if(result?.status!=='DISAMBIGUATION_REQUIRED')throw new Error('expected Xsara disambiguation');
    expect(result.options.map((x)=>x.variant)).toEqual(expect.arrayContaining([
      '1.6 HDi 90 — Lucas — 266 mm',
      '1.6 HDi 90 — Bosch without ESP — 266 mm',
      '1.6 HDi 90 — Bosch with ESP — 283 mm',
    ]));
  });

  it('resolves all three Xsara exact variants',async()=>{
    const cases=[
      ['1.6 HDi 90 — Lucas — 266 mm','09.4987.21','P 61 069'],
      ['1.6 HDi 90 — Bosch without ESP — 266 mm','09.8695.11','P 61 066'],
      ['1.6 HDi 90 — Bosch with ESP — 283 mm','09.9619.11','P 23 119'],
    ] as const;
    for(const [variant,discRef,padRef] of cases){
      const result=await resolveRepairKnowledge(apiPool,{
        make:'Citroen',model:'Xsara Picasso',engineCode:'9HX (DV6ATED4)',variant,repairJobCode:job,
      });
      expect(result?.components.find((x)=>x.partRole.code==='brake_disc_front')?.notes).toContain(discRef);
      expect(result?.components.find((x)=>x.partRole.code==='brake_pad_front')?.notes).toContain(padRef);
    }
  });

  it('adds 5 applicability rows / 10 edges idempotently',async()=>{
    const before=await counts();
    await asMigrator('SELECT apply_repair_knowledge_brakes_04()');
    await asMigrator('SELECT apply_repair_knowledge_brakes_04()');
    expect(await counts()).toEqual(before);
    expect(Number(before.applicability)).toBe(5);
    expect(Number(before.edges)).toBe(10);
    expect(Number(before.evidence)).toBe(10);
  });
});

async function counts(){
  const result=await asMigrator(`SELECT
    (SELECT count(*)::text FROM repair_vehicle_applicabilities WHERE code LIKE 'APP_BRAKE4_%') applicability,
    (SELECT count(*)::text FROM repair_bom_edges e JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRAKE4_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) edges,
    (SELECT count(*)::text FROM repair_bom_evidence v JOIN repair_bom_edges e ON e.id=v.edge_id
      JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
      WHERE a.code LIKE 'APP_BRAKE4_%' AND e.repair_job_id=(SELECT id FROM repair_jobs WHERE code='JOB_BRAKE_DISCS_PADS_FRONT')) evidence`);
  return result.rows[0];
}
async function asMigrator(sql:string){
  const client=await pool.connect();
  try{await client.query('SET ROLE bibendia_migrator');return await client.query(sql);}
  finally{await client.query('RESET ROLE');client.release();}
}
