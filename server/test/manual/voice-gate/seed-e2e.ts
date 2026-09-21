import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPool, inTenantTransaction } from '../../../src/persistence/pool.js';
import { piiProtectionFromEnvironment } from '../../../src/security/pii-protection.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../../src/security/protected-records.js';
const env=Object.fromEntries((await readFile('/home/anarqorp/BibendIA/.env','utf8')).split(/\r?\n/).filter(l=>/^[A-Za-z_][A-Za-z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const pii=piiProtectionFromEnvironment(env);
const pool=createPool();
try{
 const tenant=randomUUID(),workshop=randomUUID(),customer=randomUUID(),vehicle=randomUUID();
 await pool.query("INSERT INTO tenants(id,name,operating_mode,lifecycle_status) VALUES($1,'BibendIA E2E','pilot_supervised','pilot')",[tenant]);
 await inTenantTransaction(pool,tenant,async c=>{
  await c.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Taller E2E')",[workshop,tenant]);
  await c.query("INSERT INTO channel_endpoints(tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,'elevenlabs',$3,'web-gate')",[tenant,workshop,env.ELEVENLABS_AGENT_ID]);
  await insertProtectedCustomer(c,pii,{id:customer,tenantId:tenant,displayName:'Aitor Etxeberria'});
  await insertProtectedVehicle(c,pii,{id:vehicle,tenantId:tenant,plate:'1489 KMR',make:'SEAT',model:'León'});
  await c.query("INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)",[tenant,customer,vehicle]);
  await c.query("INSERT INTO slot_holds(tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at) VALUES($1,$2,'slot-2026-09-22-1000','2026-09-22T08:00:00Z','2026-09-22T09:00:00Z','[{\"resourceType\":\"mechanic\",\"quantity\":1}]','2026-09-22T07:59:00Z')",[tenant,workshop]);
 });
 process.stdout.write(JSON.stringify({tenant,workshop,customer,vehicle,slotToken:'slot-2026-09-22-1000'})+'\n');
}finally{await pool.end();}
