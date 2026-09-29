import net from 'node:net';
import type { ProviderIngressConfig } from '../auth/provider-authentication-adapter.js';
import type { HumanAuthenticationConfig } from '../auth/oidc-authentication-adapter.js';
import { piiProtectionFromEnvironment, type PiiProtection } from '../security/pii-protection.js';

export const EXPECTED_SCHEMA_VERSION = '013_public_lead_acquisition.sql';
export type RuntimeIdentity = { version: string; commit: string };

export type ApiRuntimeConfig = RuntimeIdentity & {
  port: number;
  shutdownTimeoutMs: number;
  allowedOrigins: [string, string];
  providerIngress?: ProviderIngressConfig;
  piiProtection: PiiProtection;
  publicLeadTenantId?: string;
  trustedProxyCidrs?: readonly string[];
  humanAuthentication?: HumanAuthenticationConfig;
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
    publicLeadTenantId: optionalUuid(env.PUBLIC_LEAD_ACQUISITION_TENANT_ID),
    trustedProxyCidrs: parseTrustedProxyCidrs(env.TRUSTED_PROXY_CIDRS),
    humanAuthentication: humanAuthenticationFromEnvironment(env),
  };
}

function humanAuthenticationFromEnvironment(env: NodeJS.ProcessEnv): HumanAuthenticationConfig | undefined {
  const names = [
    'OIDC_ISSUER', 'OIDC_WORKSHOP_CLIENT_ID', 'OIDC_WORKSHOP_CLIENT_SECRET',
    'OIDC_PLATFORM_CLIENT_ID', 'OIDC_PLATFORM_CLIENT_SECRET', 'HUMAN_SESSION_KEY', 'HUMAN_AUTH_PILOT_TENANT_ID',
  ] as const;
  const configured = names.some((name) => Boolean(env[name]));
  if (!configured) return undefined;
  for (const name of names) if (!env[name]?.trim()) throw new RuntimeConfigError('HUMAN_AUTH_CONFIG_INCOMPLETE');

  const issuer = requiredOrigin(env.OIDC_ISSUER, 'OIDC_ISSUER_INVALID');
  const sessionKey = env.HUMAN_SESSION_KEY!.trim();
  let decoded: Buffer;
  try { decoded = Buffer.from(sessionKey, 'base64url'); } catch { throw new RuntimeConfigError('HUMAN_SESSION_KEY_INVALID'); }
  if (decoded.length !== 32) throw new RuntimeConfigError('HUMAN_SESSION_KEY_INVALID');
  const authorizationTenantId = requiredUuid(env.HUMAN_AUTH_PILOT_TENANT_ID, 'HUMAN_AUTH_PILOT_TENANT_INVALID');

  return {
    issuer,
    sessionKey,
    sessionTtlSeconds: integer(env.HUMAN_SESSION_TTL_SECONDS ?? '28800', 300, 86400, 'HUMAN_SESSION_TTL_INVALID'),
    workshop: {
      audience: 'workshop', clientId: env.OIDC_WORKSHOP_CLIENT_ID!.trim(), clientSecret: env.OIDC_WORKSHOP_CLIENT_SECRET!.trim(),
      origin: requiredOrigin(env.WORKSHOP_ORIGIN, 'WORKSHOP_ORIGIN_INVALID'), cookieName: '__Host-bibendia_workshop', requireMfa: false,
      authorizationTenantId,
    },
    platform: {
      audience: 'platform', clientId: env.OIDC_PLATFORM_CLIENT_ID!.trim(), clientSecret: env.OIDC_PLATFORM_CLIENT_SECRET!.trim(),
      origin: requiredOrigin(env.PLATFORM_ORIGIN, 'PLATFORM_ORIGIN_INVALID'), cookieName: '__Host-bibendia_platform', requireMfa: true,
      authorizationTenantId,
    },
  };
}

function requiredUuid(value: string | undefined, code: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RuntimeConfigError(code);
  }
  return value;
}

function optionalUuid(value:string|undefined):string|undefined {
  if (!value) return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new RuntimeConfigError('PUBLIC_LEAD_TENANT_INVALID');
  return value;
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
  const activation = {
    twilio: groups.twilio,
    // ELEVENLABS_AGENT_ID is shared context, not an activation signal for either capability.
    elevenLabsWebhook: [env.ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID, env.ELEVENLABS_WEBHOOK_SECRET],
    elevenLabsTool: [env.ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID, env.ELEVENLABS_TOOL_SECRET],
  } as const;
  const activeGroups = Object.fromEntries(
    Object.entries(activation).map(([name, values]) => [name, values.some(Boolean)]),
  ) as Record<keyof typeof groups, boolean>;
  if (!Object.values(activeGroups).some(Boolean)) return undefined;
  for (const [name, values] of Object.entries(groups) as [keyof typeof groups, readonly (string | undefined)[]][]) {
    if (activeGroups[name] && !values.every(Boolean)) throw new RuntimeConfigError(`${name.toUpperCase()}_CONFIG_INCOMPLETE`);
  }
  if (!env.PUBLIC_API_BASE_URL) throw new RuntimeConfigError('PUBLIC_API_BASE_URL_REQUIRED');
  const publicApiBaseUrl = requiredOrigin(env.PUBLIC_API_BASE_URL, 'PUBLIC_API_BASE_URL_INVALID');
  return {
    publicApiBaseUrl,
    twilio: activeGroups.twilio ? { servicePrincipalId: groups.twilio[0]!, externalAccountId: groups.twilio[1]!, secret: groups.twilio[2]! } : undefined,
    elevenLabsWebhook: activeGroups.elevenLabsWebhook ? { servicePrincipalId: groups.elevenLabsWebhook[0]!, externalAccountId: groups.elevenLabsWebhook[1]!, secret: groups.elevenLabsWebhook[2]! } : undefined,
    elevenLabsTool: activeGroups.elevenLabsTool ? { servicePrincipalId: groups.elevenLabsTool[0]!, externalAccountId: groups.elevenLabsTool[1]!, secret: groups.elevenLabsTool[2]! } : undefined,
  };
}

function parseTrustedProxyCidrs(value: string | undefined): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const rawParts = trimmed.split(',');
  const result: string[] = [];
  for (const raw of rawParts) {
    const token = raw.trim();
    if (!token || !isValidIpOrCidr(token)) {
      throw new RuntimeConfigError('TRUSTED_PROXY_CIDRS_INVALID');
    }
    result.push(token);
  }
  if (result.length === 0) throw new RuntimeConfigError('TRUSTED_PROXY_CIDRS_INVALID');
  return Object.freeze(result);
}

function isValidIpOrCidr(token: string): boolean {
  if (token.includes('/')) {
    const parts = token.split('/');
    if (parts.length !== 2) return false;
    const [ip, prefixStr] = parts;
    if (!/^\d+$/.test(prefixStr)) return false;
    const prefix = Number(prefixStr);
    if (net.isIPv4(ip)) {
      return prefix >= 0 && prefix <= 32;
    }
    if (net.isIPv6(ip)) {
      return prefix >= 0 && prefix <= 128;
    }
    return false;
  }
  return net.isIP(token) !== 0;
}
