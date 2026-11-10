import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import { PlatformAdminError, record, findReceipt } from './platform-admin-routes.js';
import { InvitationError, revealInvitation, normalizeInvitationEmail, rotateInvitation, type InvitationDelivery } from '../modules/invitations/invitations.js';
import type { PiiProtection } from '../security/pii-protection.js';
const auth={config:{auth:{mode:'authenticated' as const,audience:'platform' as const,principalKinds:['platform_user'] as const}}};
const command=z.object({idempotencyKey:z.string().min(8).max(200),expiresInHours:z.number().int().min(1).max(168).default(72)}).strict();
const mutation=command.extend({expectedVersion:z.number().int().positive()});
const create=command.extend({email:z.string().trim().max(254).pipe(z.email()).transform(normalizeInvitationEmail),role:z.enum(['OWNER','MANAGER','RECEPTION','VIEWER']).default('OWNER')});
export function registerWorkshopInvitationRoutes(app:FastifyInstance,pool:pg.Pool,pii:PiiProtection,delivery:InvitationDelivery){
 const transaction=async(req:any,work:(c:pg.PoolClient,t:string,a:string)=>Promise<unknown>)=>{
  const tenantId=z.uuid().parse(req.params.tenantId);
  if(req.principal?.kind!=='platform_user') throw new InvitationError('INVITATION_INVALID');
  return inAuthorizedTenantTransaction(pool,{principal:req.principal,requestedTenantId:tenantId,capability:'platform:memberships:manage',correlationId:req.id},(c,ctx)=>work(c,tenantId,ctx.principal.kind==='platform_user'?ctx.principal.userId:''));
 };
 app.get('/v1/platform/tenants/:tenantId/invitations',auth,async req=>transaction(req,async(c,t)=>({data:(await c.query(`SELECT i.id,i.tenant_id,i.email_encrypted,i.role,CASE WHEN i.status='pending' AND i.expires_at<=now() THEN 'expired' ELSE i.status END AS status,i.expires_at,i.accepted_at,i.created_at,i.version,COALESCE((SELECT o.delivery_state FROM outbox_events o WHERE o.tenant_id=i.tenant_id AND o.aggregate_id=i.id AND o.id=i.delivery_event_id AND o.event_type='workshop_invitation.email_requested' ORDER BY o.id DESC LIMIT 1),'disabled') AS delivery_state FROM workshop_invitations i WHERE i.tenant_id=$1 ORDER BY i.created_at DESC LIMIT 100`,[t])).rows.map(({email_encrypted,...r})=>({...r,email:revealInvitation(pii,r.id,'invitation.recipient',email_encrypted)})),correlationId:req.id})));
 app.post('/v1/platform/tenants/:tenantId/invitations',auth,async(req,reply)=>{
  const b=create.parse(req.body); const result=await transaction(req,async(c,t,a)=>{
   const payload=JSON.stringify({email:b.email,role:b.role,expiresInHours:b.expiresInHours});
   const replay=await findReceipt(c,a,b.idempotencyKey,'invitation.create');if(replay){assertReplay(pii,t,payload,replay);return replay;}
   const after=await rotateInvitation(c,{id:randomUUID(),tenantId:t,email:b.email,role:b.role,actor:a,expiresInHours:b.expiresInHours,correlationId:req.id},pii,delivery);
   return record(c,{tenantId:t,actorId:a,key:b.idempotencyKey,operation:'invitation.create',entityType:'invitation',entityId:after.id,after:{...after,requestDigest:pii.activeLookupDigest(t,'invitation.command',payload)},correlationId:req.id});
  });return reply.code(201).send({receipt:result,correlationId:req.id});
 });
 for(const action of ['resend','expire'] as const)app.post(`/v1/platform/tenants/:tenantId/invitations/:invitationId/${action}`,auth,async req=>{
  const b=mutation.parse(req.body),id=z.uuid().parse((req.params as any).invitationId);
  const receipt=await transaction(req,async(c,t,a)=>{
   const payload=JSON.stringify({id,action,expectedVersion:b.expectedVersion,expiresInHours:b.expiresInHours});
   const replay=await findReceipt(c,a,b.idempotencyKey,`invitation.${action}`);if(replay){assertReplay(pii,t,payload,replay);return replay;}
   const row=(await c.query(`SELECT id,email_encrypted,role,status,version FROM workshop_invitations WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[t,id])).rows[0];
   if(!row||row.status!=='pending')throw new InvitationError('INVITATION_INVALID');
   if(row.version!==b.expectedVersion)throw new PlatformAdminError('VERSION_CONFLICT');
   let after:Record<string,unknown>;
   if(action==='resend')after=await rotateInvitation(c,{id,tenantId:t,email:revealInvitation(pii,id,'invitation.recipient',row.email_encrypted),role:row.role,actor:a,expiresInHours:b.expiresInHours,correlationId:req.id},pii,delivery,true);
   else {await c.query(`UPDATE workshop_invitations SET status='expired',expires_at=now(),updated_at=now(),version=version+1 WHERE tenant_id=$1 AND id=$2`,[t,id]);after={id,tenantId:t,status:'expired'};}
   return record(c,{tenantId:t,actorId:a,key:b.idempotencyKey,operation:`invitation.${action}`,entityType:'invitation',entityId:id,after:{...after,requestDigest:pii.activeLookupDigest(t,'invitation.command',payload)},correlationId:req.id});
  });return {receipt,correlationId:req.id};
 });
}

function assertReplay(pii:PiiProtection,tenant:string,payload:string,receipt:any){const expected=receipt.after.requestDigest;if(!expected || !pii.lookupDigests(tenant,'invitation.command',payload).some(d=>d.keyId===expected.keyId && d.digest===expected.digest))throw new PlatformAdminError('IDEMPOTENCY_CONFLICT');}
