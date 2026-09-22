import { createHmac } from 'node:crypto';
import twilio from 'twilio';
import { describe, expect, it } from 'vitest';
import { DenyAllAuthenticationAdapter, type AuthenticationRequest } from '../../src/auth/authentication-adapter.js';
import { ProviderAuthenticationAdapter } from '../../src/auth/provider-authentication-adapter.js';

const principalIds = {
  twilio: '00000000-0000-4000-8000-000000000001',
  eleven: '00000000-0000-4000-8000-000000000002',
};
const adapter = new ProviderAuthenticationAdapter(new DenyAllAuthenticationAdapter(), {
  publicApiBaseUrl: 'https://api.bibendia.test',
  twilio: { servicePrincipalId: principalIds.twilio, externalAccountId: 'AC123', secret: 'twilio-secret' },
  elevenLabsWebhook: { servicePrincipalId: principalIds.eleven, externalAccountId: 'agent-123', secret: 'webhook-secret' },
  elevenLabsTool: { servicePrincipalId: principalIds.eleven, externalAccountId: 'agent-123', secret: 'tool-secret' },
});

const request = (overrides: Partial<AuthenticationRequest>): AuthenticationRequest => ({
  method: 'POST', url: '/', path: '/', headers: {}, ...overrides,
});

describe('provider authentication adapter', () => {
  it('validates Twilio against the configured public URL and account', async () => {
    const path = '/v1/providers/twilio/voice/events';
    const body = { AccountSid: 'AC123', CallSid: 'CA123', To: '+34944123456' };
    const signature = twilio.getExpectedTwilioSignature('twilio-secret', `https://api.bibendia.test${path}`, body);
    const principal = await adapter.authenticate(request({ path, url: path, body, headers: { 'x-twilio-signature': signature } }), 'provider');
    expect(principal).toMatchObject({ serviceId: principalIds.twilio, externalAccountId: 'AC123', serviceType: 'telephony_provider' });
    expect(await adapter.authenticate(request({ path, url: path, body: { ...body, AccountSid: 'AC999' }, headers: { 'x-twilio-signature': signature } }), 'provider')).toBeNull();
  });

  it('validates ElevenLabs HMAC and rejects stale or altered payloads', async () => {
    const path = '/v1/providers/elevenlabs/conversations/events';
    const rawBody = JSON.stringify({ type: 'post_call_transcription', event_timestamp: 1, data: { agent_id: 'agent-123', conversation_id: 'conv-1' } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = `t=${timestamp},v0=${createHmac('sha256', 'webhook-secret').update(`${timestamp}.${rawBody}`).digest('hex')}`;
    const valid = await adapter.authenticate(request({ path, url: path, rawBody, headers: { 'elevenlabs-signature': signature } }), 'provider');
    expect(valid).toMatchObject({ serviceId: principalIds.eleven, serviceType: 'voice_provider' });
    expect(await adapter.authenticate(request({ path, url: path, rawBody: `${rawBody} `, headers: { 'elevenlabs-signature': signature } }), 'provider')).toBeNull();

    const stale = (Math.floor(Date.now() / 1000) - 1900).toString();
    const staleSignature = `t=${stale},v0=${createHmac('sha256', 'webhook-secret').update(`${stale}.${rawBody}`).digest('hex')}`;
    expect(await adapter.authenticate(request({ path, url: path, rawBody, headers: { 'elevenlabs-signature': staleSignature } }), 'provider')).toBeNull();
  });

  it('uses a dedicated constant-time bearer credential for the ElevenLabs tool', async () => {
    const path = '/v1/providers/elevenlabs/tools/create-appointment';
    expect(await adapter.authenticate(request({ path, authorization: 'Bearer wrong' }), 'provider')).toBeNull();
    expect(await adapter.authenticate(request({ path, authorization: 'Bearer tool-secret' }), 'provider'))
      .toMatchObject({ serviceId: principalIds.eleven, externalAccountId: 'agent-123' });
    for (const schedulingPath of [
      '/v1/providers/elevenlabs/tools/find-slots',
      '/v1/providers/elevenlabs/tools/hold-slot',
    ]) {
      expect(await adapter.authenticate(request({ path: schedulingPath, authorization: 'Bearer wrong' }), 'provider')).toBeNull();
      expect(await adapter.authenticate(request({ path: schedulingPath, authorization: 'Bearer tool-secret' }), 'provider'))
        .toMatchObject({ serviceId: principalIds.eleven, externalAccountId: 'agent-123' });
    }
  });
});
