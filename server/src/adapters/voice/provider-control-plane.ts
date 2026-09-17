import type { VoiceProviderName } from '../../ports/voice-provider.js';

export interface ProviderAgent { id: string; name: string }

export interface VoiceProviderControlPlane {
  readonly name: VoiceProviderName;
  listAgents(): Promise<ProviderAgent[]>;
  verifyAgent(agentId: string): Promise<ProviderAgent>;
  createWebSession(agentId: string): Promise<{ connection: 'dashboard' | 'signed_url'; signedUrl?: string }>;
}

async function checkedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  return response.json();
}

export class VapiControlPlane implements VoiceProviderControlPlane {
  readonly name = 'vapi' as const;
  constructor(private readonly apiKey: string, private readonly http: typeof fetch = fetch) {}
  private headers() { return { Authorization: `Bearer ${this.apiKey}` }; }
  async listAgents(): Promise<ProviderAgent[]> {
    const body = await checkedJson(await this.http('https://api.vapi.ai/assistant', { headers: this.headers() })) as Array<{ id: string; name: string }>;
    return body.map(({ id, name }) => ({ id, name }));
  }
  async verifyAgent(agentId: string): Promise<ProviderAgent> {
    const body = await checkedJson(await this.http(`https://api.vapi.ai/assistant/${encodeURIComponent(agentId)}`, { headers: this.headers() })) as { id: string; name: string };
    return { id: body.id, name: body.name };
  }
  async createWebSession(agentId: string) {
    await this.verifyAgent(agentId);
    // Private keys must never be exposed to the browser. Vapi web audio requires a restricted public key/JWT or Dashboard Talk.
    return { connection: 'dashboard' as const };
  }
}

export class ElevenLabsControlPlane implements VoiceProviderControlPlane {
  readonly name = 'elevenlabs' as const;
  constructor(private readonly apiKey: string, private readonly http: typeof fetch = fetch) {}
  private headers() { return { 'xi-api-key': this.apiKey }; }
  async listAgents(): Promise<ProviderAgent[]> {
    const body = await checkedJson(await this.http('https://api.elevenlabs.io/v1/convai/agents?page_size=100', { headers: this.headers() })) as { agents: Array<{ agent_id: string; name: string }> };
    return body.agents.map(({ agent_id, name }) => ({ id: agent_id, name }));
  }
  async verifyAgent(agentId: string): Promise<ProviderAgent> {
    const body = await checkedJson(await this.http(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, { headers: this.headers() })) as { agent_id: string; name: string };
    return { id: body.agent_id, name: body.name };
  }
  async createWebSession(agentId: string) {
    await this.verifyAgent(agentId);
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
    url.searchParams.set('agent_id', agentId);
    url.searchParams.set('include_conversation_id', 'true');
    const body = await checkedJson(await this.http(url, { headers: this.headers() })) as { signed_url: string };
    return { connection: 'signed_url' as const, signedUrl: body.signed_url };
  }
}
