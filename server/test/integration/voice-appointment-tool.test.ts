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
const slotToken = `slot-${randomUUID()}`;
const baseInput = {
  customerName: 'Aitor Echeverría', plate: '1489 KMR',
  serviceIntent: 'oil_service' as const, symptoms: ['cambio de aceite'], estimatedDurationMinutes: 60, slotToken,
  explicitConfirmation: true as const, confirmationTranscript: 'Sí, confirmo explícitamente la cita.',
};
const context: TenantContext = {
  tenantId: ids.tenant as TenantContext['tenantId'], workshopId: ids.workshop as TenantContext['workshopId'],
  correlationId: 'voice-test', actor: { type: 'voice_agent', id: accountId },
};

beforeAll(async () => {
  await pool.query("INSERT INTO tenants (id,name,operating_mode,lifecycle_status) VALUES ($1,'Voice tool tenant','pilot_supervised','pilot')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops (id,tenant_id,name) VALUES ($1,$2,'Voice workshop')", [ids.workshop, ids.tenant]);
    await client.query("INSERT INTO channel_endpoints (tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES ($1,$2,'elevenlabs',$3,'web-gate')", [ids.tenant, ids.workshop, accountId]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Aitor Etxeberria' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1489 KMR' });
    await client.query('INSERT INTO customer_vehicle_roles (tenant_id,customer_id,vehicle_id) VALUES ($1,$2,$3)', [ids.tenant, ids.customer, ids.vehicle]);
    await client.query("INSERT INTO slot_holds (tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at) VALUES ($1,$2,$3,now()+interval '2 days',now()+interval '2 days 1 hour','[]',now()+interval '1 day')", [ids.tenant, ids.workshop, slotToken]);
  });
});

afterAll(async () => { await pool.end(); });

describe('voice appointment tool identity and replay safety', () => {
  it('uses a strong plate match despite a name variant and replays to the same appointment', async () => {
    const providerCallId = `call-${randomUUID()}`;
    const first = await executeAppointmentTool(pool, context, { ...baseInput, providerCallId }, pii);
    const replay = await executeAppointmentTool(pool, context, { ...baseInput, providerCallId }, pii);
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok || !first.receipt || !replay.receipt) throw new Error('Expected succeeded receipts');
    expect(replay.receipt.value?.id).toBe(first.receipt.value?.id);
    expect(first.receipt.value?.customerId).toBe(ids.customer);
    expect(first.receipt.value?.vehicleId).toBe(ids.vehicle);

    const counts = await inTenantTransaction(pool, ids.tenant, async (client) => Promise.all([
      client.query('SELECT count(*)::int count FROM appointments WHERE idempotency_key=$1', [`voice-appointment:elevenlabs:${providerCallId}`]),
      client.query('SELECT count(*)::int count FROM action_intents WHERE idempotency_key=$1', [`voice-appointment:elevenlabs:${providerCallId}`]),
    ]));
    expect(counts.map((result) => result.rows[0].count)).toEqual([1, 1]);

    const minimized = await inTenantTransaction(pool, ids.tenant, async (client) => ({
      messages: (await client.query('SELECT content_legacy_jsonb,content_metadata_jsonb,content_ciphertext FROM messages')).rows,
      intents: (await client.query('SELECT input_jsonb FROM action_intents WHERE idempotency_key=$1', [`voice-appointment:elevenlabs:${providerCallId}`])).rows,
    }));
    const serialized = JSON.stringify(minimized);
    expect(serialized).not.toContain(baseInput.confirmationTranscript);
    expect(serialized).not.toContain(baseInput.symptoms[0]);
    expect(minimized.messages[0]).toMatchObject({ content_legacy_jsonb: null, content_metadata_jsonb: { kind: 'explicit_confirmation', explicitConfirmation: true } });
  });

  it('does not guess or create a customer when no strong identifier resolves', async () => {
    const before = await inTenantTransaction(pool, ids.tenant, async (client) => client.query('SELECT count(*)::int count FROM customers'));
    const result = await executeAppointmentTool(pool, context, { ...baseInput, providerCallId: `call-${randomUUID()}`, plate: '0000 ZZZ' }, pii);
    const after = await inTenantTransaction(pool, ids.tenant, async (client) => client.query('SELECT count(*)::int count FROM customers'));
    expect(result).toMatchObject({ ok: false, code: 'IDENTITY_AMBIGUOUS' });
    expect(result.safeMessage).toContain('atención humana');
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });
});
