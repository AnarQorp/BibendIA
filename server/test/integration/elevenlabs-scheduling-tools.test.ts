import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), workshop: randomUUID(), endpoint: randomUUID(), principal: randomUUID(), customer: randomUUID(), vehicle: randomUUID() };
const agent = `agent-${randomUUID()}`;
const secret = `secret-${randomUUID()}`;
const auth = { authorization: `Bearer ${secret}` };
const app = buildApi(pool, { piiProtection: pii, providerIngress: {
  publicApiBaseUrl: 'https://api.bibendia.test',
  elevenLabsTool: { servicePrincipalId: ids.principal, externalAccountId: agent, secret },
} });
const openingHours = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index + 1), [{ start: '00:00', end: '23:59' }]]));

function window() {
  const from = new Date(Date.now() + 7 * 86_400_000);
  from.setUTCMinutes(Math.ceil(from.getUTCMinutes() / 15) * 15, 0, 0);
  return { windowFrom: from.toISOString(), windowTo: new Date(from.getTime() + 4 * 3_600_000).toISOString() };
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status,operating_mode,policy_version) VALUES($1,'VS02.2','pilot','pilot_supervised','tenant-policy-v2')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours) VALUES($1,$2,'VS02.2 workshop','Europe/Madrid',$3)", [ids.workshop, ids.tenant, JSON.stringify(openingHours)]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'agent-binding')", [ids.endpoint, ids.tenant, ids.workshop, agent]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Aitor Etxeberria' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1489 KMR' });
    await client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)', [ids.tenant, ids.customer, ids.vehicle]);
  });
  await pool.query("INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES($1,'elevenlabs','voice_provider',$2,'secret://test')", [ids.principal, agent]);
  await pool.query('INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4)', [ids.principal, ids.tenant, ids.workshop, ids.endpoint]);
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('VS02.2 authenticated ElevenLabs scheduling tools', () => {
  it('runs find -> hold -> explicit-confirmed create and never accepts body authority', async () => {
    const providerCallId = `call-${randomUUID()}`;
    const findBody = { providerCallId, requestId: `find-${randomUUID()}`, ...window(), durationMinutes: 60, limit: 1 };
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', payload: findBody })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { ...findBody, tenantId: randomUUID(), workshopId: randomUUID() } })).statusCode).toBe(400);
    const found = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth, payload: findBody });
    expect(found.statusCode).toBe(200);
    expect(found.json().options[0]).toMatchObject({ timezone: 'Europe/Madrid' });
    const candidateId = found.json().options[0].candidateId as string;
    const findReplay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth, payload: findBody });
    expect(findReplay.json()).toMatchObject({ disposition: 'duplicate' });
    expect(findReplay.json().options[0].candidateId).toBe(candidateId);
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { ...findBody, durationMinutes: 75 } })).statusCode).toBe(403);
    const holdBody = { providerCallId, requestId: `hold-${randomUUID()}`, candidateId };
    const held = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth, payload: holdBody });
    expect(held.statusCode).toBe(200);
    const slotToken = held.json().slotToken as string;
    const replay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth, payload: holdBody });
    expect(replay.json().slotToken).toBe(slotToken);
    expect((await pool.query('SELECT count(*)::int count FROM appointments WHERE tenant_id=$1', [ids.tenant])).rows[0].count).toBe(0);

    const base = { providerCallId, customerName: 'Aitor Etxeberria', plate: '1489 KMR',
      serviceIntent: 'oil_service', symptoms: ['maintenance due'], estimatedDurationMinutes: 60, slotToken,
      confirmationTranscript: 'Sí, confirmo explícitamente la cita.' };
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth,
      payload: { ...base, providerCallId: `unconfirmed-${randomUUID()}`, explicitConfirmation: false } })).statusCode).toBe(400);
    const created = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth,
      payload: { ...base, explicitConfirmation: true } });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ ok: true, code: 'APPOINTMENT_CREATED' });
    expect((await pool.query('SELECT count(*)::int count FROM appointments WHERE tenant_id=$1', [ids.tenant])).rows[0].count).toBe(1);
    const createReplay = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth,
      payload: { ...base, explicitConfirmation: true } });
    expect(createReplay.statusCode).toBe(200);
    expect(createReplay.json().receipt.value.id).toBe(created.json().receipt.value.id);
    expect((await pool.query('SELECT count(*)::int count FROM appointments WHERE tenant_id=$1', [ids.tenant])).rows[0].count).toBe(1);
    const policyAudit = await pool.query<{ evidence_ref: string }>(
      "SELECT evidence_ref FROM audit_events WHERE tenant_id=$1 AND event_type='policy_evaluated' ORDER BY id DESC LIMIT 1", [ids.tenant],
    );
    expect(policyAudit.rows[0].evidence_ref).toBe('policy:tenant-policy-v2:allow');
  });

  it('completes find -> hold -> create for a new provisional identity without a preseeded customer', async () => {
    const providerCallId = `new-customer-${randomUUID()}`;
    const found = await app.inject({
      method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId, requestId: `find-${randomUUID()}`, ...window(), durationMinutes: 60, limit: 1 },
    });
    expect(found.statusCode).toBe(200);
    const held = await app.inject({
      method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
      payload: { providerCallId, requestId: `hold-${randomUUID()}`, candidateId: found.json().options[0].candidateId },
    });
    expect(held.statusCode).toBe(200);
    const payload = {
      providerCallId, customerName: 'Marta Etxebarria', plate: '8421 LMK', serviceIntent: 'inspection',
      symptoms: ['revisión inicial'], estimatedDurationMinutes: 60, slotToken: held.json().slotToken,
      explicitConfirmation: true, confirmationTranscript: 'Sí, confirmo la cita.',
    };
    const created = await app.inject({
      method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth, payload,
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      ok: true, code: 'APPOINTMENT_CREATED', receipt: { value: { identityResolution: 'provisional_new' } },
    });
    const replay = await app.inject({
      method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment', headers: auth, payload,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().receipt.value.id).toBe(created.json().receipt.value.id);
    const count = await pool.query(
      'SELECT count(*)::int count FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2',
      [ids.tenant, `voice-appointment:elevenlabs:${providerCallId}`],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('fails closed for manipulated candidates and lifecycle controls', async () => {
    const bad = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
      payload: { providerCallId: `call-${randomUUID()}`, requestId: `hold-${randomUUID()}`, candidateId: randomUUID() } });
    expect(bad.statusCode).toBe(409);
    expect(JSON.stringify(bad.json())).not.toContain(agent);
    expect(JSON.stringify(bad.json())).not.toContain(secret);
    const expiringCall = `call-${randomUUID()}`;
    const found = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId: expiringCall, requestId: `find-${randomUUID()}`, ...window(), durationMinutes: 60, limit: 1 } });
    const expiredCandidate = found.json().options[0].candidateId as string;
    await inTenantTransaction(pool, ids.tenant, (client) => client.query(
      "UPDATE slot_candidates SET expires_at=now()-interval '1 second' WHERE candidate_token=$1", [expiredCandidate],
    ));
    const expired = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
      payload: { providerCallId: expiringCall, requestId: `hold-${randomUUID()}`, candidateId: expiredCandidate } });
    expect(expired.statusCode).toBe(409);
    await pool.query('UPDATE tenants SET kill_switch_enabled=true WHERE id=$1', [ids.tenant]);
    const stopped = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId: `call-${randomUUID()}`, requestId: `find-${randomUUID()}`, ...window(), durationMinutes: 60, limit: 1 } });
    expect(stopped.statusCode).toBe(423);
    await pool.query('UPDATE tenants SET kill_switch_enabled=false WHERE id=$1', [ids.tenant]);
    await pool.query("UPDATE tenants SET lifecycle_status='suspended' WHERE id=$1", [ids.tenant]);
    const suspended = await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { providerCallId: `call-${randomUUID()}`, requestId: `find-${randomUUID()}`, ...window(), durationMinutes: 60, limit: 1 } });
    expect(suspended.statusCode).toBe(423);
    await pool.query("UPDATE tenants SET lifecycle_status='pilot' WHERE id=$1", [ids.tenant]);
  });

  it('rejects absent, inactive and ambiguous bindings', async () => {
    const body = { providerCallId: `call-${randomUUID()}`, requestId: `find-${randomUUID()}`,
      ...window(), durationMinutes: 60, limit: 1 };
    await pool.query("UPDATE service_principals SET status='suspended' WHERE id=$1", [ids.principal]);
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth, payload: body })).statusCode).toBe(403);
    await pool.query("UPDATE service_principals SET status='active' WHERE id=$1", [ids.principal]);
    await pool.query("UPDATE provider_bindings SET status='suspended' WHERE service_principal_id=$1", [ids.principal]);
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { ...body, requestId: `find-${randomUUID()}` } })).statusCode).toBe(403);
    await pool.query("UPDATE provider_bindings SET status='active' WHERE service_principal_id=$1", [ids.principal]);

    const other = { tenant: randomUUID(), workshop: randomUUID(), endpoint: randomUUID() };
    await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Ambiguous','pilot')", [other.tenant]);
    await inTenantTransaction(pool, other.tenant, async (client) => {
      await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours) VALUES($1,$2,'Ambiguous','UTC',$3)", [other.workshop, other.tenant, JSON.stringify(openingHours)]);
      await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'other-binding')", [other.endpoint, other.tenant, other.workshop, agent]);
    });
    await pool.query('INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4)', [ids.principal, other.tenant, other.workshop, other.endpoint]);
    expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots', headers: auth,
      payload: { ...body, requestId: `find-${randomUUID()}` } })).statusCode).toBe(403);
    await pool.query('DELETE FROM provider_bindings WHERE service_principal_id=$1 AND tenant_id=$2', [ids.principal, other.tenant]);
  });

  it('keeps candidates, holds and effective policy tenant-bound', async () => {
    const b = { tenant: randomUUID(), workshop: randomUUID(), endpoint: randomUUID(), principal: randomUUID(),
      customer: randomUUID(), vehicle: randomUUID() };
    const agentB = `agent-${randomUUID()}`;
    const secretB = `secret-${randomUUID()}`;
    await pool.query("INSERT INTO tenants(id,name,lifecycle_status,operating_mode,policy_version) VALUES($1,'Tenant B','pilot','standard','tenant-policy-B')", [b.tenant]);
    await inTenantTransaction(pool, b.tenant, async (client) => {
      await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours) VALUES($1,$2,'B','UTC',$3)", [b.workshop, b.tenant, JSON.stringify(openingHours)]);
      await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'b-binding')", [b.endpoint, b.tenant, b.workshop, agentB]);
      await insertProtectedCustomer(client, pii, { id: b.customer, tenantId: b.tenant, displayName: 'Bea Bilbao' });
      await insertProtectedVehicle(client, pii, { id: b.vehicle, tenantId: b.tenant, plate: '1234 BBB' });
      await client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)', [b.tenant, b.customer, b.vehicle]);
    });
    await pool.query("INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES($1,'elevenlabs','voice_provider',$2,'secret://test-b')", [b.principal, agentB]);
    await pool.query('INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4)', [b.principal, b.tenant, b.workshop, b.endpoint]);
    const appB = buildApi(pool, { piiProtection: pii, providerIngress: { publicApiBaseUrl: 'https://api.bibendia.test',
      elevenLabsTool: { servicePrincipalId: b.principal, externalAccountId: agentB, secret: secretB } } });
    await appB.ready();
    try {
      const providerCallId = `call-${randomUUID()}`;
      const foundB = await appB.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/find-slots',
        headers: { authorization: `Bearer ${secretB}` }, payload: { providerCallId, requestId: `find-${randomUUID()}`,
          ...window(), durationMinutes: 60, limit: 1 } });
      expect(foundB.statusCode).toBe(200);
      const candidateId = foundB.json().options[0].candidateId as string;
      expect((await app.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot', headers: auth,
        payload: { providerCallId, requestId: `hold-${randomUUID()}`, candidateId } })).statusCode).toBe(409);
      const heldB = await appB.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/hold-slot',
        headers: { authorization: `Bearer ${secretB}` }, payload: { providerCallId, requestId: `hold-${randomUUID()}`, candidateId } });
      expect(heldB.statusCode).toBe(200);
      const createdB = await appB.inject({ method: 'POST', url: '/v1/providers/elevenlabs/tools/create-appointment',
        headers: { authorization: `Bearer ${secretB}` }, payload: { providerCallId, customerName: 'Bea Bilbao', plate: '1234 BBB',
          serviceIntent: 'inspection', symptoms: ['revision'], estimatedDurationMinutes: 60, slotToken: heldB.json().slotToken,
          explicitConfirmation: true, confirmationTranscript: 'Confirmo la cita.' } });
      expect(createdB.statusCode).toBe(200);
      const auditB = await pool.query<{ evidence_ref: string }>(
        "SELECT evidence_ref FROM audit_events WHERE tenant_id=$1 AND event_type='policy_evaluated' ORDER BY id DESC LIMIT 1", [b.tenant],
      );
      expect(auditB.rows[0].evidence_ref).toBe('policy:tenant-policy-B:allow');
    } finally { await appB.close(); }
  });
});
