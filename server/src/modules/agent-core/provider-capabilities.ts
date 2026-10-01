import type pg from 'pg';
import type { TenantContext } from '../../domain/ids.js';

export type ProviderCapabilityBinding = {
  tenantId: string; workshopId: string; servicePrincipalId: string; provider: 'elevenlabs';
  providerConversationId: string; operation: 'find-slots' | 'hold-slot';
  serviceIntent: string | null; durationMinutes: number; capacityRequirements: unknown;
  window: { from: string; to: string }; expiresAt: string; parentToken?: string;
};

export class ProviderCapabilityError extends Error {
  constructor(readonly code: string) { super(code); }
}

async function capabilityCase(client: pg.PoolClient, context: TenantContext, providerConversationId: string) {
  let call = await client.query<{ conversation_id: string }>(
    "SELECT conversation_id FROM calls WHERE tenant_id=$1 AND provider='elevenlabs' AND provider_call_id=$2",
    [context.tenantId, providerConversationId]);
  if (!call.rowCount) {
    const conversation = await client.query<{ id: string }>(
      'INSERT INTO conversations(tenant_id,workshop_id) VALUES($1,$2) RETURNING id',
      [context.tenantId, context.workshopId]);
    call = await client.query<{ conversation_id: string }>(
      "INSERT INTO calls(tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,'elevenlabs',$3,'active') RETURNING conversation_id",
      [context.tenantId, conversation.rows[0].id, providerConversationId]);
  }
  let reception = await client.query<{ id: string }>(
    'SELECT id FROM reception_cases WHERE tenant_id=$1 AND conversation_id=$2',
    [context.tenantId, call.rows[0].conversation_id]);
  if (!reception.rowCount) reception = await client.query<{ id: string }>(
    "INSERT INTO reception_cases(tenant_id,conversation_id,intent,status) VALUES($1,$2,'scheduling','executing') RETURNING id",
    [context.tenantId, call.rows[0].conversation_id]);
  return reception.rows[0].id;
}

export async function issueProviderCapability(client: pg.PoolClient, context: TenantContext, token: string,
  binding: Omit<ProviderCapabilityBinding, 'tenantId' | 'workshopId' | 'servicePrincipalId' | 'provider'>) {
  const value: ProviderCapabilityBinding = { tenantId: context.tenantId, workshopId: context.workshopId,
    servicePrincipalId: context.actor.id, provider: 'elevenlabs', ...binding };
  const caseId = await capabilityCase(client, context, binding.providerConversationId);
  await client.query(`INSERT INTO action_intents
    (tenant_id,case_id,tool_name,input_jsonb,status,idempotency_key,requested_by_type)
    VALUES($1,$2,'provider_capability_v3',$3,'ready',$4,$5)
    ON CONFLICT (tenant_id,idempotency_key) DO NOTHING`,
  [context.tenantId, caseId, JSON.stringify(value), `provider-capability:${token}`, context.actor.type]);
  return value;
}

export async function loadProviderCapability(client: pg.PoolClient, context: TenantContext, token: string,
  providerConversationId: string, operation: ProviderCapabilityBinding['operation']) {
  const found = await client.query<{ id: string; input_jsonb: ProviderCapabilityBinding; status: string }>(`SELECT id,input_jsonb,status
    FROM action_intents WHERE tenant_id=$1 AND tool_name='provider_capability_v3' AND idempotency_key=$2 FOR UPDATE`,
  [context.tenantId, `provider-capability:${token}`]);
  if (found.rowCount !== 1) throw new ProviderCapabilityError('CAPABILITY_INVALID');
  const value = found.rows[0].input_jsonb;
  if (found.rows[0].status !== 'ready') throw new ProviderCapabilityError('CAPABILITY_CONSUMED');
  if (Date.parse(value.expiresAt) <= Date.now()) {
    await client.query("UPDATE action_intents SET status='expired' WHERE id=$1", [found.rows[0].id]);
    throw new ProviderCapabilityError('CAPABILITY_EXPIRED');
  }
  if (value.tenantId !== context.tenantId || value.workshopId !== context.workshopId
    || value.servicePrincipalId !== context.actor.id || value.provider !== 'elevenlabs'
    || value.providerConversationId !== providerConversationId || value.operation !== operation) {
    throw new ProviderCapabilityError('CAPABILITY_BINDING_MISMATCH');
  }
  return { id: found.rows[0].id, value };
}

export async function consumeProviderCapability(client: pg.PoolClient, id: string) {
  await client.query("UPDATE action_intents SET status='consumed' WHERE id=$1 AND status='ready'", [id]);
}
