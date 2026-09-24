import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type pg from 'pg';
import { inTenantTransaction } from '../../persistence/pool.js';
import { evaluatePolicy } from '../policy/pilot-mode.js';
import { createAppointmentTransactional } from '../scheduling/postgres-scheduling.js';
import type { TenantContext } from '../../domain/ids.js';
import { assertTenantMutationAtPool, assertTenantOperation } from '../tenant-control/tenant-control.js';
import type { PiiProtection } from '../../security/pii-protection.js';
import { normalizeSpanishPlate } from '../../security/pii-protection.js';

type VerifiedIdentity = {
  resolution: 'verified'; vehicleId: string; customerId: string;
  displayNameCiphertext: Buffer; displayNameNonce: Buffer; displayNameAuthTag: Buffer; displayNameKeyId: string;
};
type AppointmentIdentityResolution = VerifiedIdentity | {
  resolution: 'provisional_new' | 'provisional_ambiguous'; customerName: string; plate: string;
};

export const appointmentToolInput = z.object({
  providerCallId: z.string().min(1),
  customerName: z.string().min(2).max(200), plate: z.string().min(4).max(20), serviceIntent: z.enum(['inspection','oil_service','brakes_or_noise','generic_fault']),
  symptoms: z.array(z.string().min(1).max(500)).min(1).max(10), notes: z.string().max(2000).optional(), estimatedDurationMinutes: z.number().int().min(15).max(480),
  slotToken: z.string().min(1).max(200), explicitConfirmation: z.literal(true), confirmationTranscript: z.string().min(3).max(1000),
});
export type AppointmentToolInput = z.infer<typeof appointmentToolInput>;
const normalizeName = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const tenantPolicySchema = z.object({
  operating_mode: z.enum(['standard', 'pilot_supervised']),
  policy_version: z.string().min(1).max(200),
});
const caseRiskSchema = z.enum(['low', 'medium', 'high']);

async function classifyAppointmentIdentity(
  client: pg.PoolClient,
  pii: PiiProtection,
  tenantId: string,
  customerName: string,
  plate: string,
): Promise<AppointmentIdentityResolution> {
  const normalizedPlate = normalizeSpanishPlate(plate);
  const plateDigests = pii.lookupDigests(tenantId, 'vehicle.plate', normalizedPlate).map((item) => item.digest);
  const vehicles = await client.query<{ id: string }>(
    `SELECT id FROM vehicles
     WHERE tenant_id=$1 AND pii_migration_state='protected' AND plate_lookup_digest=ANY($2::text[])`,
    [tenantId, plateDigests],
  );
  if (vehicles.rowCount === 0) return { resolution: 'provisional_new', customerName, plate: normalizedPlate };

  const identity = await client.query<{
    vehicle_id: string; customer_id: string; display_name_ciphertext: Buffer; display_name_nonce: Buffer;
    display_name_auth_tag: Buffer; display_name_key_id: string;
  }>(
    `SELECT v.id vehicle_id,c.id customer_id,c.display_name_ciphertext,c.display_name_nonce,
       c.display_name_auth_tag,c.display_name_key_id
     FROM vehicles v
     JOIN customer_vehicle_roles r ON r.vehicle_id=v.id AND r.tenant_id=v.tenant_id
       AND r.verification_status='verified'
     JOIN customers c ON c.id=r.customer_id AND c.tenant_id=v.tenant_id
     WHERE v.tenant_id=$1 AND v.pii_migration_state='protected'
       AND c.pii_migration_state='protected' AND v.plate_lookup_digest=ANY($2::text[])`,
    [tenantId, plateDigests],
  );
  if (vehicles.rowCount !== 1 || identity.rowCount !== 1) {
    return { resolution: 'provisional_ambiguous', customerName, plate: normalizedPlate };
  }
  const resolved = identity.rows[0];
  return {
    resolution: 'verified', vehicleId: resolved.vehicle_id, customerId: resolved.customer_id,
    displayNameCiphertext: resolved.display_name_ciphertext, displayNameNonce: resolved.display_name_nonce,
    displayNameAuthTag: resolved.display_name_auth_tag, displayNameKeyId: resolved.display_name_key_id,
  };
}

export async function resolveVerifiedIdentityForProtectedAccess(
  client: pg.PoolClient,
  pii: PiiProtection,
  tenantId: string,
  customerName: string,
  plate: string,
): Promise<{ customerId: string; vehicleId: string }> {
  const identity = await classifyAppointmentIdentity(client, pii, tenantId, customerName, plate);
  if (identity.resolution !== 'verified') throw new Error('IDENTITY_AMBIGUOUS');
  return { customerId: identity.customerId, vehicleId: identity.vehicleId };
}

export async function executeAppointmentTool(pool: pg.Pool, context: TenantContext, raw: unknown, pii: PiiProtection) {
  const input = appointmentToolInput.parse(raw);
  const tenantId = context.tenantId;
  const workshopId = context.workshopId;
  const provider = 'elevenlabs';
  const correlationId = `voice:${input.providerCallId}`;
  await assertTenantMutationAtPool(pool, context);
  const chain = await inTenantTransaction(pool, tenantId, async (client) => {
    await assertTenantOperation(client, tenantId, 'conversation_start', 'share');
    const policySettings = await client.query<{ operating_mode: string; policy_version: string }>(
      'SELECT operating_mode,policy_version FROM tenants WHERE id=$1', [tenantId],
    );
    if (policySettings.rowCount !== 1) throw new Error('TENANT_POLICY_UNAVAILABLE');
    const effectivePolicy = tenantPolicySchema.parse(policySettings.rows[0]);
    let call = await client.query<{id:string;conversation_id:string}>('SELECT id,conversation_id FROM calls WHERE tenant_id=$1 AND provider=$2 AND provider_call_id=$3',[tenantId,provider,input.providerCallId]);
    if (!call.rowCount) {
      const conversationId=randomUUID(); const callId=randomUUID();
      await client.query('INSERT INTO conversations(id,tenant_id,workshop_id) VALUES($1,$2,$3)',[conversationId,tenantId,workshopId]);
      await client.query("INSERT INTO calls(id,tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,$3,$4,$5,'active')",[callId,tenantId,conversationId,provider,input.providerCallId]);
      call={rows:[{id:callId,conversation_id:conversationId}],rowCount:1,command:'',oid:0,fields:[]};
    }
    const callRow=call.rows[0];
    let caseRow=await client.query<{id:string;risk_level:string}>('SELECT id,risk_level FROM reception_cases WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,callRow.conversation_id]);
    if(!caseRow.rowCount){ caseRow=await client.query("INSERT INTO reception_cases(tenant_id,conversation_id,intent,status) VALUES($1,$2,$3,'ready_to_decide') RETURNING id,risk_level",[tenantId,callRow.conversation_id,input.serviceIntent]); }
    const identity = await classifyAppointmentIdentity(client, pii, tenantId, input.customerName, input.plate);
    if (identity.resolution === 'verified') {
      const storedName = pii.reveal(tenantId, 'customer.display_name', {
        ciphertext: identity.displayNameCiphertext, nonce: identity.displayNameNonce,
        authTag: identity.displayNameAuthTag, keyId: identity.displayNameKeyId,
      });
      await client.query(
        "UPDATE reception_cases SET customer_id=$1,vehicle_id=$2,status='executing' WHERE id=$3",
        [identity.customerId, identity.vehicleId, caseRow.rows[0].id],
      );
      if(normalizeName(storedName)!==normalizeName(input.customerName)) await client.query("INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref) VALUES($1,'voice_agent',$2,'identity_name_variant_observed','customer',$3,$4,$5)",[tenantId,context.actor.id,identity.customerId,correlationId,`vehicle:${identity.vehicleId}`]);
    } else {
      await client.query(
        "UPDATE reception_cases SET customer_id=NULL,vehicle_id=NULL,status='executing' WHERE id=$1",
        [caseRow.rows[0].id],
      );
    }
    const protectedMessage = pii.protect(tenantId, 'message.content', JSON.stringify({ text: input.confirmationTranscript }));
    await client.query(`INSERT INTO messages
      (tenant_id,conversation_id,direction,role,content_legacy_jsonb,content_metadata_jsonb,
       content_ciphertext,content_nonce,content_auth_tag,content_key_id,pii_migration_state)
      VALUES($1,$2,'inbound','customer',NULL,$3,$4,$5,$6,$7,'protected')`,
    [tenantId,callRow.conversation_id,JSON.stringify({ kind:'explicit_confirmation', explicitConfirmation:true }),
      protectedMessage.ciphertext,protectedMessage.nonce,protectedMessage.authTag,protectedMessage.keyId]);
    await client.query(
      `INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
       VALUES($1,'voice_agent',$2,'identity_resolution_classified','reception_case',$3,$4,$5)`,
      [tenantId, context.actor.id, caseRow.rows[0].id, correlationId, `identity:${identity.resolution}`],
    );
    const policy=evaluatePolicy(
      { operatingMode: effectivePolicy.operating_mode, policyVersion: effectivePolicy.policy_version },
      { requestedLevel:'customer_confirmed',customerConfirmationRecorded:input.explicitConfirmation,
        requiredFactsVerified:true,requiresVerifiedIdentity:false,identityVerified:identity.resolution==='verified',
        risk:caseRiskSchema.parse(caseRow.rows[0].risk_level) },
    );
    await client.query(
      `INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
       VALUES($1,'voice_agent',$2,'policy_evaluated','reception_case',$3,$4,$5)`,
      [tenantId,context.actor.id,caseRow.rows[0].id,correlationId,`policy:${policy.policyVersion}:${policy.effect}`],
    );
    return { callId:callRow.id,conversationId:callRow.conversation_id,caseId:caseRow.rows[0].id,identity,policy };
  });
  if(chain.policy.effect!=='allow') return {ok:false,code:'POLICY_BLOCKED',safeMessage:'Necesito revisión humana antes de crear la cita.'};
  const actionContext:TenantContext={...context,correlationId};
  const identity = chain.identity.resolution === 'verified'
    ? { resolution: 'verified' as const, customerId: chain.identity.customerId, vehicleId: chain.identity.vehicleId }
    : { resolution: chain.identity.resolution, customerName: chain.identity.customerName, plate: chain.identity.plate };
  const receipt=await createAppointmentTransactional(pool,actionContext,{slotToken:input.slotToken,caseId:chain.caseId,identity,serviceRequest:{intent:input.serviceIntent,symptoms:input.symptoms,notes:input.notes,estimatedDurationMinutes:input.estimatedDurationMinutes,capacityRequirements:[{resourceType:'mechanic',quantity:1}]},confirmationEvidenceRef:`voice:${chain.callId}:explicit-confirmation`,idempotencyKey:`voice-appointment:${provider}:${input.providerCallId}`},pii);
  return {ok:receipt.outcome==='succeeded'&&Boolean(receipt.evidenceRef),code:'APPOINTMENT_CREATED',safeMessage:'La cita ha quedado confirmada.',receipt,callId:chain.callId,conversationId:chain.conversationId,caseId:chain.caseId};
}
