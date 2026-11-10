import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { createPool } from '../../src/persistence/pool.js';
import { AesGcmPiiProtection } from '../../src/security/pii-protection.js';
import { OidcAuthenticationAdapter, type VerifiedOidcIdentity } from '../../src/auth/oidc-authentication-adapter.js';
import { hashInvitationToken, invitationEvent, redeemInvitation, revealInvitation } from '../../src/modules/invitations/invitations.js';
import { claimOutboxBatch, dispatchClaimedOutboxEvent } from '../../src/worker/outbox.js';
import { WorkshopInvitationSmtpAdapter } from '../../src/adapters/smtp/workshop-invitation-smtp.js';
import { inTenantTransaction } from '../../src/persistence/pool.js';

const pool=createPool('migrator');
const pii=new AesGcmPiiProtection(new Map([['test',Buffer.alloc(32,9)]]),'test',new Map([['lookup',Buffer.alloc(32,8)]]),'lookup');
const subject=`oidc-new-user-${randomUUID()}`;
const admin=randomUUID(),operator=randomUUID(),scoped=randomUUID(),tenantB=randomUUID();
const principal=(id:string)=>({kind:'platform_user' as const,audience:'platform' as const,userId:id,issuer:'test',subject:id,sessionId:randomUUID(),authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600_000).toISOString(),assurance:'mfa' as const});
const app=buildApi(pool,{piiProtection:pii,invitationDelivery:{enabled:true,workshopOrigin:'https://app.bibendia.test'},authentication:{async authenticate(r){return r.authorization==='Bearer admin'?principal(admin):r.authorization==='Bearer operator'?principal(operator):r.authorization==='Bearer scoped'?principal(scoped):null;}}});
let tenant='',workshop='',invitation='',token='',user='';const extraTenants:string[]=[];
const send=(method:'GET'|'POST'|'PATCH',url:string,payload?:Record<string,unknown>,who='admin')=>app.inject({method,url,payload,headers:{authorization:`Bearer ${who}`}});
const identity=(overrides:Partial<VerifiedOidcIdentity>={}):VerifiedOidcIdentity=>({issuer:'https://issuer.test/',subject,email:'arkaitz-test@example.invalid',emailVerified:true,assurance:'single_factor',authenticatedAt:new Date().toISOString(),...overrides});
async function create(email='arkaitz-test@example.invalid',role='OWNER'){
 const r=await send('POST',`/v1/platform/tenants/${tenant}/invitations`,{email,role,idempotencyKey:randomUUID()});expect(r.statusCode,r.body).toBe(201);
 const id=r.json().receipt.entityId;
 const event=(await pool.query(`SELECT * FROM outbox_events WHERE tenant_id=$1 AND aggregate_id=$2 AND event_type=$3 ORDER BY id DESC LIMIT 1`,[tenant,id,invitationEvent])).rows[0];
 const secret=JSON.parse(revealInvitation(pii,id,'invitation.email',event.payload_jsonb.encrypted));
 return {id,token:new URLSearchParams(new URL(secret.url).hash.slice(1)).get('token')!,response:r,event};
}
beforeAll(async()=>{
 await pool.query(`INSERT INTO users(id,status) VALUES($1,'active'),($2,'active'),($3,'active')`,[admin,operator,scoped]);
 await pool.query(`INSERT INTO platform_access_grants(user_id,role,scope_type) VALUES($1,'PLATFORM_ADMIN','global'),($2,'PLATFORM_OPERATOR','global')`,[admin,operator]);
 await pool.query(`INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Synthetic existing workshop','pilot')`,[tenantB]);
 await pool.query(`INSERT INTO workshops(tenant_id,name) VALUES($1,'Synthetic existing data')`,[tenantB]);
 const r=await send('POST','/v1/platform/tenants',{name:'Clean Arkaitz fixture',workshop:{name:'Clean workshop'},idempotencyKey:randomUUID()});expect(r.statusCode,r.body).toBe(201);tenant=r.json().receipt.entityId;workshop=r.json().receipt.after.workshop.id;
 await pool.query(`INSERT INTO platform_access_grants(user_id,role,scope_type,tenant_id) VALUES($1,'PLATFORM_ADMIN','tenant',$2)`,[scoped,tenant]);
});
afterAll(async()=>{
 await app.close();
 const users=(await pool.query('SELECT accepted_by AS id FROM workshop_invitations WHERE tenant_id=$1 AND accepted_by IS NOT NULL',[tenant])).rows.map(r=>r.id);
 for(const table of ['workshop_invitations','outbox_events','audit_events','platform_command_receipts','tenant_control_events','tenant_memberships','platform_access_grants','workshops'])await pool.query(`DELETE FROM ${table} WHERE tenant_id=ANY($1::uuid[])`,[[tenant,tenantB,...extraTenants]]);
 await pool.query('DELETE FROM platform_access_grants WHERE user_id=ANY($1::uuid[])',[[admin,operator,scoped,...users]]);
 await pool.query('DELETE FROM external_identities WHERE user_id=ANY($1::uuid[])',[users]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[admin,operator,scoped,...users]]);
 await pool.query('DELETE FROM tenants WHERE id=ANY($1::uuid[])',[[tenant,tenantB,...extraTenants]]);await pool.end();
});
describe('workshop administration invitations, actual PostgreSQL and runtime RLS',()=>{
 it('creates a clean tenant, preserves the other fixture, updates plan and lifecycle using existing controls',async()=>{
  expect((await pool.query('SELECT count(*)::int n FROM customers WHERE tenant_id=$1',[tenant])).rows[0].n).toBe(0);
  expect((await send('GET',`/v1/platform/tenants/${tenant}/workshops/${workshop}`)).statusCode).toBe(200);
  expect((await send('POST','/v1/platform/tenants',{name:'Denied',workshop:{name:'Denied'},idempotencyKey:randomUUID()},'scoped')).statusCode).toBe(403);
  expect((await send('PATCH',`/v1/platform/tenants/${tenant}`,{planCode:'professional',expectedVersion:1,idempotencyKey:randomUUID()})).statusCode).toBe(200);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/lifecycle`,{target:'pilot',reason:'Ephemeral test only',expectedVersion:1,idempotencyKey:randomUUID()})).statusCode).toBe(200);
  expect((await pool.query('SELECT name FROM workshops WHERE tenant_id=$1',[tenantB])).rows[0].name).toBe('Synthetic existing data');
 });
 it('enforces scoped administration and forbids global role escalation',async()=>{
  expect((await send('POST',`/v1/platform/tenants/${tenant}/invitations`,{email:'x@example.invalid',idempotencyKey:randomUUID()},'operator')).statusCode).toBe(403);
  expect((await send('GET',`/v1/platform/tenants/${tenantB}/invitations`,undefined,'scoped')).statusCode).toBe(403);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/grants`,{userId:operator,role:'PLATFORM_ADMIN',idempotencyKey:randomUUID()},'scoped')).statusCode).toBe(403);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/invitations`,{email:'x@example.invalid',role:'PLATFORM_ADMIN',idempotencyKey:randomUUID()})).statusCode).toBe(400);
 });
 it('protects recipient and token persistence, reveals email only to scoped admin, dispatches via existing outbox',async()=>{
  const created=await create('  Arkaitz-Test@Example.Invalid  '.trim());invitation=created.id;token=created.token;
  expect(created.response.body).not.toContain(token);expect(created.response.body).not.toContain('arkaitz-test');
  const snapshot=JSON.stringify((await pool.query(`SELECT row_to_json(i) AS invitation,(SELECT json_agg(o) FROM outbox_events o WHERE o.aggregate_id=i.id) AS outbox,(SELECT json_agg(a) FROM audit_events a WHERE a.entity_id=i.id::text) AS audit,(SELECT json_agg(r) FROM platform_command_receipts r WHERE r.entity_id=i.id::text) AS receipts FROM workshop_invitations i WHERE i.id=$1`,[invitation])).rows);
  expect(snapshot).not.toContain(token);expect(snapshot).not.toContain('arkaitz-test@example.invalid');expect(snapshot).toContain(hashInvitationToken(token));
  const list=await send('GET',`/v1/platform/tenants/${tenant}/invitations`,undefined,'scoped');expect(list.statusCode).toBe(200);expect(list.body).toContain('arkaitz-test@example.invalid');expect(list.body).not.toContain('token_hash');expect(list.body).not.toContain('ciphertext');
  let sent=0;
  const adapter=new WorkshopInvitationSmtpAdapter(pool,pii,()=>({async send(message){sent++;expect(message.to).toBe('arkaitz-test@example.invalid');expect(message.text).toContain(token);return {receiptRef:'smtp:test-accepted'};}}),'sender@example.invalid');
  const events=await claimOutboxBatch(pool,tenant,10,'invitation-test',{eventTypes:[invitationEvent]});expect(events.length).toBe(1);
  expect(await dispatchClaimedOutboxEvent(pool,tenant,events[0].id,events[0].lease_token,adapter)).toBe('succeeded');expect(sent).toBe(1);
 });
 it('rejects idempotency payload changes while replaying the exact command',async()=>{
  const key=randomUUID(),body={email:'idempotent@example.invalid',role:'VIEWER',idempotencyKey:key};
  const first=await send('POST',`/v1/platform/tenants/${tenant}/invitations`,body);expect(first.statusCode,first.body).toBe(201);
  const replay=await send('POST',`/v1/platform/tenants/${tenant}/invitations`,body);expect(replay.json().receipt.receiptId).toBe(first.json().receipt.receiptId);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/invitations`,{...body,role:'OWNER'})).statusCode).toBe(409);
 });
 it('rejects wrong, unverified and mismatched recipients/claims without consuming invitation',async()=>{
  for(const [secret,ident] of [[token+'x',identity()],[token,identity({email:'wrong@example.invalid'})],[token,identity({emailVerified:false})],[token,identity({userId:admin})]] as const)await expect(redeemInvitation(pool,secret,ident,randomUUID(),pii)).rejects.toThrow('INVITATION_INVALID');
  expect((await pool.query('SELECT status FROM workshop_invitations WHERE id=$1',[invitation])).rows[0].status).toBe('pending');
 });
 it('redeems once atomically under concurrency and grants only this tenant',async()=>{
  const results=await Promise.allSettled([redeemInvitation(pool,token,identity(),randomUUID(),pii),redeemInvitation(pool,token,identity(),randomUUID(),pii)]);
  expect(results.filter(r=>r.status==='fulfilled').length).toBe(1);user=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<{user_id:string}>).value.user_id;
  expect((await pool.query('SELECT tenant_id,role FROM tenant_memberships WHERE user_id=$1',[user])).rows).toEqual([{tenant_id:tenant,role:'OWNER'}]);
  expect((await pool.query('SELECT count(*)::int n FROM platform_access_grants WHERE user_id=$1',[user])).rows[0].n).toBe(0);
  expect((await pool.query(`SELECT count(*)::int n FROM audit_events WHERE entity_id=$1 AND event_type='invitation.accepted'`,[invitation])).rows[0].n).toBe(1);
 });
 it('rotates on resend, expires, isolates idempotency scope and rejects stale delivery',async()=>{
  const i=await create('rotate@example.invalid');
  const key=randomUUID();const r=await send('POST',`/v1/platform/tenants/${tenant}/invitations/${i.id}/resend`,{idempotencyKey:key,expectedVersion:1});expect(r.statusCode,r.body).toBe(200);
  await expect(redeemInvitation(pool,i.token,identity({email:'rotate@example.invalid',subject:'rotate'}),randomUUID(),pii)).rejects.toThrow('INVITATION_INVALID');
  const adapter=new WorkshopInvitationSmtpAdapter(pool,pii,()=>({async send(){throw Error('must not send');}}),'sender@example.invalid');
  expect(await adapter.execute(i.event,'test',new AbortController().signal)).toMatchObject({outcome:'permanent_failure',code:'INVITATION_OBSOLETE'});
  expect((await send('POST',`/v1/platform/tenants/${tenantB}/invitations/${i.id}/resend`,{idempotencyKey:key,expectedVersion:1})).statusCode).toBe(409);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/invitations/${i.id}/resend`,{idempotencyKey:randomUUID(),expectedVersion:1})).statusCode).toBe(409);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/invitations/${randomUUID()}/resend`,{idempotencyKey:key,expectedVersion:1})).statusCode).toBe(409);
  expect((await send('POST',`/v1/platform/tenants/${tenant}/invitations/${i.id}/expire`,{idempotencyKey:randomUUID(),expectedVersion:2})).statusCode).toBe(200);
  const expired=await create('expired@example.invalid');await pool.query("UPDATE workshop_invitations SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
  await expect(redeemInvitation(pool,expired.token,identity({email:'expired@example.invalid'}),randomUUID(),pii)).rejects.toThrow('INVITATION_INVALID');
 });
 it('cannot reactivate a revoked membership, suspended user, or suspended tenant; cannot elevate existing role',async()=>{
  for(const mutation of ['membership','user','tenant','role']){
   const i=await create(`${mutation}@example.invalid`,mutation==='role'?'VIEWER':'OWNER');
   if(mutation==='membership')await pool.query("UPDATE tenant_memberships SET status='revoked' WHERE user_id=$1",[user]);
   if(mutation==='user')await pool.query("UPDATE users SET status='suspended' WHERE id=$1",[user]);
   if(mutation==='tenant')await pool.query("UPDATE tenants SET lifecycle_status='suspended' WHERE id=$1",[tenant]);
   await expect(redeemInvitation(pool,i.token,identity({email:`${mutation}@example.invalid`}),randomUUID(),pii)).rejects.toThrow('INVITATION_INVALID');
   await pool.query("UPDATE tenant_memberships SET status='active' WHERE user_id=$1",[user]);await pool.query("UPDATE users SET status='active' WHERE id=$1",[user]);await pool.query("UPDATE tenants SET lifecycle_status='pilot' WHERE id=$1",[tenant]);
  }
 });
 it('applies FORCE RLS and runtime role denial for other-tenant invitation metadata',async()=>{
  const rows=await inTenantTransaction(pool,tenantB,c=>c.query('SELECT id FROM workshop_invitations'));expect(rows.rowCount).toBe(0);
  const rights=await inTenantTransaction(pool,tenantB,c=>c.query("SELECT current_user AS role,has_schema_privilege(current_user,'public','CREATE') AS ddl,pg_has_role(current_user,'bibendia_migrator','member') AS migrator"));expect(rights.rows[0]).toEqual({role:'bibendia_api',ddl:false,migrator:false});
  await expect(inTenantTransaction(pool,tenant,c=>c.query("UPDATE workshop_invitations SET status='expired' WHERE tenant_id=$1 RETURNING id",[tenant]))).resolves.toMatchObject({rowCount:0});
  await expect(inTenantTransaction(pool,tenant,c=>c.query("INSERT INTO workshop_invitations DEFAULT VALUES"),'bibendia_worker')).rejects.toMatchObject({code:'42501'});
  expect((await pool.query("SELECT relforcerowsecurity FROM pg_class WHERE relname='workshop_invitations'")).rows[0].relforcerowsecurity).toBe(true);
 });
 it('reports disabled delivery without inventing successful mail',async()=>{
  const disabled=buildApi(pool,{piiProtection:pii,invitationDelivery:{enabled:false,workshopOrigin:'https://app.bibendia.test'},authentication:{async authenticate(){return principal(admin);}}});
  const r=await disabled.inject({method:'POST',url:`/v1/platform/tenants/${tenant}/invitations`,payload:{email:'disabled@example.invalid',idempotencyKey:randomUUID()}});expect(r.statusCode,r.body).toBe(201);expect(r.json().receipt.after.delivery).toEqual({state:'disabled',eventId:null});await disabled.close();
 });
});

describe('real signed OIDC callback and subsequent normal login',()=>{
 it('uses nonce/state/PKCE, verified identity, canonical UUID and membership discovery without pilot reconfiguration',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);let jwt='';let issuer='';
  const server=createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.url==='/.well-known/jwks.json')return res.end(JSON.stringify({keys:[{...jwk,kid:'test',alg:'RS256'}]}));if(req.url==='/oauth/token')return res.end(JSON.stringify({id_token:jwt}));res.statusCode=404;res.end('{}');});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));issuer=`http://127.0.0.1:${(server.address() as {port:number}).port}/`;
  const config={issuer,sessionKey:Buffer.alloc(32,7).toString('base64url'),sessionTtlSeconds:3600,workshop:{audience:'workshop' as const,clientId:'workshop-test',clientSecret:'secret',origin:'https://app.bibendia.test',cookieName:'__Host-test-workshop',requireMfa:false,authorizationTenantId:tenantB},platform:{audience:'platform' as const,clientId:'platform-test',clientSecret:'secret',origin:'https://admin.bibendia.test',cookieName:'__Host-test-platform',requireMfa:true,authorizationTenantId:tenantB}};
  const adapter=new OidcAuthenticationAdapter(pool,config);const authApp=buildApi(pool,{humanAuthentication:adapter,piiProtection:pii,invitationDelivery:{enabled:false,workshopOrigin:config.workshop.origin}});
  const i=await create('signed@example.invalid');
  try{
   const bridge=await authApp.inject({url:'/auth/invitation',headers:{host:'app.bibendia.test'}});expect(bridge.statusCode).toBe(200);expect(bridge.headers['cache-control']).toBe('no-store');expect(bridge.headers['content-security-policy']).toContain("default-src 'none'");
   async function login(invite?:string,extra:Record<string,unknown>={},stateOverride?:string,selectedTenant?:string){
    const start=await authApp.inject(invite?{method:'POST',url:'/auth/invitation/start',payload:{token:invite},headers:{host:'app.bibendia.test'}}:{url:selectedTenant?`/auth/login?tenantId=${selectedTenant}`:'/auth/login',headers:{host:'app.bibendia.test'}});
    expect(start.statusCode,start.body).toBe(invite?200:302);const authorize=new URL(invite?start.json().authorizationUrl:String(start.headers.location));expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    jwt=await new SignJWT({nonce:authorize.searchParams.get('nonce'),email:'signed@example.invalid',email_verified:true,...extra}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(issuer).setSubject('signed-new').setAudience('workshop-test').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    const cookie=String(start.headers['set-cookie']).split(';')[0];
    return authApp.inject({url:`/auth/callback?code=code-example-123&state=${stateOverride??authorize.searchParams.get('state')}`,headers:{host:'app.bibendia.test',cookie}});
   }
   expect((await login(i.token,{email_verified:false})).statusCode).toBe(401);
   expect((await login(i.token,{email:'wrong@example.invalid'})).statusCode).toBe(401);
   expect((await login(i.token,{nonce:'wrong-nonce'})).statusCode).toBe(401);
   expect((await login(i.token,{},'invalid-state-123456789012')).statusCode).toBe(401);
   const first=await login(i.token);expect(first.statusCode,first.body).toBe(302);
   const again=await login();expect(again.statusCode,again.body).toBe(302);
   const cookie=String(again.headers['set-cookie']).split(',').find(c=>c.trim().startsWith('__Host-test-workshop='))?.trim().split(';')[0]??(again.headers['set-cookie'] as unknown as string[]).find(c=>c.startsWith('__Host-test-workshop='))!.split(';')[0];
   const session=await authApp.inject({url:'/auth/session',headers:{host:'app.bibendia.test',cookie}});expect(session.statusCode,session.body).toBe(200);expect(session.json().tenantIds).toEqual([tenant]);expect(session.json().activeTenantId).toBe(tenant);
   expect((await login(undefined,{'https://bibendia.com/user_id':admin})).statusCode).toBe(401);
   const bad=await login(undefined,{email_verified:false});expect(bad.statusCode).toBe(302); // Ordinary known bound identity does not use email as authorization.
   const signedUser=session.json().principal.userId;
   // Preserve authorized legacy pilot selection; two non-pilot memberships require explicit choice.
   await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'OWNER')",[signedUser,tenantB]);
   expect((await login()).statusCode).toBe(302);
   await pool.query('DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[signedUser,tenantB]);
   const other=randomUUID();extraTenants.push(other);await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Ambiguous ephemeral workshop','pilot')",[other]);
   await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'VIEWER')",[signedUser,other]);
   const ambiguous=await login();expect(ambiguous.statusCode).toBe(403);expect(ambiguous.json().error).toBe('WORKSHOP_SELECTION_REQUIRED');
   expect((await login(undefined,{},undefined,tenant)).statusCode).toBe(302);
   expect((await login(undefined,{},undefined,tenantB)).statusCode).toBe(403);

  }finally{await authApp.close();await new Promise<void>((r,e)=>server.close(err=>err?e(err):r()));}
 });
});
