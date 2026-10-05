import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), workshop: randomUUID(), endpoint: randomUUID(), principal: randomUUID() };
const agent = `agent-${randomUUID()}`;
const secret = `secret-${randomUUID()}`;
const auth = { authorization: `Bearer ${secret}` };
const app = buildApi(pool, { piiProtection: pii, providerIngress: {
  publicApiBaseUrl: 'https://api.bibendia.test',
  elevenLabsTool: { servicePrincipalId: ids.principal, externalAccountId: agent, secret },
} });

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Reception provider','pilot')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Reception provider')", [ids.workshop, ids.tenant]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'reception-tools')", [ids.endpoint, ids.tenant, ids.workshop, agent]);
  });
  await pool.query("INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES($1,'elevenlabs','voice_provider',$2,'secret://reception')", [ids.principal, agent]);
  await pool.query('INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4)', [ids.principal, ids.tenant, ids.workshop, ids.endpoint]);
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('Reception → ElevenLabs real PostgreSQL gate', () => {
  it('binds provider provenance and deterministically replays concurrent exact requests', async () => {
    const payload = { providerConversationId: `case-${randomUUID()}`, requestId: `request-${randomUUID()}`,
      callerType: 'CUSTOMER', category: 'appointment_issue', summary: 'Necesito cambiar la cita', priority: 'HIGH' };
    const [left, right] = await Promise.all([
      app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-reception-case', headers: auth, payload }),
      app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-reception-case', headers: auth, payload }),
    ]);
    expect([left.statusCode, right.statusCode].sort()).toEqual([200, 201]);
    expect(left.json().case.id).toBe(right.json().case.id);
    expect([left.json().replay, right.json().replay].sort()).toEqual([false, true]);
    const persisted = await pool.query('SELECT provenance,idempotency_key FROM reception_cases WHERE id=$1', [left.json().case.id]);
    expect(persisted.rows[0].provenance).toMatchObject({ source: 'elevenlabs_tool', provider: 'elevenlabs', servicePrincipalId: ids.principal, requestId: payload.requestId });
    expect(persisted.rows[0].idempotency_key).toContain(ids.principal);
  });

  it('fails closed on payload conflict and persists callback only before acknowledging success', async () => {
    const base = { providerConversationId: `callback-${randomUUID()}`, requestId: `request-${randomUUID()}`,
      callerType: 'CUSTOMER', summary: 'Por favor, llamadme', contactContext: { preferredTime: '17:00' } };
    const created = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/request-human-contact', headers: auth, payload: base });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ ok: true, code: 'HUMAN_CONTACT_REQUESTED' });
    const persisted = await pool.query('SELECT category,provider_conversation_id FROM reception_cases WHERE id=$1', [created.json().case.id]);
    expect(persisted.rows[0]).toEqual({ category: 'callback_request', provider_conversation_id: base.providerConversationId });
    const conflict = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/request-human-contact', headers: auth,
      payload: { ...base, summary: 'Contenido cambiado' } });
    expect(conflict.statusCode).toBe(403);
    expect(conflict.json().error).toBe('REPLAY_CONFLICT');
    expect((await pool.query('SELECT count(*)::int count FROM reception_cases WHERE provider_conversation_id=$1', [base.providerConversationId])).rows[0].count).toBe(1);
  });

  it('rejects an unbound provider before any case persistence', async () => {
    await pool.query("UPDATE provider_bindings SET status='suspended' WHERE service_principal_id=$1", [ids.principal]);
    const before = (await pool.query('SELECT count(*)::int count FROM reception_cases WHERE tenant_id=$1', [ids.tenant])).rows[0].count;
    const response = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-reception-case', headers: auth,
      payload: { providerConversationId: `blocked-${randomUUID()}`, requestId: `request-${randomUUID()}`,
        callerType: 'OTHER', category: 'other', summary: 'No debe persistir' } });
    expect(response.statusCode).toBe(403);
    expect((await pool.query('SELECT count(*)::int count FROM reception_cases WHERE tenant_id=$1', [ids.tenant])).rows[0].count).toBe(before);
    await pool.query("UPDATE provider_bindings SET status='active' WHERE service_principal_id=$1", [ids.principal]);
  });
});
