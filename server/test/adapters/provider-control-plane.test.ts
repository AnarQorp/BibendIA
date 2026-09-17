import { describe, expect, it, vi } from 'vitest';
import { ElevenLabsControlPlane, VapiControlPlane } from '../../src/adapters/voice/provider-control-plane.js';

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('voice provider control planes', () => {
  it('keeps Vapi private keys server-side and returns dashboard mode', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'assistant-1', name: 'Test' }));
    const adapter = new VapiControlPlane('private-secret', http);
    expect(await adapter.createWebSession('assistant-1')).toEqual({ connection: 'dashboard' });
    expect(http.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer private-secret' });
  });

  it('mints an ElevenLabs signed URL without exposing the API key', async () => {
    const http = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ agent_id: 'agent-1', name: 'Test' }))
      .mockResolvedValueOnce(jsonResponse({ signed_url: 'wss://signed.example/token' }));
    const adapter = new ElevenLabsControlPlane('private-secret', http);
    expect(await adapter.createWebSession('agent-1')).toEqual({ connection: 'signed_url', signedUrl: 'wss://signed.example/token' });
    expect(String(http.mock.calls[1][0])).not.toContain('private-secret');
  });
});
