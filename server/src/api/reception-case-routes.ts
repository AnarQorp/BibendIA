import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import { claimInboxEvent, inAuthorizedProviderTransaction } from '../auth/provider-authorization.js';
import type { ServicePrincipal } from '../auth/principal.js';
import { inTenantTransaction } from '../persistence/pool.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';
import { resolveCanonicalReceptionContext } from '../modules/agent-core/reception-lifecycle-tools.js';
import { createCaseSchema,voiceCaseSchema,requestHumanContactSchema,createReceptionCase,getReceptionCase,listReceptionCases,updateReceptionCase,
  getReceptionCaseHistory,ReceptionCaseError,statuses,priorities,categories,channels } from '../modules/reception-cases/reception-cases.js';
import type { PiiProtection } from '../security/pii-protection.js';

const tenantParams=z.object({tenantId:z.string().uuid()});
const caseParams=z.object({tenantId:z.string().uuid(),caseId:z.string().uuid()});
const listSchema=z.object({status:z.enum(statuses).optional(),category:z.enum(categories).optional(),channel:z.enum(channels).optional(),
  priority:z.enum(priorities).optional(),customerId:z.string().uuid().optional(),vehicleId:z.string().uuid().optional(),
  limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)});
const updateSchema=z.object({status:z.enum(statuses).optional(),priority:z.enum(priorities).optional(),customerId:z.string().uuid().nullable().optional(),
  vehicleId:z.string().uuid().nullable().optional(),appointmentId:z.string().uuid().nullable().optional(),estimateId:z.string().uuid().nullable().optional()})
  .strict().refine((v)=>Object.keys(v).length>0);

function principal(request:FastifyRequest):ServicePrincipal{
  if(request.principal?.kind!=='service'||request.principal.serviceType!=='voice_provider') throw new Error('PRINCIPAL_NOT_ALLOWED');
  return request.principal;
}
function fail(reply:FastifyReply,error:unknown,correlationId:string){
  if(error instanceof ReceptionCaseError){
    const status=error.code==='CASE_NOT_FOUND'?404:(error.code==='WORKSHOP_CONTEXT_AMBIGUOUS'?409:409);
    return reply.code(status).send({ok:false,error:error.code,correlationId});
  }
  throw error;
}

export function registerReceptionCaseRoutes(app:FastifyInstance,pool:pg.Pool,pii:PiiProtection){
  const human={config:{auth:{mode:'authenticated' as const,audience:'workshop' as const,principalKinds:['workshop_user' as const]}}};
  app.post('/v1/workshop/tenants/:tenantId/reception-cases',human,async(request,reply)=>{
    const p=tenantParams.safeParse(request.params),body=createCaseSchema.safeParse(request.body);
    if(!p.success||!body.success)return reply.code(400).send({error:'INVALID_RECEPTION_CASE_PAYLOAD',correlationId:request.id});
    if(!request.principal)return reply.code(401).send({error:'AUTHENTICATION_REQUIRED'});
    try{const result=await inAuthorizedTenantTransaction(pool,{principal:request.principal,requestedTenantId:p.data.tenantId,
      capability:'workshop:cases:create',correlationId:request.id},async(client,context)=>{
        await assertTenantOperation(client,context.tenantId,'domain_mutation');
        let workshopId = body.data.workshopId;
        if (!workshopId) {
          const wsRows = await client.query<{ id: string }>('SELECT id FROM workshops WHERE tenant_id=$1', [context.tenantId]);
          if (wsRows.rowCount === 0) throw new ReceptionCaseError('CASE_LINK_INVALID');
          if (wsRows.rowCount! > 1) throw new ReceptionCaseError('WORKSHOP_CONTEXT_AMBIGUOUS');
          workshopId = wsRows.rows[0].id;
        }
        return createReceptionCase(client,pii,context.tenantId,{type:context.principal.kind,id:(context.principal as {userId:string}).userId},request.id,
          {...body.data,workshopId,channel:'MANUAL',provenance:{...body.data.provenance,source:'workshop_manual'}});
      }); return reply.code(result.replay?200:201).send({data:result.case,replay:result.replay,correlationId:request.id});
    }catch(error){return fail(reply,error,request.id);}
  });
  app.get('/v1/workshop/tenants/:tenantId/reception-cases',human,async(request,reply)=>{
    const p=tenantParams.safeParse(request.params),q=listSchema.safeParse(request.query);
    if(!p.success||!q.success)return reply.code(400).send({error:'INVALID_RECEPTION_CASE_QUERY',correlationId:request.id});
    if(!request.principal)return reply.code(401).send({error:'AUTHENTICATION_REQUIRED'});
    const data=await inAuthorizedTenantTransaction(pool,{principal:request.principal,requestedTenantId:p.data.tenantId,
      capability:'workshop:cases:read',correlationId:request.id},async(client,context)=>{await assertTenantOperation(client,context.tenantId,'workshop_read');
      return listReceptionCases(client,pii,context.tenantId,q.data);}); return {data,correlationId:request.id};
  });
  app.get('/v1/workshop/tenants/:tenantId/reception-cases/:caseId',human,async(request,reply)=>{
    const p=caseParams.safeParse(request.params); if(!p.success)return reply.code(400).send({error:'INVALID_RECEPTION_CASE_SELECTOR'});
    if(!request.principal)return reply.code(401).send({error:'AUTHENTICATION_REQUIRED'});
    try{const data=await inAuthorizedTenantTransaction(pool,{principal:request.principal,requestedTenantId:p.data.tenantId,
      capability:'workshop:cases:read',correlationId:request.id},async(client,context)=>{await assertTenantOperation(client,context.tenantId,'workshop_read');
      return getReceptionCase(client,pii,context.tenantId,p.data.caseId);}); return {data,correlationId:request.id};
    }catch(error){return fail(reply,error,request.id);}
  });
  app.get('/v1/workshop/tenants/:tenantId/reception-cases/:caseId/history',human,async(request,reply)=>{
    const p=caseParams.safeParse(request.params); if(!p.success)return reply.code(400).send({error:'INVALID_RECEPTION_CASE_SELECTOR'});
    if(!request.principal)return reply.code(401).send({error:'AUTHENTICATION_REQUIRED'});
    try{const data=await inAuthorizedTenantTransaction(pool,{principal:request.principal,requestedTenantId:p.data.tenantId,
      capability:'workshop:cases:read',correlationId:request.id},async(client,context)=>{await assertTenantOperation(client,context.tenantId,'workshop_read');
      return getReceptionCaseHistory(client,context.tenantId,p.data.caseId);}); return {data,correlationId:request.id};
    }catch(error){return fail(reply,error,request.id);}
  });
  app.patch('/v1/workshop/tenants/:tenantId/reception-cases/:caseId',human,async(request,reply)=>{
    const p=caseParams.safeParse(request.params),body=updateSchema.safeParse(request.body);
    if(!p.success||!body.success)return reply.code(400).send({error:'INVALID_RECEPTION_CASE_UPDATE',correlationId:request.id});
    if(!request.principal)return reply.code(401).send({error:'AUTHENTICATION_REQUIRED'});
    try{const data=await inAuthorizedTenantTransaction(pool,{principal:request.principal,requestedTenantId:p.data.tenantId,
      capability:'workshop:cases:update',correlationId:request.id},async(client,context)=>{await assertTenantOperation(client,context.tenantId,'domain_mutation');
      return updateReceptionCase(client,pii,context.tenantId,p.data.caseId,{type:context.principal.kind,id:(context.principal as {userId:string}).userId},request.id,body.data);});
      return {data,correlationId:request.id};}catch(error){return fail(reply,error,request.id);}
  });

  const voiceConfig={rawBody:true,auth:{mode:'authenticated',audience:'provider',principalKinds:['service']}} as const;
  const voiceHandler=(callbackOnly:boolean)=>async(request:FastifyRequest,reply:FastifyReply)=>{
    const parsed=(callbackOnly?requestHumanContactSchema:voiceCaseSchema).safeParse(request.body); if(!parsed.success)return reply.code(400).send({ok:false,error:'INVALID_RECEPTION_CASE_PAYLOAD'});
    const input={...parsed.data,category:(callbackOnly?'callback_request':('category' in parsed.data?parsed.data.category:'other')) as typeof categories[number]}; const service=principal(request);
    const correlationId=`elevenlabs:${input.providerConversationId}:${callbackOnly?'request-human-contact':'create-reception-case'}`;
    const authorized=await inAuthorizedProviderTransaction(pool,{principal:service,provider:'elevenlabs',correlationId},async(client,context)=>({context,
      disposition:await claimInboxEvent(client,{context,principal:service,provider:'elevenlabs',externalEventId:`tool:${callbackOnly?'request-human-contact':'create-reception-case'}:${input.providerConversationId}:${input.requestId}`,
        rawBody:request.rawBody?.toString()??JSON.stringify(request.body)})}));
    const canonical=input.receptionContextToken?await resolveCanonicalReceptionContext(pool,pii,authorized.context,input.receptionContextToken,input.providerConversationId):null;
    try{const result=await inTenantTransaction(pool,authorized.context.tenantId,async(client)=>{
      await assertTenantOperation(client,authorized.context.tenantId,'domain_mutation');
      const caseIdempotencyKey=`voice-case:${service.serviceId}:${input.providerConversationId}:${input.requestId}`;
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 161803))", [`${authorized.context.tenantId}:${caseIdempotencyKey}`]);
      let conversationId=canonical?.conversationId??null;
      if(!conversationId){const call=await client.query<{conversation_id:string}>("SELECT conversation_id FROM calls WHERE tenant_id=$1 AND provider='elevenlabs' AND provider_call_id=$2",[authorized.context.tenantId,input.providerConversationId]);
        if(call.rowCount)conversationId=call.rows[0].conversation_id; else {conversationId=randomUUID();await client.query('INSERT INTO conversations(id,tenant_id,workshop_id) VALUES($1,$2,$3)',[conversationId,authorized.context.tenantId,authorized.context.workshopId]);
          await client.query("INSERT INTO calls(tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,'elevenlabs',$3,'active')",[authorized.context.tenantId,conversationId,input.providerConversationId]);}}
      return createReceptionCase(client,pii,authorized.context.tenantId,authorized.context.actor,correlationId,{workshopId:authorized.context.workshopId,
        channel:'PHONE',callerType:input.callerType,category:input.category,summary:input.summary,detail:input.detail,priority:input.priority,
        customerId:canonical?.customerId??null,vehicleId:canonical?.vehicleId??null,contactContext:input.contactContext,
        idempotencyKey:caseIdempotencyKey,conversationId,
        providerConversationId:input.providerConversationId,provenance:{source:'elevenlabs_tool',provider:'elevenlabs',servicePrincipalId:service.serviceId,requestId:input.requestId}});
    }); return reply.code(result.replay?200:201).send({ok:true,code:callbackOnly?'HUMAN_CONTACT_REQUESTED':'RECEPTION_CASE_CREATED',
      disposition:authorized.disposition,replay:result.replay,case:result.case,correlationId});}catch(error){return fail(reply,error,correlationId);}
  };
  app.post('/v1/providers/elevenlabs/tools/create-reception-case',{config:voiceConfig},voiceHandler(false));
  app.post('/v1/providers/elevenlabs/tools/request-human-contact',{config:voiceConfig},voiceHandler(true));
}
