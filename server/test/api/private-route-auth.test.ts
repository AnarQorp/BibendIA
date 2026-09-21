import type pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app.js';
import { TestAuthenticationAdapter } from '../support/test-authentication-adapter.js';

const apps: ReturnType<typeof buildApi>[] = [];
const pool = {} as pg.Pool;
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('API private route policy', () => {
  it('keeps health public and all domain routes private by default', async () => {
    const app = buildApi(pool);
    apps.push(app);
    expect((await app.inject('/health')).statusCode).toBe(200);
    expect((await app.inject('/v1/appointments')).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/v1/voice/tools/create-appointment', payload: {} })).statusCode).toBe(401);
  });

  it('rejects a Workshop principal at the provider tool boundary', async () => {
    const app = buildApi(pool, { authentication: new TestAuthenticationAdapter() });
    apps.push(app);
    const response = await app.inject({
      method: 'POST', url: '/v1/voice/tools/create-appointment', payload: {},
      headers: { authorization: 'Bearer workshop' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'PRINCIPAL_NOT_ALLOWED' });
  });

  it('allows an authenticated provider to reach domain validation', async () => {
    const app = buildApi(pool, { authentication: new TestAuthenticationAdapter() });
    apps.push(app);
    const response = await app.inject({
      method: 'POST', url: '/v1/voice/tools/create-appointment', payload: {},
      headers: { authorization: 'Bearer provider' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ ok: false, code: 'VALIDATION' });
  });

  it('emits CORS permission only for an explicitly allowed origin', async () => {
    const app = buildApi(pool, { allowedOrigins: ['https://app.bibendia.test', 'https://admin.bibendia.test'] });
    apps.push(app);
    const allowed = await app.inject({ url: '/health', headers: { origin: 'https://app.bibendia.test' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.bibendia.test');
    const rejected = await app.inject({ url: '/health', headers: { origin: 'https://attacker.example' } });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });
});
