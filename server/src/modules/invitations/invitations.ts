import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { PiiProtection } from '../../security/pii-protection.js';
import type { VerifiedOidcIdentity } from '../../auth/oidc-authentication-adapter.js';

export const invitationEvent = 'workshop_invitation.email_requested';
export const hashInvitationToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const normalizeInvitationEmail = (email: string) => email.trim().toLowerCase();
export class InvitationError extends Error { constructor(readonly code: 'INVITATION_INVALID'|'INVITATION_DELIVERY_DISABLED') { super(code); } }
export type InvitationDelivery = { enabled: boolean; workshopOrigin: string };
export function invitationDeliveryFromEnvironment(env: NodeJS.ProcessEnv = process.env): InvitationDelivery {
  const enabled = env.WORKSHOP_INVITATION_EMAIL_ENABLED === 'true';
  const origin = env.WORKSHOP_ORIGIN ?? 'https://app.bibendia.com';
  const url = new URL(origin);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(env.NODE_ENV === 'test' && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname)))) throw new Error('INVITATION_ORIGIN_INVALID');
  if (enabled && (!env.WORKER_SMTP_HOST || !env.WORKER_SMTP_SENDER)) throw new Error('INVITATION_SMTP_NOT_CONFIGURED');
  return { enabled, workshopOrigin: url.origin };
}
export async function rotateInvitation(c: pg.PoolClient, input: {id:string;tenantId:string;email:string;role:string;actor:string;expiresInHours:number;correlationId:string}, pii:PiiProtection, delivery:InvitationDelivery, resend=false) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now()+input.expiresInHours*3600_000);
  if (resend) {
    const changed = await c.query(`UPDATE workshop_invitations SET token_hash=$3,expires_at=$4,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status='pending' RETURNING id`,[input.tenantId,input.id,hashInvitationToken(token),expiresAt]);
    if(!changed.rowCount) throw new InvitationError('INVITATION_INVALID');
    // Superseded queued mail cannot produce an accidentally live old URL.
    await c.query(`UPDATE outbox_events SET delivery_state='dead_letter',dead_lettered_at=now(),last_error_code='INVITATION_ROTATED' WHERE tenant_id=$1 AND event_type=$2 AND aggregate_id=$3 AND delivery_state IN ('not_attempted','failed_safe_to_retry')`,[input.tenantId,invitationEvent,input.id]);
  } else {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,161803))",[input.tenantId]);
    const digests=pii.lookupDigests(input.tenantId,'invitation.recipient',input.email).map(d=>`${d.keyId}:${d.digest}`);
    const duplicate=await c.query("SELECT 1 FROM workshop_invitations WHERE tenant_id=$1 AND status='pending' AND (email_digest_key_id||':'||email_digest)=ANY($2::text[])",[input.tenantId,digests]);
    if(duplicate.rowCount)throw new InvitationError('INVITATION_INVALID');
    const digest=pii.activeLookupDigest(input.tenantId,'invitation.recipient',input.email);
    await c.query(`INSERT INTO workshop_invitations(id,tenant_id,email_encrypted,email_digest,email_digest_key_id,role,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[input.id,input.tenantId,encryptInvitation(pii,input.id,'invitation.recipient',input.email),digest.digest,digest.keyId,input.role,hashInvitationToken(token),expiresAt,input.actor]);
  }
  let eventId: number|null = null;
  if(delivery.enabled) {
    // Fragment prevents the token appearing in HTTP access logs/referrers. The UI POSTs it to /auth/invitation/start.
    const url = `${delivery.workshopOrigin}/auth/invitation#token=${token}`;
    const protectedValue = pii.protect(input.id,'invitation.email',JSON.stringify({to:input.email,url}));
    const encrypted = {ciphertext:protectedValue.ciphertext.toString('base64'),nonce:protectedValue.nonce.toString('base64'),authTag:protectedValue.authTag.toString('base64'),keyId:protectedValue.keyId};
    eventId = (await c.query(`INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb,external_idempotency_key,correlation_id,effect_valid_until) VALUES($1,'invitation',$2,$3,$4,$5,$6,$7) RETURNING id`,[input.tenantId,input.id,invitationEvent,{encrypted},`invitation:${input.id}:${randomBytes(12).toString('hex')}`,input.correlationId,expiresAt])).rows[0].id;
  }
  await c.query('UPDATE workshop_invitations SET delivery_event_id=$3 WHERE tenant_id=$1 AND id=$2',[input.tenantId,input.id,eventId]);
  return {id:input.id,tenantId:input.tenantId,role:input.role,expiresAt:expiresAt.toISOString(),status:'pending',delivery:{state:delivery.enabled?'queued':'disabled',eventId}};
}
export async function redeemInvitation(pool:pg.Pool, token:string, identity:VerifiedOidcIdentity, correlationId:string,pii:PiiProtection) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(token) || !identity.email || !identity.emailVerified) throw new InvitationError('INVITATION_INVALID');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');await c.query('SET LOCAL ROLE bibendia_api');
    const tenant=(await c.query('SELECT invitation_tenant($1) AS id',[hashInvitationToken(token)])).rows[0]?.id;
    if(!tenant)throw new InvitationError('INVITATION_INVALID');
    const digests=pii.lookupDigests(tenant,'invitation.recipient',normalizeInvitationEmail(identity.email)).map(d=>`${d.keyId}:${d.digest}`);
    const r=await c.query<{user_id:string;tenant_id:string}>(`SELECT * FROM redeem_workshop_invitation($1,$2,$3,$4,$5,$6,$7)`,[hashInvitationToken(token),digests,identity.emailVerified,identity.issuer,identity.subject,identity.userId??null,correlationId]);
    if(!r.rowCount) throw new InvitationError('INVITATION_INVALID');
    await c.query('COMMIT');return r.rows[0];
  } catch {await c.query('ROLLBACK');throw new InvitationError('INVITATION_INVALID');} finally{c.release();}
}

export function encryptInvitation(pii:PiiProtection,id:string,field:string,plaintext:string){const v=pii.protect(id,field,plaintext);return {ciphertext:v.ciphertext.toString('base64'),nonce:v.nonce.toString('base64'),authTag:v.authTag.toString('base64'),keyId:v.keyId};}
export function revealInvitation(pii:PiiProtection,id:string,field:string,v:Record<string,string>){return pii.reveal(id,field,{ciphertext:Buffer.from(v.ciphertext,'base64'),nonce:Buffer.from(v.nonce,'base64'),authTag:Buffer.from(v.authTag,'base64'),keyId:v.keyId});}
