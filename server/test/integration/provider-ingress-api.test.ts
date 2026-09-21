import { createHmac, randomUUID } from 'node:crypto';
import twilio from 'twilio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const ids = {
  tenant: randomUUID(), workshop: randomUUID(), twilioEndpoint: randomUUID(), elevenEndpoint: randomUUID(),
  twilioPrincipal: randomUUID(), elevenPrincipal: randomUUID(),
};
const publicApiBaseUrl = 'https://api.bibendia.test';
const twilioAccountId = `AC-${randomUUID()}`;
const elevenAgentId = `agent-${randomUUID()}`;
const twilioPath = '/v1/providers/twilio/voice/events';
const elevenPath = '/v1/providers/elevenlabs/conversations/events';
const app = buildApi(pool, { providerIngress: {
  publicApiBaseUrl,
  twilio: { servicePrincipalId: ids.twilioPrincipal, externalAccountId: twilioAccountId, secret: 'twilio-api-secret' },
  elevenLabsWebhook: { servicePrincipalId: ids.elevenPrincipal, externalAccountId: elevenAgentId, secret: 'eleven-webhook-secret' },
} });

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name) VALUES($1,'Provider API')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Provider API workshop')", [ids.workshop, ids.tenant]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'twilio',$4,'+34944000999')", [ids.twilioEndpoint, ids.tenant, ids.workshop, twilioAccountId]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'elevenlabs',$4,'agent-binding')", [ids.elevenEndpoint, ids.tenant, ids.workshop, elevenAgentId]);
  });
  await pool.query(
    `INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES
      ($1,'twilio','telephony_provider',$3,'secret://twilio/api'),
      ($2,'elevenlabs','voice_provider',$4,'secret://elevenlabs/api')`,
    [ids.twilioPrincipal, ids.elevenPrincipal, twilioAccountId, elevenAgentId],
  );
  await pool.query(
    `INSERT INTO provider_bindings(service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES
      ($1,$3,$4,$5),($2,$3,$4,$6)`,
    [ids.twilioPrincipal, ids.elevenPrincipal, ids.tenant, ids.workshop, ids.twilioEndpoint, ids.elevenEndpoint],
  );
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('provider ingress HTTP boundary', () => {
  it('accepts signed Twilio form data, deduplicates retry and rejects invalid signature or DID', async () => {
    const body = { AccountSid: twilioAccountId, CallSid: `CA${randomUUID()}`, To: '+34944000999', From: '+34600000000', CallStatus: 'ringing', SequenceNumber: '0' };
    const signature = twilio.getExpectedTwilioSignature('twilio-api-secret', `${publicApiBaseUrl}${twilioPath}`, body);
    const send = (payload: Record<string, string>, header = signature) => app.inject({
      method: 'POST', url: twilioPath, payload: new URLSearchParams(payload).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': header },
    });
    const first = await send(body);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ ok: true, disposition: 'claimed' });
    expect((await send(body)).json()).toMatchObject({ disposition: 'duplicate' });
    expect((await send(body, 'invalid')).statusCode).toBe(401);

    const wrongDid = { ...body, CallSid: `CA${randomUUID()}`, To: '+34944000000' };
    const wrongDidSignature = twilio.getExpectedTwilioSignature('twilio-api-secret', `${publicApiBaseUrl}${twilioPath}`, wrongDid);
    expect((await send(wrongDid, wrongDidSignature)).statusCode).toBe(403);
  });

  it('accepts fresh ElevenLabs HMAC only for the bound agent', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = { type: 'post_call_transcription', event_timestamp: Number(timestamp), data: { agent_id: elevenAgentId, conversation_id: `conv-${randomUUID()}` } };
    const raw = JSON.stringify(payload);
    const signature = `t=${timestamp},v0=${createHmac('sha256', 'eleven-webhook-secret').update(`${timestamp}.${raw}`).digest('hex')}`;
    const response = await app.inject({ method: 'POST', url: elevenPath, payload: raw, headers: { 'content-type': 'application/json', 'elevenlabs-signature': signature } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, disposition: 'claimed' });

    const wrongAgentRaw = JSON.stringify({ ...payload, data: { ...payload.data, agent_id: 'agent-attacker' } });
    const wrongAgentSignature = `t=${timestamp},v0=${createHmac('sha256', 'eleven-webhook-secret').update(`${timestamp}.${wrongAgentRaw}`).digest('hex')}`;
    expect((await app.inject({ method: 'POST', url: elevenPath, payload: wrongAgentRaw, headers: { 'content-type': 'application/json', 'elevenlabs-signature': wrongAgentSignature } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: elevenPath, payload: raw, headers: { 'content-type': 'application/json', 'elevenlabs-signature': 'invalid' } })).statusCode).toBe(401);
  });
});
