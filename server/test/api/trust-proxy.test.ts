import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { buildApi } from '../../src/api/app.js';
import { testPiiProtection } from '../support/test-pii.js';

// Dummy pool for routes that do not need DB access
const dummyPool = {} as pg.Pool;

describe('Fastify restrictive trust proxy', () => {
  // Test 1: Sin configuración
  it('1. without trust proxy configuration, XFF never alters request.ip', async () => {
    const app = buildApi(dummyPool);
    app.get('/test-ip', { config: { auth: { mode: 'public' } } }, (req) => ({ ip: req.ip }));

    const res = await app.inject({
      method: 'GET',
      url: '/test-ip',
      headers: { 'x-forwarded-for': '203.0.113.195' },
      remoteAddress: '127.0.0.1',
    });

    expect(res.statusCode).toBe(200);
    // Remote peer is 127.0.0.1, XFF header is ignored
    expect(res.json()).toEqual({ ip: '127.0.0.1' });
    await app.close();
  });

  // Test 2: Peer confiable
  it('2. when request originates from a trusted peer, client IP carried by proxy is reflected in request.ip', async () => {
    const app = buildApi(dummyPool, {
      trustProxy: ['127.0.0.1', '10.0.0.0/8'],
    });
    app.get('/test-ip', { config: { auth: { mode: 'public' } } }, (req) => ({ ip: req.ip }));

    // Single hop proxy
    const res1 = await app.inject({
      method: 'GET',
      url: '/test-ip',
      headers: { 'x-forwarded-for': '203.0.113.195' },
      remoteAddress: '127.0.0.1',
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ ip: '203.0.113.195' });

    // Multi-hop proxy within trusted CIDR (10.0.0.5 is trusted, 198.51.100.22 is client)
    const res2 = await app.inject({
      method: 'GET',
      url: '/test-ip',
      headers: { 'x-forwarded-for': '198.51.100.22, 10.0.0.5' },
      remoteAddress: '127.0.0.1',
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ ip: '198.51.100.22' });

    await app.close();
  });

  // Test 3: Peer no confiable
  it('3. when request originates from an untrusted peer, forged XFF never alters request.ip', async () => {
    const app = buildApi(dummyPool, {
      trustProxy: ['127.0.0.1'],
    });
    app.get('/test-ip', { config: { auth: { mode: 'public' } } }, (req) => ({ ip: req.ip }));

    const res = await app.inject({
      method: 'GET',
      url: '/test-ip',
      headers: { 'x-forwarded-for': '203.0.113.195' },
      remoteAddress: '198.51.100.99', // Untrusted peer attempting to spoof
    });

    expect(res.statusCode).toBe(200);
    // Peer is not trusted -> XFF is ignored, binds strictly to socket remote address
    expect(res.json()).toEqual({ ip: '198.51.100.99' });
    await app.close();
  });

  // Test 4: Configuración IP/CIDR inválida
  it('4. startup fails closed if given an invalid IP or CIDR configuration', () => {
    // Fastify native constructor throws when given invalid IP/CIDR
    expect(() => buildApi(dummyPool, { trustProxy: ['invalid-ip'] })).toThrow(/invalid IP address/i);
    expect(() => buildApi(dummyPool, { trustProxy: ['127.0.0.1/33'] })).toThrow(/invalid range/i);
    expect(() => buildApi(dummyPool, { trustProxy: ['true'] })).toThrow(/invalid IP address/i);
  });

  // Test 5: Public Lead rate-limiting and fingerprinting
  describe('5. Public Lead rate-limiting and fingerprinting behind trusted proxy', () => {
    function createMockLeadPool() {
      // In-memory rate-limit tracking: map of "tenant:clientFingerprint:window" -> count
      const rateLimits = new Map<string, number>();
      const recordedLeads: Array<{ clientIdentity: string; fingerprint: string }> = [];

      const mockClient = {
        async query(sql: string, params: unknown[] = []) {
          const s = sql.trim().toUpperCase();
          if (s === 'BEGIN' || s.startsWith('SET LOCAL ROLE') || s.startsWith('SELECT SET_CONFIG') || s === 'COMMIT' || s === 'ROLLBACK') {
            return { rowCount: 1, rows: [] };
          }
          if (s.startsWith('SELECT ID FROM TENANTS')) {
            return { rowCount: 1, rows: [{ id: params[0] }] };
          }
          if (s.startsWith('INSERT INTO PUBLIC_LEAD_RATE_LIMITS')) {
            const tenantId = String(params[0]);
            const clientFingerprint = String(params[1]);
            const key = `${tenantId}:${clientFingerprint}`;
            const current = (rateLimits.get(key) ?? 0) + 1;
            rateLimits.set(key, current);
            return { rowCount: 1, rows: [{ accepted_count: current }] };
          }
          if (s.startsWith('SELECT ID,CORRELATION_ID FROM PUBLIC_LEADS')) {
            return { rowCount: 0, rows: [] };
          }
          if (s.startsWith('INSERT INTO PUBLIC_LEADS')) {
            recordedLeads.push({
              clientIdentity: '',
              fingerprint: String(params[26]),
            });
            return { rowCount: 1, rows: [] };
          }
          if (s.startsWith('INSERT INTO AUDIT_EVENTS') || s.startsWith('INSERT INTO OUTBOX_EVENTS')) {
            return { rowCount: 1, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        },
        release() {},
      };

      const mockPool = {
        async connect() {
          return mockClient;
        },
      } as unknown as pg.Pool;

      return { mockPool, rateLimits, recordedLeads };
    }

    const testTenant = '11111111-2222-4333-8444-555555555555';
    const validLeadPayload = {
      workshop: 'Taller Autocontrol',
      contactName: 'Laura Vega',
      phone: '+34 611 222 333',
      email: 'laura@example.com',
      message: 'Consulta sobre diagnóstico de frenos',
      website: '',
    };

    it('uses correct resolved IP for fingerprint, separates different clients, and blocks XFF spoofing from untrusted peers', async () => {
      const { mockPool, rateLimits } = createMockLeadPool();
      const pii = testPiiProtection();
      const trustedProxyPeer = '127.0.0.1';

      // Configure app with trusted proxy and rate limit of 2 requests per window
      const app = buildApi(mockPool, {
        piiProtection: pii,
        trustProxy: [trustedProxyPeer],
        publicLead: { tenantId: testTenant, rateLimit: 2 },
      });

      // 5.1 Different clients behind trusted proxy do NOT share rate-limit bucket
      // Client 1 (203.0.113.1) sends 2 leads through proxy
      const c1_req1 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Client 1 A' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1',
        },
        remoteAddress: trustedProxyPeer,
      });
      expect(c1_req1.statusCode).toBe(202);

      const c1_req2 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Client 1 B' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1',
        },
        remoteAddress: trustedProxyPeer,
      });
      expect(c1_req2.statusCode).toBe(202);

      // Client 2 (203.0.113.2) sends a lead through the same proxy
      // Even though remoteAddress is identical (127.0.0.1), Client 2 has its own bucket and succeeds!
      const c2_req1 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Client 2 A' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.2',
        },
        remoteAddress: trustedProxyPeer,
      });
      expect(c2_req1.statusCode).toBe(202);

      // Client 1 sends a 3rd request -> rate limited (exceeds rateLimit: 2)
      const c1_req3 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Client 1 C' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1',
        },
        remoteAddress: trustedProxyPeer,
      });
      expect(c1_req3.statusCode).toBe(429);
      expect(c1_req3.json()).toMatchObject({ error: 'TOO_MANY_REQUESTS' });

      // Verify that rateLimits map has distinct buckets for Client 1 and Client 2
      const client1Hash = pii.activeLookupDigest(testTenant, 'public_lead.client', '203.0.113.1').digest;
      const client2Hash = pii.activeLookupDigest(testTenant, 'public_lead.client', '203.0.113.2').digest;
      expect(rateLimits.get(`${testTenant}:${client1Hash}`)).toBe(3);
      expect(rateLimits.get(`${testTenant}:${client2Hash}`)).toBe(1);

      // 5.2 XFF spoofing from untrusted peer cannot bypass rate-limiting
      // Attacker connects directly from untrusted peer 198.51.100.77
      // Attacker tries to rotate X-Forwarded-For headers to evade rate-limiting
      const spoof_req1 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Spoof 1' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '1.1.1.1', // fake spoofed IP
        },
        remoteAddress: '198.51.100.77', // untrusted remote peer
      });
      expect(spoof_req1.statusCode).toBe(202);

      const spoof_req2 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Spoof 2' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '2.2.2.2', // different fake IP
        },
        remoteAddress: '198.51.100.77',
      });
      expect(spoof_req2.statusCode).toBe(202);

      // 3rd request from attacker with another fake IP:
      // Fastify ignores XFF because peer 198.51.100.77 is untrusted.
      // Rate-limit hits based on 198.51.100.77 -> blocked with 429!
      const spoof_req3 = await app.inject({
        method: 'POST',
        url: '/public/leads',
        payload: { ...validLeadPayload, contactName: 'Spoof 3' },
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '3.3.3.3', // another fake IP
        },
        remoteAddress: '198.51.100.77',
      });
      expect(spoof_req3.statusCode).toBe(429);
      expect(spoof_req3.json()).toMatchObject({ error: 'TOO_MANY_REQUESTS' });

      // Confirm that the attacker's requests were all attributed to 198.51.100.77
      const attackerHash = pii.activeLookupDigest(testTenant, 'public_lead.client', '198.51.100.77').digest;
      expect(rateLimits.get(`${testTenant}:${attackerHash}`)).toBe(3);

      await app.close();
    });
  });
});
