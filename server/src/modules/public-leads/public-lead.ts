import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { PiiProtection, ProtectedValue } from '../../security/pii-protection.js';

export type PublicLeadInput={workshop:string;contactName:string;phone:string;email?:string;message?:string};
export type PublicLeadReceipt={leadId:string;duplicate:boolean;correlationId:string};
export class PublicLeadError extends Error { constructor(readonly code:'ACQUISITION_UNAVAILABLE'|'RATE_LIMITED'){super(code);} }

export async function receivePublicLead(pool:pg.Pool,pii:PiiProtection,config:{tenantId:string;retentionDays:number;dedupeMinutes:number;rateLimit:number},input:PublicLeadInput,meta:{correlationId:string;clientIdentity:string;idempotencyKey?:string}):Promise<PublicLeadReceipt>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE bibendia_api');
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[config.tenantId]);
    const tenant=await client.query(`SELECT id FROM tenants WHERE id=$1 AND lifecycle_status IN ('pilot','active') AND kill_switch_enabled=false`,[config.tenantId]);
    if(tenant.rowCount!==1)throw new PublicLeadError('ACQUISITION_UNAVAILABLE');
    const now=Date.now(),rateWindow=new Date(Math.floor(now/3_600_000)*3_600_000),dedupeWindow=new Date(Math.floor(now/(config.dedupeMinutes*60_000))*config.dedupeMinutes*60_000);
    const clientHash=pii.activeLookupDigest(config.tenantId,'public_lead.client',meta.clientIdentity).digest;
    const rate=(await client.query<{accepted_count:number}>(`INSERT INTO public_lead_rate_limits(tenant_id,client_fingerprint,window_start,accepted_count) VALUES($1,$2,$3,1)
      ON CONFLICT(tenant_id,client_fingerprint,window_start) DO UPDATE SET accepted_count=public_lead_rate_limits.accepted_count+1,updated_at=now() RETURNING accepted_count`,[config.tenantId,clientHash,rateWindow])).rows[0].accepted_count;
    if(rate>config.rateLimit){await client.query('COMMIT');throw new PublicLeadError('RATE_LIMITED');}
    const normalized=`${normalize(input.workshop)}\0${normalizePhone(input.phone)}\0${normalize(input.email??'')}`;
    const dedup=pii.activeLookupDigest(config.tenantId,'public_lead.dedup',normalized).digest;
    const requestHash=meta.idempotencyKey?pii.activeLookupDigest(config.tenantId,'public_lead.request',meta.idempotencyKey).digest:null;
    const existing=await client.query<{id:string;correlation_id:string}>(`SELECT id,correlation_id FROM public_leads WHERE tenant_id=$1 AND ((request_key_hash IS NOT NULL AND request_key_hash=$2) OR (dedup_fingerprint=$3 AND dedupe_window_start=$4)) LIMIT 1`,[config.tenantId,requestHash,dedup,dedupeWindow]);
    if(existing.rowCount){await client.query('COMMIT');return {leadId:existing.rows[0].id,duplicate:true,correlationId:meta.correlationId};}
    const id=randomUUID(),workshop=pii.protect(id,'public_lead.workshop',input.workshop),contact=pii.protect(id,'public_lead.contact_name',input.contactName),phone=pii.protect(id,'public_lead.phone',input.phone),email=input.email?pii.protect(id,'public_lead.email',input.email):null,message=input.message?pii.protect(id,'public_lead.message',input.message):null;
    await client.query(`INSERT INTO public_leads(id,tenant_id,workshop_ciphertext,workshop_nonce,workshop_auth_tag,workshop_key_id,contact_name_ciphertext,contact_name_nonce,contact_name_auth_tag,contact_name_key_id,phone_ciphertext,phone_nonce,phone_auth_tag,phone_key_id,email_ciphertext,email_nonce,email_auth_tag,email_key_id,message_ciphertext,message_nonce,message_auth_tag,message_key_id,correlation_id,request_key_hash,dedup_fingerprint,dedupe_window_start,client_fingerprint,retention_until)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,now()+($28::text||' days')::interval)`,[id,config.tenantId,...protectedArgs(workshop),...protectedArgs(contact),...protectedArgs(phone),...optionalArgs(email),...optionalArgs(message),meta.correlationId,requestHash,dedup,dedupeWindow,clientHash,config.retentionDays]);
    const evidence=`postgres:public-lead:${id}`;
    await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref) VALUES($1,'public','anonymous','public_lead.received','public_lead',$2,$3,$4)`,[config.tenantId,id,meta.correlationId,evidence]);
    await client.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb,external_idempotency_key,correlation_id,max_attempts,effect_valid_until) VALUES($1,'public_lead',$2,'public_lead.notification_requested',$3,$4,$5,5,now()+interval '7 days')`,[config.tenantId,id,{leadId:id},`public-lead:${id}`,meta.correlationId]);
    await client.query('COMMIT'); return {leadId:id,duplicate:false,correlationId:meta.correlationId};
  }catch(error){if(!(error instanceof PublicLeadError&&error.code==='RATE_LIMITED'))await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
}
function protectedArgs(v:ProtectedValue){return [v.ciphertext,v.nonce,v.authTag,v.keyId] as const;}
function optionalArgs(v:ProtectedValue|null){return v?protectedArgs(v):[null,null,null,null] as const;}
export function normalizePhone(value:string){return value.trim().replace(/[\s().-]/g,'');}
function normalize(value:string){return value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');}
