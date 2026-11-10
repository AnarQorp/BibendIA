import type pg from 'pg';
import type { PiiProtection } from '../../security/pii-protection.js';
import { inTenantTransaction } from '../../persistence/pool.js';
import { hashInvitationToken, invitationEvent } from '../../modules/invitations/invitations.js';
import type { ClaimedOutboxEvent, EffectResult, OutboxEffectAdapter } from '../../worker/outbox.js';
import { escapeHtml, SmtpDeliveryError, type SmtpTransport } from './public-lead-smtp.js';
export class WorkshopInvitationSmtpAdapter implements OutboxEffectAdapter {
 constructor(private pool:pg.Pool,private pii:PiiProtection,private transport:(recipient:string)=>SmtpTransport,private sender:string){}
 async execute(event:ClaimedOutboxEvent,key:string,signal:AbortSignal):Promise<EffectResult>{
  if(event.event_type!==invitationEvent)return {outcome:'permanent_failure',code:'UNSUPPORTED_OUTBOX_EVENT'};
  let effectStarted=false;
  try{
   const value=event.payload_jsonb.encrypted as Record<string,string>;
   const secret=JSON.parse(this.pii.reveal(event.aggregate_id,'invitation.email',{ciphertext:Buffer.from(value.ciphertext,'base64'),nonce:Buffer.from(value.nonce,'base64'),authTag:Buffer.from(value.authTag,'base64'),keyId:value.keyId})) as {to:string;url:string};
   const token=new URLSearchParams(new URL(secret.url).hash.slice(1)).get('token')??'';
   const valid=await inTenantTransaction(this.pool,event.tenant_id,async c=>(await c.query(`SELECT 1 FROM workshop_invitations WHERE tenant_id=$1 AND id=$2 AND status='pending' AND expires_at>now() AND token_hash=$3`,[event.tenant_id,event.aggregate_id,hashInvitationToken(token)])).rowCount===1,'bibendia_worker');
   if(!valid)return {outcome:'permanent_failure',code:'INVITATION_OBSOLETE'};
   effectStarted=true;
   const sent=await this.transport(secret.to).send({from:this.sender,to:secret.to,subject:'Invitación a BibendIA',text:`Accede con tu email verificado para aceptar la invitación: ${secret.url}`,html:`<p>Accede con tu email verificado para aceptar la invitación.</p><a href="${escapeHtml(secret.url)}">Aceptar invitación</a>`},key,signal);
   return {outcome:'succeeded',receiptRef:sent.receiptRef,evidence:{provider:'smtp',status:'accepted'}};
  }catch(e){
   if(e instanceof SmtpDeliveryError)return e.classification==='transient'?{outcome:'failed_safe_to_retry',code:e.safeCode}:e.classification==='permanent'?{outcome:'permanent_failure',code:e.safeCode}:{outcome:'unknown_outcome',code:e.safeCode};
   return effectStarted?{outcome:'unknown_outcome',code:'SMTP_UNCLASSIFIED_FAILURE'}:{outcome:'permanent_failure',code:'INVITATION_PAYLOAD_UNAVAILABLE'};
  }
 }
}
