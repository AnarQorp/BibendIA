import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import type { PiiProtection, ProtectedValue } from '../../security/pii-protection.js';

export const channels = ['PHONE','WHATSAPP','WEB','MANUAL'] as const;
export const callerTypes = ['CUSTOMER','SUPPLIER','INSURER_ASSESSOR','RENTING_FLEET','TOW_TRANSPORT','OTHER_WORKSHOP','COMMERCIAL','OTHER'] as const;
export const categories = ['callback_request','appointment_issue','late_arrival','vehicle_status_question','estimate_question',
  'additional_vehicle_issue','supplier_message','parts_delivery','tow_delivery','insurance_assessor','administration_invoice',
  'missed_call_return','commercial','other'] as const;
export const priorities = ['LOW','NORMAL','HIGH','URGENT'] as const;
export const statuses = ['OPEN','IN_PROGRESS','WAITING_CUSTOMER','WAITING_WORKSHOP','RESOLVED','CLOSED'] as const;

export const createCaseSchema = z.object({
  workshopId: z.string().uuid(), channel: z.enum(channels), callerType: z.enum(callerTypes),
  category: z.enum(categories), summary: z.string().trim().min(1).max(500), detail: z.string().trim().max(4000).optional(),
  priority: z.enum(priorities).default('NORMAL'), customerId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(), appointmentId: z.string().uuid().nullable().optional(),
  estimateId: z.string().uuid().nullable().optional(), contactContext: z.record(z.string(), z.string().max(500)).optional(),
  idempotencyKey: z.string().min(8).max(200), provenance: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const voiceCaseSchema = z.object({
  providerConversationId: z.string().min(1).max(200), requestId: z.string().min(8).max(200),
  receptionContextToken: z.string().uuid().optional(), callerType: z.enum(callerTypes), category: z.enum(categories),
  summary: z.string().trim().min(1).max(500), detail: z.string().trim().max(4000).optional(),
  priority: z.enum(priorities).default('NORMAL'), contactContext: z.record(z.string(), z.string().max(500)).optional(),
}).strict();
export const requestHumanContactSchema = voiceCaseSchema.omit({category:true});

export class ReceptionCaseError extends Error {
  constructor(readonly code: 'CASE_NOT_FOUND'|'CASE_IDEMPOTENCY_CONFLICT'|'CASE_LINK_INVALID'|'CASE_STATUS_INVALID') { super(code); }
}

type CreateCase = z.infer<typeof createCaseSchema> & { conversationId?: string | null; providerConversationId?: string | null };

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
};

function protectedColumns(value: ReturnType<PiiProtection['protect']> | null) {
  return value ? [value.ciphertext,value.nonce,value.authTag,value.keyId] : [null,null,null,null];
}

async function assertLinks(client: pg.PoolClient, tenantId: string, command: CreateCase) {
  const checks: Array<[string | null | undefined,string]> = [
    [command.workshopId,'workshops'],[command.customerId,'customers'],[command.vehicleId,'vehicles'],
    [command.appointmentId,'appointments'],[command.estimateId,'estimate_drafts'],[command.conversationId,'conversations'],
  ];
  for (const [id, table] of checks) {
    if (!id) continue;
    const found = await client.query(`SELECT 1 FROM ${table} WHERE tenant_id=$1 AND id=$2`,[tenantId,id]);
    if (found.rowCount !== 1) throw new ReceptionCaseError('CASE_LINK_INVALID');
  }
}

export async function createReceptionCase(client: pg.PoolClient, pii: PiiProtection, tenantId: string,
  actor: { type: string; id: string }, correlationId: string, command: CreateCase) {
  const requestHash=createHash('sha256').update(canonical(command)).digest('hex');
  const existing=await client.query<{id:string;provenance:{requestHash?:string}}>(
    'SELECT id,provenance FROM reception_cases WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE',[tenantId,command.idempotencyKey]);
  if(existing.rowCount){
    if(existing.rows[0].provenance?.requestHash!==requestHash) throw new ReceptionCaseError('CASE_IDEMPOTENCY_CONFLICT');
    return { case:await getReceptionCase(client,pii,tenantId,existing.rows[0].id), replay:true };
  }
  await assertLinks(client,tenantId,command);
  const summary=pii.protect(tenantId,'reception_case.summary',command.summary);
  const detail=command.detail?pii.protect(tenantId,'reception_case.detail',command.detail):null;
  const contact=command.contactContext?pii.protect(tenantId,'reception_case.contact_context',JSON.stringify(command.contactContext)):null;
  const id=randomUUID();
  const provenance={...command.provenance,requestHash};
  await client.query(`INSERT INTO reception_cases
    (id,tenant_id,workshop_id,conversation_id,customer_id,vehicle_id,appointment_id,estimate_id,channel,caller_type,category,
     priority,status,provider_conversation_id,provenance,idempotency_key,
     summary_ciphertext,summary_nonce,summary_auth_tag,summary_key_id,detail_ciphertext,detail_nonce,detail_auth_tag,detail_key_id,
     contact_context_ciphertext,contact_context_nonce,contact_context_auth_tag,contact_context_key_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'OPEN',$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
    [id,tenantId,command.workshopId,command.conversationId??null,command.customerId??null,command.vehicleId??null,
      command.appointmentId??null,command.estimateId??null,command.channel,command.callerType,command.category,command.priority,
      command.providerConversationId??null,JSON.stringify(provenance),command.idempotencyKey,
      ...protectedColumns(summary),...protectedColumns(detail),...protectedColumns(contact)]);
  await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
    VALUES($1,$2,$3,'reception_case.created','reception_case',$4,$5,$6)`,[tenantId,actor.type,actor.id,id,correlationId,`postgres:reception_case:${id}`]);
  return { case:await getReceptionCase(client,pii,tenantId,id), replay:false };
}

function reveal(pii:PiiProtection,tenantId:string,field:string,row:Record<string,unknown>,prefix:string){
  if(!row[`${prefix}_ciphertext`]) return null;
  return pii.reveal(tenantId,field,{ciphertext:row[`${prefix}_ciphertext`],nonce:row[`${prefix}_nonce`],
    authTag:row[`${prefix}_auth_tag`],keyId:row[`${prefix}_key_id`]} as ProtectedValue);
}

export async function getReceptionCase(client:pg.PoolClient,pii:PiiProtection,tenantId:string,id:string){
  const result=await client.query<Record<string,unknown>>(`SELECT * FROM reception_cases WHERE tenant_id=$1 AND id=$2`,[tenantId,id]);
  if(result.rowCount!==1) throw new ReceptionCaseError('CASE_NOT_FOUND');
  const r=result.rows[0];
  const contact=reveal(pii,tenantId,'reception_case.contact_context',r,'contact_context');
  return {id:r.id,workshopId:r.workshop_id,channel:r.channel,callerType:r.caller_type,category:r.category,
    summary:reveal(pii,tenantId,'reception_case.summary',r,'summary'),detail:reveal(pii,tenantId,'reception_case.detail',r,'detail'),
    priority:r.priority,status:r.status,providerConversationId:r.provider_conversation_id,customerId:r.customer_id,vehicleId:r.vehicle_id,
    appointmentId:r.appointment_id,estimateId:r.estimate_id,contactContext:contact?JSON.parse(contact):null,
    provenance:r.provenance,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,resolvedAt:r.resolved_at,closedAt:r.closed_at};
}

export async function listReceptionCases(client:pg.PoolClient,pii:PiiProtection,tenantId:string,filters:{
  status?:string;category?:string;channel?:string;priority?:string;customerId?:string;vehicleId?:string;limit:number;offset:number;
}){
  const values:unknown[]=[tenantId]; const where=['tenant_id=$1'];
  for(const [column,value] of [['status',filters.status],['category',filters.category],['channel',filters.channel],
    ['priority',filters.priority],['customer_id',filters.customerId],['vehicle_id',filters.vehicleId]] as const){
    if(value){ values.push(value); where.push(`${column}=$${values.length}`); }
  }
  values.push(filters.limit,filters.offset);
  const rows=await client.query<{id:string}>(`SELECT id FROM reception_cases WHERE ${where.join(' AND ')}
    ORDER BY CASE status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'WAITING_WORKSHOP' THEN 2
      WHEN 'WAITING_CUSTOMER' THEN 3 ELSE 4 END, updated_at DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
  return Promise.all(rows.rows.map((row)=>getReceptionCase(client,pii,tenantId,row.id)));
}

export async function updateReceptionCase(client:pg.PoolClient,pii:PiiProtection,tenantId:string,id:string,
  actor:{type:string;id:string},correlationId:string,patch:{status?:typeof statuses[number];priority?:typeof priorities[number];
    customerId?:string|null;vehicleId?:string|null;appointmentId?:string|null;estimateId?:string|null}){
  const current=await getReceptionCase(client,pii,tenantId,id);
  for(const [value,table] of [[patch.customerId,'customers'],[patch.vehicleId,'vehicles'],[patch.appointmentId,'appointments'],
    [patch.estimateId,'estimate_drafts']] as const){if(value){const found=await client.query(`SELECT 1 FROM ${table} WHERE tenant_id=$1 AND id=$2`,[tenantId,value]);
      if(found.rowCount!==1)throw new ReceptionCaseError('CASE_LINK_INVALID');}}
  const terminal=patch.status==='RESOLVED'||patch.status==='CLOSED';
  await client.query(`UPDATE reception_cases SET status=COALESCE($3,status),priority=COALESCE($4,priority),
    customer_id=CASE WHEN $5 THEN $6::uuid ELSE customer_id END,vehicle_id=CASE WHEN $7 THEN $8::uuid ELSE vehicle_id END,
    appointment_id=CASE WHEN $9 THEN $10::uuid ELSE appointment_id END,estimate_id=CASE WHEN $11 THEN $12::uuid ELSE estimate_id END,
    resolved_at=CASE WHEN $3='RESOLVED' THEN COALESCE(resolved_at,now()) WHEN $3 IS NOT NULL AND $3<>'CLOSED' THEN NULL ELSE resolved_at END,
    closed_at=CASE WHEN $3='CLOSED' THEN COALESCE(closed_at,now()) WHEN $3 IS NOT NULL THEN NULL ELSE closed_at END,
    updated_at=now(),version=version+1 WHERE tenant_id=$1 AND id=$2`,[tenantId,id,patch.status??null,patch.priority??null,
      'customerId'in patch,patch.customerId??null,'vehicleId'in patch,patch.vehicleId??null,'appointmentId'in patch,patch.appointmentId??null,
      'estimateId'in patch,patch.estimateId??null]);
  await client.query(`INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
    VALUES($1,$2,$3,$4,'reception_case',$5,$6,$7)`,[tenantId,actor.type,actor.id,terminal?'reception_case.completed':'reception_case.updated',id,correlationId,`postgres:reception_case:${id}`]);
  return getReceptionCase(client,pii,tenantId,id);
}
