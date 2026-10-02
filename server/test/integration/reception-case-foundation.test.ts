import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool,inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer,insertProtectedVehicle } from '../../src/security/protected-records.js';
import { createReceptionCase } from '../../src/modules/reception-cases/reception-cases.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool=createPool('migrator'),pii=testPiiProtection();
const ids={tenant:randomUUID(),otherTenant:randomUUID(),workshop:randomUUID(),otherWorkshop:randomUUID(),user:randomUUID(),
  customer:randomUUID(),vehicle:randomUUID()};
const principal:PrincipalContext={kind:'workshop_user',audience:'workshop',userId:ids.user,issuer:'test',subject:ids.user,
  sessionId:randomUUID(),authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString(),assurance:'single_factor'};
const authentication:AuthenticationAdapter={async authenticate(request){return request.authorization==='Bearer owner'?principal:null;}};

beforeAll(async()=>{
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Cases','pilot'),($2,'Other','pilot')",[ids.tenant,ids.otherTenant]);
  await pool.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Main'),($3,$4,'Other')",[ids.workshop,ids.tenant,ids.otherWorkshop,ids.otherTenant]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active')",[ids.user]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES($1,$2,'OWNER','active')",[ids.user,ids.tenant]);
  await inTenantTransaction(pool,ids.tenant,async(client)=>{
    await insertProtectedCustomer(client,pii,{id:ids.customer,tenantId:ids.tenant,displayName:'Ane Prueba',phone:'+34600111222'});
    await insertProtectedVehicle(client,pii,{id:ids.vehicle,tenantId:ids.tenant,plate:'1234ABC',make:'Seat',model:'Leon'});
  });
});
afterAll(async()=>{
  await pool.query('DELETE FROM audit_events WHERE tenant_id=ANY($1)',[[ids.tenant,ids.otherTenant]]);
  await pool.query('DELETE FROM reception_cases WHERE tenant_id=ANY($1)',[[ids.tenant,ids.otherTenant]]);
  await pool.query('DELETE FROM vehicles WHERE tenant_id=ANY($1)',[[ids.tenant,ids.otherTenant]]);
  await pool.query('DELETE FROM customers WHERE tenant_id=ANY($1)',[[ids.tenant,ids.otherTenant]]);
  await pool.query('DELETE FROM tenant_memberships WHERE user_id=$1',[ids.user]); await pool.query('DELETE FROM users WHERE id=$1',[ids.user]);
  await pool.query('DELETE FROM workshops WHERE tenant_id=ANY($1)',[[ids.tenant,ids.otherTenant]]);
  await pool.query('DELETE FROM tenants WHERE id=ANY($1)',[[ids.tenant,ids.otherTenant]]); await pool.end();
});

describe('Reception Case Foundation',()=>{
  it('manual creation and retrieval use the canonical collection with canonical customer and vehicle',async()=>{
    const app=buildApi(pool,{authentication,piiProtection:pii}); const key=`manual-${randomUUID()}`;
    const created=await app.inject({method:'POST',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases`,headers:{authorization:'Bearer owner'},
      payload:{workshopId:ids.workshop,channel:'PHONE',callerType:'CUSTOMER',category:'appointment_issue',summary:'Cambiar la cita',
        detail:'Llamar por la tarde',customerId:ids.customer,vehicleId:ids.vehicle,idempotencyKey:key}});
    expect(created.statusCode).toBe(201); expect(created.json().data).toMatchObject({channel:'MANUAL',customerId:ids.customer,vehicleId:ids.vehicle,status:'OPEN'});
    const listed=await app.inject({method:'GET',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases?status=OPEN&customerId=${ids.customer}&limit=10`,headers:{authorization:'Bearer owner'}});
    expect(listed.statusCode).toBe(200); expect(listed.json().data.map((x:{id:string})=>x.id)).toContain(created.json().data.id);
    const raw=await pool.query('SELECT summary_ciphertext,detail_ciphertext,provenance::text FROM reception_cases WHERE id=$1',[created.json().data.id]);
    expect(raw.rows[0].summary_ciphertext).not.toBeNull(); expect(raw.rows[0].detail_ciphertext).not.toBeNull();
    expect(JSON.stringify(raw.rows[0])).not.toContain('Cambiar la cita'); expect(JSON.stringify(raw.rows[0])).not.toContain('Llamar por la tarde'); await app.close();
  });

  it('supports unknown and supplier callers without forcing Customer',async()=>{
    const app=buildApi(pool,{authentication,piiProtection:pii});
    for(const callerType of ['OTHER','SUPPLIER']){const result=await app.inject({method:'POST',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases`,headers:{authorization:'Bearer owner'},
      payload:{workshopId:ids.workshop,channel:'MANUAL',callerType,category:callerType==='SUPPLIER'?'parts_delivery':'other',summary:'Trabajo pendiente',idempotencyKey:`case-${callerType}-${randomUUID()}`}});
      expect(result.statusCode).toBe(201);expect(result.json().data.customerId).toBeNull();}
    await app.close();
  });

  it('exact replay returns the same Case and changed replay is rejected',async()=>{
    const app=buildApi(pool,{authentication,piiProtection:pii}),idempotencyKey=`replay-${randomUUID()}`;
    const payload={workshopId:ids.workshop,channel:'MANUAL',callerType:'CUSTOMER',category:'callback_request',summary:'Solicita llamada',idempotencyKey};
    const first=await app.inject({method:'POST',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases`,headers:{authorization:'Bearer owner'},payload});
    const replay=await app.inject({method:'POST',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases`,headers:{authorization:'Bearer owner'},payload});
    const conflict=await app.inject({method:'POST',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases`,headers:{authorization:'Bearer owner'},payload:{...payload,summary:'Texto distinto'}});
    expect(replay.statusCode).toBe(200);expect(replay.json().data.id).toBe(first.json().data.id);expect(conflict.statusCode).toBe(409);expect(conflict.json().error).toBe('CASE_IDEMPOTENCY_CONFLICT');await app.close();
  });

  it('persists automation into the same table and lifecycle updates are audited',async()=>{
    const created=await inTenantTransaction(pool,ids.tenant,(client)=>createReceptionCase(client,pii,ids.tenant,{type:'voice_agent',id:'voice-test'},'voice:test',{
      workshopId:ids.workshop,channel:'PHONE',callerType:'CUSTOMER',category:'callback_request',summary:'Que me llame Arkaitz',priority:'HIGH',
      idempotencyKey:`voice-${randomUUID()}`,provenance:{source:'elevenlabs_tool'},providerConversationId:'conv-test'}));
    const app=buildApi(pool,{authentication,piiProtection:pii}); const updated=await app.inject({method:'PATCH',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases/${created.case.id}`,
      headers:{authorization:'Bearer owner'},payload:{status:'IN_PROGRESS',priority:'URGENT'}});
    expect(updated.statusCode).toBe(200);expect(updated.json().data).toMatchObject({status:'IN_PROGRESS',priority:'URGENT'});
    const audit=await pool.query("SELECT event_type FROM audit_events WHERE tenant_id=$1 AND entity_id=$2 ORDER BY id",[ids.tenant,created.case.id]);
    expect(audit.rows.map(x=>x.event_type)).toEqual(['reception_case.created','reception_case.updated']);await app.close();
  });

  it('rejects cross-tenant links and access',async()=>{
    const app=buildApi(pool,{authentication,piiProtection:pii}); const create=await app.inject({method:'POST',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases`,headers:{authorization:'Bearer owner'},
      payload:{workshopId:ids.otherWorkshop,channel:'MANUAL',callerType:'OTHER',category:'other',summary:'Invalid',idempotencyKey:`cross-${randomUUID()}`}});
    expect(create.statusCode).toBe(409);expect(create.json().error).toBe('CASE_LINK_INVALID');
    const read=await app.inject({method:'GET',url:`/v1/workshop/tenants/${ids.otherTenant}/reception-cases`,headers:{authorization:'Bearer owner'}});expect(read.statusCode).toBe(403);await app.close();
  });

  it('bounds listing and validates filters',async()=>{const app=buildApi(pool,{authentication,piiProtection:pii});
    const bounded=await app.inject({method:'GET',url:`/v1/workshop/tenants/${ids.tenant}/reception-cases?limit=101`,headers:{authorization:'Bearer owner'}});
    expect(bounded.statusCode).toBe(400);await app.close();});
});
