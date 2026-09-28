import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { PiiProtection } from '../security/pii-protection.js';
import { normalizePhone,PublicLeadError,receivePublicLead } from '../modules/public-leads/public-lead.js';

const schema=z.object({workshop:z.string().trim().min(2).max(160),contactName:z.string().trim().min(2).max(120),phone:z.string().trim().min(7).max(32).transform(normalizePhone).refine(v=>/^\+[1-9]\d{6,14}$/.test(v)),email:z.string().trim().email().max(254).optional().or(z.literal('').transform(()=>undefined)),message:z.string().trim().max(2000).optional().or(z.literal('').transform(()=>undefined)),website:z.string().max(200).default('')}).strict();
export function registerPublicLeadRoute(app:FastifyInstance,pool:pg.Pool,pii:PiiProtection,config?:{tenantId:string;retentionDays?:number;dedupeMinutes?:number;rateLimit?:number}){
  app.post('/public/leads',{bodyLimit:16_384,config:{auth:{mode:'public'}}},async(request,reply)=>{
    if(!request.headers['content-type']?.toLowerCase().startsWith('application/json'))return reply.code(415).send({accepted:false,error:'UNSUPPORTED_MEDIA_TYPE',correlationId:request.id});
    const parsed=schema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({accepted:false,error:'INVALID_REQUEST',correlationId:request.id});
    if(parsed.data.website)return reply.code(202).send({accepted:true,correlationId:request.id});
    if(!config)return reply.code(503).send({accepted:false,error:'TEMPORARILY_UNAVAILABLE',correlationId:request.id});
    const idempotency=typeof request.headers['idempotency-key']==='string'?request.headers['idempotency-key']:undefined;
    if(idempotency&&!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotency))return reply.code(400).send({accepted:false,error:'INVALID_REQUEST',correlationId:request.id});
    try{await receivePublicLead(pool,pii,{tenantId:config.tenantId,retentionDays:config.retentionDays??365,dedupeMinutes:config.dedupeMinutes??15,rateLimit:config.rateLimit??5},parsed.data,{correlationId:request.id,clientIdentity:request.ip,idempotencyKey:idempotency});return reply.code(202).send({accepted:true,correlationId:request.id});}
    catch(error){if(error instanceof PublicLeadError)return reply.code(error.code==='RATE_LIMITED'?429:503).send({accepted:false,error:error.code==='RATE_LIMITED'?'TOO_MANY_REQUESTS':'TEMPORARILY_UNAVAILABLE',correlationId:request.id});throw error;}
  });
}
