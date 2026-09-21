import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerAuthenticationBoundary } from '../../src/auth/authentication-boundary.js';
import { TestAuthenticationAdapter } from '../support/test-authentication-adapter.js';

const apps: ReturnType<typeof Fastify>[] = [];
const createApp = () => {
  const app = Fastify({ logger: false });
  apps.push(app);
  registerAuthenticationBoundary(app, new TestAuthenticationAdapter());
  app.get('/public', { config: { auth: { mode: 'public' } } }, async () => ({ ok: true }));
  app.get('/workshop', {
    config: { auth: { mode: 'authenticated', audience: 'workshop', principalKinds: ['workshop_user'] } },
  }, async (request) => ({ kind: request.principal?.kind }));
  app.get('/platform', {
    config: { auth: { mode: 'authenticated', audience: 'platform', principalKinds: ['platform_user'] } },
  }, async (request) => ({ kind: request.principal?.kind }));
  app.get('/provider', {
    config: { auth: { mode: 'authenticated', audience: 'provider', principalKinds: ['service'] } },
  }, async (request) => ({ kind: request.principal?.kind }));
  app.get('/missing-policy', async () => ({ unsafe: true }));
  return app;
};

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('authentication boundary', () => {
  it('allows only explicitly public routes without credentials', async () => {
    const app = createApp();
    expect((await app.inject('/public')).statusCode).toBe(200);
    const missingPolicy = await app.inject('/missing-policy');
    expect(missingPolicy.statusCode).toBe(500);
    expect(missingPolicy.json()).toEqual({ error: 'ROUTE_SECURITY_POLICY_MISSING' });
  });

  it('fails closed when credentials are absent or the adapter fails', async () => {
    const app = createApp();
    for (const authorization of [undefined, 'Bearer explode']) {
      const response = await app.inject({ url: '/workshop', headers: authorization ? { authorization } : {} });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'AUTHENTICATION_REQUIRED' });
    }
  });

  it('keeps Workshop and Platform audiences separated', async () => {
    const app = createApp();
    const workshop = await app.inject({ url: '/workshop', headers: { authorization: 'Bearer workshop' } });
    expect(workshop.statusCode).toBe(200);
    expect(workshop.json()).toEqual({ kind: 'workshop_user' });

    const platform = await app.inject({ url: '/platform', headers: { authorization: 'Bearer platform' } });
    expect(platform.statusCode).toBe(200);
    expect(platform.json()).toEqual({ kind: 'platform_user' });

    expect((await app.inject({ url: '/platform', headers: { authorization: 'Bearer workshop' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/workshop', headers: { authorization: 'Bearer platform' } })).statusCode).toBe(403);
  });

  it('accepts a service principal only on the provider audience', async () => {
    const app = createApp();
    const provider = await app.inject({ url: '/provider', headers: { authorization: 'Bearer provider' } });
    expect(provider.statusCode).toBe(200);
    expect(provider.json()).toEqual({ kind: 'service' });
    expect((await app.inject({ url: '/workshop', headers: { authorization: 'Bearer provider' } })).statusCode).toBe(403);
  });

  it('cannot construct the deterministic test adapter in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try { expect(() => new TestAuthenticationAdapter()).toThrow('forbidden in production'); }
    finally { process.env.NODE_ENV = previous; }
  });
});
