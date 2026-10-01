import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeAppointmentTool } from '../../src/modules/agent-core/appointment-tool.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import type { TenantContext } from '../../src/domain/ids.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool();
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), workshop: randomUUID(), customer: randomUUID(), vehicle: randomUUID() };
const accountId = `agent-${randomUUID()}`;
const context: TenantContext = { tenantId: ids.tenant as TenantContext['tenantId'], workshopId: ids.workshop as TenantContext['workshopId'], correlationId: 'voice-v2', actor: { type: 'voice_agent', id: accountId } };

async function prepare() {
  const providerConversationId = `call-${randomUUID()}`;
  const token = randomUUID();
  const slotToken = `slot-${randomUUID()}`;
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    const conversation = await client.query<{ id: string }>('INSERT INTO conversations(tenant_id,workshop_id) VALUES($1,$2) RETURNING id', [ids.tenant, ids.workshop]);
    const receptionCase = await client.query<{ id: string }>("INSERT INTO reception_cases(tenant_id,conversation_id,customer_id,vehicle_id,intent,status) VALUES($1,$2,$3,$4,'oil_service','ready_to_decide') RETURNING id", [ids.tenant, conversation.rows[0].id, ids.customer, ids.vehicle]);
    await client.query("INSERT INTO calls(tenant_id,conversation_id,provider,provider_call_id,status) VALUES($1,$2,'elevenlabs',$3,'active')", [ids.tenant, conversation.rows[0].id, providerConversationId]);
    await client.query("INSERT INTO action_intents(tenant_id,case_id,tool_name,status,idempotency_key,input_jsonb,requested_by_type) VALUES($1,$2,'reception_context_v2','ready',$3,$4,'voice_agent')", [ids.tenant, receptionCase.rows[0].id, `reception-context:${token}`, JSON.stringify({ token, caseId: receptionCase.rows[0].id, conversationId: conversation.rows[0].id, providerConversationId, tenantId: ids.tenant, workshopId: ids.workshop, servicePrincipalId: accountId, provider: 'elevenlabs', callerEvidenceFingerprint: 'test', customerId: ids.customer, vehicleId: ids.vehicle, relationshipVerification: 'provisional', callerAssurance: 'provider_supplied', expiresAt: new Date(Date.now() + 900_000).toISOString() })]);
    await client.query("INSERT INTO slot_holds(tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at) VALUES($1,$2,$3,now()+interval '2 days',now()+interval '2 days 1 hour','[{\"resourceType\":\"mechanic\",\"quantity\":1}]',now()+interval '1 day')", [ids.tenant, ids.workshop, slotToken]);
  });
  return { providerConversationId, token, slotToken };
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,operating_mode,lifecycle_status) VALUES($1,'Voice V2','pilot_supervised','pilot')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Voice workshop')", [ids.workshop, ids.tenant]);
    await client.query("INSERT INTO channel_endpoints(tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,'elevenlabs',$3,'web-gate')", [ids.tenant, ids.workshop, accountId]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Aitor Etxeberria' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1489 KMR' });
    await client.query("INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id,verification_status) VALUES($1,$2,$3,'provisional')", [ids.tenant, ids.customer, ids.vehicle]);
  });
});
afterAll(async () => { await pool.end(); });

describe('voice appointment tool canonical context', () => {
  it('preserves canonical provisional identities and replays without duplication', async () => {
    const prepared = await prepare();
    const idempotencyKey = `create-${randomUUID()}`;
    const input = { providerConversationId: prepared.providerConversationId, requestId: `req-${randomUUID()}`, receptionContextToken: prepared.token, idempotencyKey, serviceIntent: 'oil_service' as const, symptoms: ['maintenance due'], estimatedDurationMinutes: 60, slotToken: prepared.slotToken, explicitConfirmation: true as const, confirmationTranscript: 'Sí, confirmo' };
    const first = await executeAppointmentTool(pool, context, input, pii);
    const replay = await executeAppointmentTool(pool, context, { ...input, requestId: `req-${randomUUID()}` }, pii);
    expect(first).toMatchObject({ ok: true, receipt: { value: { customerId: ids.customer, vehicleId: ids.vehicle } } });
    expect(replay.receipt?.value?.id).toBe(first.receipt?.value?.id);
    const state = await pool.query('SELECT a.customer_id,a.vehicle_id,r.verification_status FROM appointments a JOIN customer_vehicle_roles r ON r.tenant_id=a.tenant_id AND r.customer_id=a.customer_id AND r.vehicle_id=a.vehicle_id WHERE a.id=$1', [first.receipt?.value?.id]);
    expect(state.rows[0]).toMatchObject({ customer_id: ids.customer, vehicle_id: ids.vehicle, verification_status: 'provisional' });
  });

  it('rejects an invented or conversation-mismatched context token', async () => {
    const prepared = await prepare();
    await expect(executeAppointmentTool(pool, context, { providerConversationId: prepared.providerConversationId, requestId: randomUUID(), receptionContextToken: randomUUID(), idempotencyKey: randomUUID(), serviceIntent: 'oil_service', symptoms: ['maintenance due'], estimatedDurationMinutes: 60, slotToken: prepared.slotToken, explicitConfirmation: true, confirmationTranscript: 'Sí' }, pii)).rejects.toThrow('RECEPTION_CONTEXT_INVALID');
  });
});
