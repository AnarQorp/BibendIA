import { buildApi } from './app.js';
import { createPool } from '../persistence/pool.js';
import type { ProviderIngressConfig } from '../auth/provider-authentication-adapter.js';

const pool = createPool('api');
const allowedOrigins = [process.env.WORKSHOP_ORIGIN, process.env.PLATFORM_ORIGIN].filter((value): value is string => Boolean(value));
if (process.env.NODE_ENV === 'production' && allowedOrigins.length !== 2) {
  throw new Error('WORKSHOP_ORIGIN and PLATFORM_ORIGIN are required in production');
}
const providerIngress = providerIngressFromEnvironment();
const app = buildApi(pool, { allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined, providerIngress });
const port = Number(process.env.PORT ?? 3100);
await app.listen({ host: '0.0.0.0', port });

const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function providerIngressFromEnvironment(): ProviderIngressConfig | undefined {
  const publicApiBaseUrl = process.env.PUBLIC_API_BASE_URL;
  const groups = {
    twilio: [process.env.TWILIO_SERVICE_PRINCIPAL_ID, process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN],
    elevenLabsWebhook: [process.env.ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID, process.env.ELEVENLABS_AGENT_ID, process.env.ELEVENLABS_WEBHOOK_SECRET],
    elevenLabsTool: [process.env.ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID, process.env.ELEVENLABS_AGENT_ID, process.env.ELEVENLABS_TOOL_SECRET],
  } as const;
  const configured = Object.values(groups).some((values) => values.some(Boolean));
  if (!configured) return undefined;
  if (!publicApiBaseUrl) throw new Error('PUBLIC_API_BASE_URL is required when provider ingress is configured');
  for (const [name, values] of Object.entries(groups)) {
    if (values.some(Boolean) && !values.every(Boolean)) throw new Error(`${name} provider ingress configuration is incomplete`);
  }
  return {
    publicApiBaseUrl,
    twilio: groups.twilio.every(Boolean) ? {
      servicePrincipalId: groups.twilio[0]!, externalAccountId: groups.twilio[1]!, secret: groups.twilio[2]!,
    } : undefined,
    elevenLabsWebhook: groups.elevenLabsWebhook.every(Boolean) ? {
      servicePrincipalId: groups.elevenLabsWebhook[0]!, externalAccountId: groups.elevenLabsWebhook[1]!, secret: groups.elevenLabsWebhook[2]!,
    } : undefined,
    elevenLabsTool: groups.elevenLabsTool.every(Boolean) ? {
      servicePrincipalId: groups.elevenLabsTool[0]!, externalAccountId: groups.elevenLabsTool[1]!, secret: groups.elevenLabsTool[2]!,
    } : undefined,
  };
}
