import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { claimInboxEvent, inAuthorizedProviderTransaction, ProviderAuthorizationError } from '../../src/auth/provider-authorization.js';
import type { ServicePrincipal } from '../../src/auth/principal.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const ids = {
  tenantA: randomUUID(), tenantB: randomUUID(), workshopA: randomUUID(), workshopB: randomUUID(),
  endpointA: randomUUID(), endpointB: randomUUID(), principal: randomUUID(), binding: randomUUID(),
};
const accountId = `AC-${randomUUID()}`;
const otherAccountId = `AC-${randomUUID()}`;
const principal: ServicePrincipal = {
  kind: 'service', audience: 'provider', serviceId: ids.principal, externalAccountId: accountId,
  serviceType: 'telephony_provider', authenticatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name) VALUES($1,'Provider A'),($2,'Provider B')", [ids.tenantA, ids.tenantB]);
  await inTenantTransaction(pool, ids.tenantA, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Workshop A')", [ids.workshopA, ids.tenantA]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'twilio',$4,'+34944000001')", [ids.endpointA, ids.tenantA, ids.workshopA, accountId]);
  });
  await inTenantTransaction(pool, ids.tenantB, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Workshop B')", [ids.workshopB, ids.tenantB]);
    await client.query("INSERT INTO channel_endpoints(id,tenant_id,workshop_id,provider,external_account_id,called_endpoint) VALUES($1,$2,$3,'twilio',$4,'+34944000002')", [ids.endpointB, ids.tenantB, ids.workshopB, otherAccountId]);
  });
  await pool.query(
    "INSERT INTO service_principals(id,provider,service_type,external_account_id,credential_ref) VALUES($1,'twilio','telephony_provider',$2,'secret://twilio/p0-4')",
    [ids.principal, accountId],
  );
  await pool.query(
    'INSERT INTO provider_bindings(id,service_principal_id,tenant_id,workshop_id,channel_endpoint_id) VALUES($1,$2,$3,$4,$5)',
    [ids.binding, ids.principal, ids.tenantA, ids.workshopA, ids.endpointA],
  );
});

afterAll(async () => { await pool.end(); });

describe('provider binding authorization and replay guard', () => {
  it('derives tenant from the authenticated principal plus called endpoint', async () => {
    const result = await inAuthorizedProviderTransaction(pool, {
      principal, provider: 'twilio', calledEndpoint: '+34944000001', correlationId: 'twilio:CA1',
    }, async (client, context) => {
      const tenants = await client.query('SELECT tenant_id FROM channel_endpoints');
      return { context, visibleTenantIds: tenants.rows.map((row) => row.tenant_id) };
    });
    expect(result.context).toMatchObject({ tenantId: ids.tenantA, workshopId: ids.workshopA });
    expect(result.visibleTenantIds).toEqual([ids.tenantA]);
  });

  it('does not cross tenant when the called endpoint is manipulated', async () => {
    await expect(inAuthorizedProviderTransaction(pool, {
      principal, provider: 'twilio', calledEndpoint: '+34944000002', correlationId: 'twilio:CA2',
    }, async () => null)).rejects.toMatchObject({ code: 'ENDPOINT_NOT_RESOLVED' });
  });

  it('deduplicates byte-identical events and rejects conflicting replay', async () => {
    const run = (rawBody: string) => inAuthorizedProviderTransaction(pool, {
      principal, provider: 'twilio', calledEndpoint: '+34944000001', correlationId: 'twilio:CA3',
    }, (client, context) => claimInboxEvent(client, {
      context, principal, provider: 'twilio', externalEventId: 'CA3:ring:0', rawBody,
    }));
    await expect(run('same')).resolves.toBe('claimed');
    await expect(run('same')).resolves.toBe('duplicate');
    await expect(run('altered')).rejects.toBeInstanceOf(ProviderAuthorizationError);
  });

  it('fails closed for a suspended service principal', async () => {
    await pool.query("UPDATE service_principals SET status='suspended' WHERE id=$1", [ids.principal]);
    await expect(inAuthorizedProviderTransaction(pool, {
      principal, provider: 'twilio', calledEndpoint: '+34944000001', correlationId: 'twilio:CA4',
    }, async () => null)).rejects.toMatchObject({ code: 'PROVIDER_NOT_ALLOWED' });
    await pool.query("UPDATE service_principals SET status='active' WHERE id=$1", [ids.principal]);
  });
});
