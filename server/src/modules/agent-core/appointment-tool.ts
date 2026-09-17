import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type pg from 'pg';
import { inTenantTransaction } from '../../persistence/pool.js';
import { evaluatePolicy } from '../policy/pilot-mode.js';
import { createAppointmentTransactional } from '../scheduling/postgres-scheduling.js';
import type { TenantContext } from '../../domain/ids.js';

export const appointmentToolInput = z.object({
  provider: z.literal('elevenlabs'), externalAccountId: z.string().min(1), providerCallId: z.string().min(1),
  customerName: z.string().min(2), plate: z.string().min(4), serviceIntent: z.enum(['inspection','oil_service','brakes_or_noise','generic_fault']),
  symptoms: z.array(z.string()).min(1), notes: z.string().optional(), estimatedDurationMinutes: z.number().int().min(15).max(480),
  slotToken: z.string().min(1), explicitConfirmation: z.literal(true), confirmationTranscript: z.string().min(3),
});
export type AppointmentToolInput = z.infer<typeof appointmentToolInput>;
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (value: string) => createHash('sha256').update(normalize(value)).digest('hex');

export async function executeAppointmentTool(pool: pg.Pool, raw: unknown) {
  const input = appointmentToolInput.parse(raw);
  const endpoint = await pool.query<{tenant_id:string;workshop_id:string}>(
    'SELECT tenant_id,workshop_id FROM channel_endpoints WHERE provider=$1 AND external_account_id=$2 AND called_endpoint=$3 AND status=\'active\'',
    [input.provider,input.externalAccountId,'web-gate'],
  );
  if (endpoint.rowCount !== 1) return { ok:false, code:'TENANT_NOT_RESOLVED', safeMessage:'No puedo identificar el taller; dejaré el caso para atención humana.' };
  const { tenant_id:tenantId, workshop_id:workshopId } = endpoint.rows[0];
  const correlationId = `voice:${input.providerCallId}`;
  const chain = await inTenantTransaction(pool, tenantId, async (client) => {
    let call = await client.query<{id:string;conversation_id:string}>('SELECT id,conversation_id FROM calls WHERE tenant_id=$1 AND provider=$2 AND provider_call_id=$3',[tenantId,input.provider,input.providerCallId]);
    if (!call.rowCount) {
      const conversationId=randomUUID(); const callId=randomUUID();
      await client.query('INSERT INTO conversations(id,tenant_id,workshop_id) VALUES($1,$2,$3)',[conversationId,tenantId,workshopId]);
      await client.query("INSERT INTO calls(id,tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,$3,$4,$5,'active')",[callId,tenantId,conversationId,input.provider,input.providerCallId]);
      call={rows:[{id:callId,conversation_id:conversationId}],rowCount:1,command:'',oid:0,fields:[]};
    }
    const callRow=call.rows[0];
    let caseRow=await client.query<{id:string}>('SELECT id FROM reception_cases WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,callRow.conversation_id]);
    if(!caseRow.rowCount){ caseRow=await client.query("INSERT INTO reception_cases(tenant_id,conversation_id,intent,status) VALUES($1,$2,$3,'ready_to_decide') RETURNING id",[tenantId,callRow.conversation_id,input.serviceIntent]); }
    const identity=await client.query<{vehicle_id:string;customer_id:string;display_name:string}>(`SELECT v.id vehicle_id,c.id customer_id,c.display_name FROM vehicles v JOIN customer_vehicle_roles r ON r.vehicle_id=v.id AND r.tenant_id=v.tenant_id JOIN customers c ON c.id=r.customer_id AND c.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.plate_hash=$2`,[tenantId,hash(input.plate)]);
    if(identity.rowCount!==1) return { unresolved:true as const, callId:callRow.id,conversationId:callRow.conversation_id,caseId:caseRow.rows[0].id };
    const resolved=identity.rows[0];
    await client.query('UPDATE reception_cases SET customer_id=$1,vehicle_id=$2,status=\'executing\' WHERE id=$3',[resolved.customer_id,resolved.vehicle_id,caseRow.rows[0].id]);
    await client.query("INSERT INTO messages(tenant_id,conversation_id,direction,role,content_jsonb) VALUES($1,$2,'inbound','customer',$3)",[tenantId,callRow.conversation_id,JSON.stringify({text:input.confirmationTranscript,explicitConfirmation:true})]);
    if(normalize(resolved.display_name)!==normalize(input.customerName)) await client.query("INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref) VALUES($1,'voice_agent',$2,'identity_name_variant_observed','customer',$3,$4,$5)",[tenantId,input.provider,resolved.customer_id,correlationId,`plate:${hash(input.plate)}`]);
    return { unresolved:false as const,callId:callRow.id,conversationId:callRow.conversation_id,caseId:caseRow.rows[0].id,customerId:resolved.customer_id,vehicleId:resolved.vehicle_id };
  });
  if(chain.unresolved) return { ok:false,code:'IDENTITY_AMBIGUOUS',safeMessage:'No puedo verificar con seguridad cliente y vehículo; dejaré el caso para atención humana.',...chain };
  const policy=evaluatePolicy({operatingMode:'pilot_supervised',policyVersion:'pilot-v1'},{requestedLevel:'customer_confirmed',customerConfirmationRecorded:true,requiredFactsVerified:true,risk:'low'});
  if(policy.effect!=='allow') return {ok:false,code:'POLICY_BLOCKED',safeMessage:'Necesito revisión humana antes de crear la cita.'};
  const context:TenantContext={tenantId:tenantId as TenantContext['tenantId'],workshopId:workshopId as TenantContext['workshopId'],correlationId,actor:{type:'voice_agent',id:input.provider}};
  const receipt=await createAppointmentTransactional(pool,context,{slotToken:input.slotToken,caseId:chain.caseId,customerId:chain.customerId,vehicleId:chain.vehicleId,serviceRequest:{intent:input.serviceIntent,symptoms:input.symptoms,notes:input.notes,estimatedDurationMinutes:input.estimatedDurationMinutes,capacityRequirements:[{resourceType:'mechanic',quantity:1}]},confirmationEvidenceRef:`voice:${chain.callId}:explicit-confirmation`,idempotencyKey:`voice-appointment:${input.provider}:${input.providerCallId}`});
  return {ok:receipt.outcome==='succeeded'&&Boolean(receipt.evidenceRef),code:'APPOINTMENT_CREATED',safeMessage:'La cita ha quedado confirmada.',receipt,callId:chain.callId,conversationId:chain.conversationId,caseId:chain.caseId};
}
