import type { ProviderIngressConfig } from '../auth/provider-authentication-adapter.js';
import { piiProtectionFromEnvironment, type PiiProtection } from '../security/pii-protection.js';

export const EXPECTED_SCHEMA_VERSION = '011_provisional_identity_acquisition.sql';
export type RuntimeIdentity = { version: string; commit: string };

export type ApiRuntimeConfig = RuntimeIdentity & {
  port: number;
  shutdownTimeoutMs: number;
  allowedOrigins: [string, string];
  providerIngress?: ProviderIngressConfig;
  piiProtection: PiiProtection;
};

export type WorkerRuntimeConfig = RuntimeIdentity & {
  mode: 'disabled';
  healthPort: number;
  shutdownTimeoutMs: number;
  workerId: string;
};

export class RuntimeConfigError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'RuntimeConfigError'; }
}

export function loadApiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ApiRuntimeConfig {
  const identity = runtimeIdentity(env);
  const workshopOrigin = requiredOrigin(env.WORKSHOP_ORIGIN, 'WORKSHOP_ORIGIN_INVALID');
  const platformOrigin = requiredOrigin(env.PLATFORM_ORIGIN, 'PLATFORM_ORIGIN_INVALID');
  if (workshopOrigin === platformOrigin) throw new RuntimeConfigError('RUNTIME_ORIGINS_NOT_SEPARATE');
  return {
    ...identity,
    port: integer(env.PORT ?? '3100', 1, 65535, 'PORT_INVALID'),
    shutdownTimeoutMs: integer(env.SHUTDOWN_TIMEOUT_MS ?? '10000', 1000, 60000, 'SHUTDOWN_TIMEOUT_INVALID'),
    allowedOrigins: [workshopOrigin, platformOrigin],
    providerIngress: providerIngressFromEnvironment(env),
    piiProtection: piiProtectionFromEnvironment(env),
  };
}

export function loadWorkerRuntimeConfig(env: NodeJS.ProcessEnv = process.env): WorkerRuntimeConfig {
  const mode = env.WORKER_MODE ?? 'disabled';
  if (mode !== 'disabled') throw new RuntimeConfigError('WORKER_ADAPTER_NOT_CONFIGURED');
  return {
    ...runtimeIdentity(env), mode,
    healthPort: integer(env.WORKER_HEALTH_PORT ?? '3101', 1, 65535, 'WORKER_HEALTH_PORT_INVALID'),
    shutdownTimeoutMs: integer(env.SHUTDOWN_TIMEOUT_MS ?? '10000', 1000, 60000, 'SHUTDOWN_TIMEOUT_INVALID'),
    workerId: env.WORKER_ID?.trim() || `worker-${process.pid}`,
  };
}

function runtimeIdentity(env: NodeJS.ProcessEnv): RuntimeIdentity {
  const version = env.APP_VERSION?.trim();
  const commit = env.APP_COMMIT_SHA?.trim();
  if (!version) throw new RuntimeConfigError('APP_VERSION_REQUIRED');
  if (!commit || !/^[0-9a-f]{7,40}$/i.test(commit)) throw new RuntimeConfigError('APP_COMMIT_SHA_INVALID');
  return { version, commit };
}

function requiredOrigin(value: string | undefined, code: string): string {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new RuntimeConfigError(code); }
}

function integer(value: string, min: number, max: number, code: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new RuntimeConfigError(code);
  return parsed;
}

function providerIngressFromEnvironment(env: NodeJS.ProcessEnv): ProviderIngressConfig | undefined {
  const groups = {
    twilio: [env.TWILIO_SERVICE_PRINCIPAL_ID, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN],
    elevenLabsWebhook: [env.ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID, env.ELEVENLABS_AGENT_ID, env.ELEVENLABS_WEBHOOK_SECRET],
    elevenLabsTool: [env.ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID, env.ELEVENLABS_AGENT_ID, env.ELEVENLABS_TOOL_SECRET],
  } as const;
  const configured = Object.values(groups).some((values) => values.some(Boolean));
  if (!configured) return undefined;
  for (const [name, values] of Object.entries(groups)) {
    if (values.some(Boolean) && !values.every(Boolean)) throw new RuntimeConfigError(`${name.toUpperCase()}_CONFIG_INCOMPLETE`);
  }
  if (!env.PUBLIC_API_BASE_URL) throw new RuntimeConfigError('PUBLIC_API_BASE_URL_REQUIRED');
  const publicApiBaseUrl = requiredOrigin(env.PUBLIC_API_BASE_URL, 'PUBLIC_API_BASE_URL_INVALID');
  return {
    publicApiBaseUrl,
    twilio: groups.twilio.every(Boolean) ? { servicePrincipalId: groups.twilio[0]!, externalAccountId: groups.twilio[1]!, secret: groups.twilio[2]! } : undefined,
    elevenLabsWebhook: groups.elevenLabsWebhook.every(Boolean) ? { servicePrincipalId: groups.elevenLabsWebhook[0]!, externalAccountId: groups.elevenLabsWebhook[1]!, secret: groups.elevenLabsWebhook[2]! } : undefined,
    elevenLabsTool: groups.elevenLabsTool.every(Boolean) ? { servicePrincipalId: groups.elevenLabsTool[0]!, externalAccountId: groups.elevenLabsTool[1]!, secret: groups.elevenLabsTool[2]! } : undefined,
  };
}
