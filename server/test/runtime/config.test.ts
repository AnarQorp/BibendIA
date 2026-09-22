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

  it('keeps Worker disabled by default and refuses enablement without an approved adapter', () => {
    expect(loadWorkerRuntimeConfig(base).mode).toBe('disabled');
    expect(() => loadWorkerRuntimeConfig({ ...base, WORKER_MODE: 'enabled' })).toThrow(/WORKER_ADAPTER_NOT_CONFIGURED/);
  });
});
