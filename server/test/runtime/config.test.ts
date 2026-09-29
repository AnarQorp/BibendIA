import { describe, expect, it } from 'vitest';
import { loadApiRuntimeConfig, loadWorkerRuntimeConfig } from '../../src/runtime/config.js';

const key = Buffer.alloc(32, 7).toString('base64');
const base = {
  NODE_ENV: 'production', APP_VERSION: '1.0.0', APP_COMMIT_SHA: 'a'.repeat(40),
  WORKSHOP_ORIGIN: 'https://app.bibendia.com', PLATFORM_ORIGIN: 'https://admin.bibendia.com',
  PII_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: key }), PII_ACTIVE_ENCRYPTION_KEY_ID: 'v1',
  PII_LOOKUP_KEYS_JSON: JSON.stringify({ l1: key }), PII_ACTIVE_LOOKUP_KEY_ID: 'l1',
} satisfies NodeJS.ProcessEnv;

describe('production runtime configuration', () => {
  it('validates API identity, separate origins and PII keyrings at startup', () => {
    expect(loadApiRuntimeConfig(base).version).toBe('1.0.0');
    expect(() => loadApiRuntimeConfig({ ...base, PII_ENCRYPTION_KEYS_JSON: '{}' })).toThrow();
    expect(() => loadApiRuntimeConfig({ ...base, PLATFORM_ORIGIN: base.WORKSHOP_ORIGIN })).toThrow();
  });

  it('requires complete provider groups without requiring disabled integrations', () => {
    expect(loadApiRuntimeConfig(base).providerIngress).toBeUndefined();
    expect(() => loadApiRuntimeConfig({ ...base, TWILIO_ACCOUNT_SID: 'AC123' })).toThrow(/INCOMPLETE/);
  });

  it('supports independent ElevenLabs tool-only and webhook-only runtime groups', () => {
    const shared = { ...base, PUBLIC_API_BASE_URL: 'https://api.bibendia.com', ELEVENLABS_AGENT_ID: 'agent-jarrisons' };
    expect(loadApiRuntimeConfig({ ...base, ELEVENLABS_AGENT_ID: 'agent-jarrisons' }).providerIngress).toBeUndefined();

    const toolOnly = loadApiRuntimeConfig({
      ...shared, ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID: 'tool-principal', ELEVENLABS_TOOL_SECRET: 'tool-secret',
    }).providerIngress!;
    expect(toolOnly.elevenLabsTool).toEqual({
      servicePrincipalId: 'tool-principal', externalAccountId: 'agent-jarrisons', secret: 'tool-secret',
    });
    expect(toolOnly.elevenLabsWebhook).toBeUndefined();

    const webhookOnly = loadApiRuntimeConfig({
      ...shared, ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID: 'webhook-principal', ELEVENLABS_WEBHOOK_SECRET: 'webhook-secret',
    }).providerIngress!;
    expect(webhookOnly.elevenLabsWebhook).toEqual({
      servicePrincipalId: 'webhook-principal', externalAccountId: 'agent-jarrisons', secret: 'webhook-secret',
    });
    expect(webhookOnly.elevenLabsTool).toBeUndefined();

    const both = loadApiRuntimeConfig({
      ...shared,
      ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID: 'tool-principal', ELEVENLABS_TOOL_SECRET: 'tool-secret',
      ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID: 'webhook-principal', ELEVENLABS_WEBHOOK_SECRET: 'webhook-secret',
    }).providerIngress!;
    expect(both.elevenLabsTool).toBeDefined();
    expect(both.elevenLabsWebhook).toBeDefined();
  });

  it('fails closed for partially activated ElevenLabs capability groups', () => {
    const runtime = { ...base, PUBLIC_API_BASE_URL: 'https://api.bibendia.com', ELEVENLABS_AGENT_ID: 'agent-jarrisons' };
    expect(() => loadApiRuntimeConfig({
      ...runtime, ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID: 'tool-principal',
    })).toThrow(/ELEVENLABSTOOL_CONFIG_INCOMPLETE/);
    expect(() => loadApiRuntimeConfig({
      ...runtime, ELEVENLABS_TOOL_SECRET: 'tool-secret',
    })).toThrow(/ELEVENLABSTOOL_CONFIG_INCOMPLETE/);
    expect(() => loadApiRuntimeConfig({
      ...runtime, ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID: 'webhook-principal',
    })).toThrow(/ELEVENLABSWEBHOOK_CONFIG_INCOMPLETE/);
    expect(() => loadApiRuntimeConfig({
      ...runtime, ELEVENLABS_WEBHOOK_SECRET: 'webhook-secret',
    })).toThrow(/ELEVENLABSWEBHOOK_CONFIG_INCOMPLETE/);
  });

  it('keeps Worker disabled by default and refuses enablement without an approved adapter', () => {
    expect(loadWorkerRuntimeConfig(base).mode).toBe('disabled');
    expect(() => loadWorkerRuntimeConfig({ ...base, WORKER_MODE: 'enabled' })).toThrow(/WORKER_ADAPTER_NOT_CONFIGURED/);
  });

  it('loads human auth atomically, requires the pilot tenant and enforces separate MFA policy', () => {
    const auth = {
      ...base, OIDC_ISSUER: 'https://bibendia.eu.auth0.com', HUMAN_SESSION_KEY: key,
      OIDC_WORKSHOP_CLIENT_ID: 'workshop-client', OIDC_WORKSHOP_CLIENT_SECRET: 'workshop-secret',
      OIDC_PLATFORM_CLIENT_ID: 'platform-client', OIDC_PLATFORM_CLIENT_SECRET: 'platform-secret',
      HUMAN_AUTH_PILOT_TENANT_ID: '00000000-0000-4000-8000-000000000001',
    };
    const config = loadApiRuntimeConfig(auth).humanAuthentication!;
    expect(config.workshop.requireMfa).toBe(false);
    expect(config.platform.requireMfa).toBe(true);
    expect(config.workshop.cookieName).not.toBe(config.platform.cookieName);
    expect(() => loadApiRuntimeConfig({ ...auth, HUMAN_AUTH_PILOT_TENANT_ID: undefined })).toThrow(/INCOMPLETE/);
    expect(() => loadApiRuntimeConfig({ ...auth, HUMAN_SESSION_KEY: Buffer.alloc(16).toString('base64url') })).toThrow(/SESSION_KEY_INVALID/);
  });

  it('parses and validates TRUSTED_PROXY_CIDRS with strict fail-closed semantics', () => {
    // Absent -> undefined
    expect(loadApiRuntimeConfig(base).trustedProxyCidrs).toBeUndefined();

    // Empty/whitespace -> undefined
    expect(loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '' }).trustedProxyCidrs).toBeUndefined();
    expect(loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '   ' }).trustedProxyCidrs).toBeUndefined();

    // Single valid IP
    expect(loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '127.0.0.1' }).trustedProxyCidrs).toEqual(['127.0.0.1']);

    // List with IPv4, CIDRs, IPv6
    expect(loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '127.0.0.1, 10.0.0.0/8, ::1, 172.16.0.0/12' }).trustedProxyCidrs)
      .toEqual(['127.0.0.1', '10.0.0.0/8', '::1', '172.16.0.0/12']);

    // Invalid values throw TRUSTED_PROXY_CIDRS_INVALID
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: 'true' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: 'false' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '*' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '127.0.0.1/33' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '::1/129' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '127.0.0.1/abc' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: 'not-an-ip' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: '127.0.0.1,,10.0.0.1' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
    expect(() => loadApiRuntimeConfig({ ...base, TRUSTED_PROXY_CIDRS: ',' })).toThrow(/TRUSTED_PROXY_CIDRS_INVALID/);
  });
});
