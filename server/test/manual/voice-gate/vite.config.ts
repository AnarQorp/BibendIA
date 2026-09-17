import { defineConfig, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';

const envPath = '/home/anarqorp/BibendIA/.env';

function parseEnv(text: string): Record<string, string> {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
  }));
}

function gateConfig(): Plugin {
  return {
    name: 'bibendia-voice-gate-config-test-only',
    configureServer(server) {
      server.middlewares.use('/gate-config', async (request, response) => {
        try {
          const env = parseEnv(await readFile(envPath, 'utf8'));
          const provider = new URL(request.url ?? '', 'http://localhost').searchParams.get('provider');
          let payload: { assistantId: string; token: string };
          if (provider === 'vapi') {
            payload = { assistantId: env.VAPI_ASSISTANT_ID, token: env.VAPI_PUBLIC_KEY };
          } else if (provider === 'elevenlabs') {
            const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
            url.searchParams.set('agent_id', env.ELEVENLABS_AGENT_ID);
            url.searchParams.set('include_conversation_id', 'true');
            const signed = await fetch(url, { headers: { 'xi-api-key': env.ELEVENLABS_API_KEY } });
            if (!signed.ok) throw new Error(`ElevenLabs signed URL failed: ${signed.status}`);
            const body = await signed.json() as { signed_url: string };
            payload = { assistantId: env.ELEVENLABS_AGENT_ID, token: body.signed_url };
          } else throw new Error('Unknown provider');
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
      });
    },
  };
}

export default defineConfig({ plugins: [gateConfig()], server: { host: '127.0.0.1', port: 3131, strictPort: true } });
