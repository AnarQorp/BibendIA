import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { inAuthorizedTenantTransaction } from '../../src/auth/tenant-authorization.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { changeTenantLifecycle, setTenantKillSwitch } from '../../src/modules/tenant-control/tenant-control.js';
import { claimOutboxBatch, publishClaimedOutboxEvent } from '../../src/worker/outbox.js';

const pool = createPool('migrator');
const ids = {
  tenantA: randomUUID(), tenantB: randomUUID(),
  adminA: randomUUID(), readonlyA: randomUUID(), auditorA: randomUUID(), workshopA: randomUUID(),
};
const future = new Date(Date.now() + 60 * 60_000).toISOString();
const authenticatedAt = new Date().toISOString();

function platform(userId: string): PrincipalContext {
  return { kind: 'platform_user', audience: 'platform', userId, issuer: 'test', subject: userId,
    sessionId: randomUUID(), authenticatedAt, expiresAt: future, assurance: 'mfa' };
}
function workshop(userId: string): PrincipalContext {
  return { kind: 'workshop_user', audience: 'workshop', userId, issuer: 'test', subject: userId,
    sessionId: randomUUID(), authenticatedAt, expiresAt: future, assurance: 'single_factor' };
}
const principals = new Map<string, PrincipalContext>([
  ['Bearer admin-a', platform(ids.adminA)],
  ['Bearer readonly-a', platform(ids.readonlyA)],
  ['Bearer auditor-a', platform(ids.auditorA)],
  ['Bearer workshop-a', workshop(ids.workshopA)],
]);
const authentication: AuthenticationAdapter = {
  async authenticate(request) { return request.authorization ? principals.get(request.authorization) ?? null : null; },
};
const app = buildApi(pool, { authentication });

beforeAll(async () => {
  await pool.query('RESET ROLE');
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Lifecycle A','pilot'),($2,'Lifecycle B','pilot')", [ids.tenantA, ids.tenantB]);
  await pool.query(`INSERT INTO users(id,status,display_name) VALUES
    ($1,'active','Admin A'),($2,'active','Readonly A'),($3,'active','Auditor A'),($4,'active','Workshop A')`,
    [ids.adminA, ids.readonlyA, ids.auditorA, ids.workshopA]);
  await pool.query(`INSERT INTO platform_access_grants(user_id,role,scope_type,tenant_id) VALUES
    ($1,'PLATFORM_ADMIN','tenant',$4),($2,'SUPPORT_READONLY','tenant',$4),($3,'SECURITY_AUDITOR','tenant',$4)`,
    [ids.adminA, ids.readonlyA, ids.auditorA, ids.tenantA]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'OWNER')", [ids.workshopA, ids.tenantA]);
  await app.ready();
});

beforeEach(async () => {
  await pool.query('RESET ROLE');
  await pool.query('DELETE FROM tenant_control_events WHERE tenant_id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.query("DELETE FROM audit_events WHERE tenant_id IN ($1,$2) AND event_type IN ('lifecycle_changed','kill_switch_changed')", [ids.tenantA, ids.tenantB]);
  await pool.query('DELETE FROM outbox_events WHERE tenant_id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.query(`UPDATE tenants SET lifecycle_status='pilot',lifecycle_updated_at=NULL,lifecycle_updated_by_type=NULL,
    lifecycle_updated_by_id=NULL,lifecycle_reason=NULL,kill_switch_enabled=false,kill_switch_updated_at=NULL,
    kill_switch_updated_by_type=NULL,kill_switch_updated_by_id=NULL,kill_switch_reason=NULL,control_version=1
    WHERE id IN ($1,$2)`, [ids.tenantA, ids.tenantB]);
});

afterAll(async () => {
  await app.close();
  await pool.query('RESET ROLE');
  await pool.query('DELETE FROM tenant_control_events WHERE tenant_id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.query('DELETE FROM audit_events WHERE tenant_id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.query('DELETE FROM outbox_events WHERE tenant_id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.query('DELETE FROM tenant_memberships WHERE user_id=$1', [ids.workshopA]);
  await pool.query('DELETE FROM platform_access_grants WHERE user_id=ANY($1::uuid[])', [[ids.adminA, ids.readonlyA, ids.auditorA]]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[ids.adminA, ids.readonlyA, ids.auditorA, ids.workshopA]]);
  await pool.query('DELETE FROM tenants WHERE id IN ($1,$2)', [ids.tenantA, ids.tenantB]);
  await pool.end();
});

function request(method: 'GET' | 'POST', path: string, token: string, payload?: object, extraHeaders?: Record<string, string>) {
  return app.inject({ method, url: path, payload, headers: { authorization: token, ...extraHeaders } });
}

async function kill(enabled: boolean, expectedVersion = 1) {
  return inAuthorizedTenantTransaction(pool, {
    principal: platform(ids.adminA), requestedTenantId: ids.tenantA,
    capability: 'platform:kill-switch:manage', correlationId: randomUUID(),
  }, (client, context) => setTenantKillSwitch(client, context, {
    enabled, expectedVersion, reason: enabled ? 'Pause autonomous effects' : 'Resume safe operation',
    idempotencyKey: randomUUID(),
  }));
}

describe('P0.5 tenant lifecycle and kill switch', () => {
  it('lets scoped readonly inspect A but never mutate A or inspect B', async () => {
    expect((await request('GET', `/v1/platform/tenants/${ids.tenantA}/control`, 'Bearer readonly-a')).statusCode).toBe(200);
    expect((await request('GET', `/v1/platform/tenants/${ids.tenantB}/control`, 'Bearer readonly-a')).statusCode).toBe(403);
    expect((await request('POST', `/v1/platform/tenants/${ids.tenantA}/kill-switch/enable`, 'Bearer readonly-a', {
      reason: 'Not authorized', idempotencyKey: randomUUID(), expectedVersion: 1,
    })).statusCode).toBe(403);
  });

  it('denies Workshop, capability-less Platform, and cross-scope control commands', async () => {
    const command = { reason: 'Attempted control change', idempotencyKey: randomUUID(), expectedVersion: 1 };
    expect((await request('POST', `/v1/platform/tenants/${ids.tenantA}/kill-switch/enable`, 'Bearer workshop-a', command)).statusCode).toBe(403);
    expect((await request('POST', `/v1/platform/tenants/${ids.tenantA}/kill-switch/enable`, 'Bearer auditor-a', command)).statusCode).toBe(403);
    expect((await request('POST', `/v1/platform/tenants/${ids.tenantB}/kill-switch/enable`, 'Bearer admin-a', command)).statusCode).toBe(403);
  });

  it('suspends A without affecting B and records immutable control plus Action Ledger evidence', async () => {
    const correlationId = randomUUID();
    const receipt = await inAuthorizedTenantTransaction(pool, {
      principal: platform(ids.adminA), requestedTenantId: ids.tenantA,
      capability: 'platform:tenant:update', correlationId,
    }, (client, context) => changeTenantLifecycle(client, context, {
      target: 'suspended', reason: 'Pilot safety pause', idempotencyKey: randomUUID(), expectedVersion: 1,
    }));
    expect(receipt).toMatchObject({ eventType: 'lifecycle_changed', lifecycleFrom: 'pilot', lifecycleTo: 'suspended', version: 2 });

    const a = await request('GET', `/v1/workshop/tenants/${ids.tenantA}/appointments`, 'Bearer workshop-a');
    expect(a.statusCode).toBe(200); // retained read access
    await expect(inTenantTransaction(pool, ids.tenantA, (client) =>
      client.query("SELECT lifecycle_status FROM tenants WHERE id=$1", [ids.tenantA]))).resolves.toMatchObject({ rows: [{ lifecycle_status: 'suspended' }] });
    await expect(inTenantTransaction(pool, ids.tenantB, (client) =>
      client.query("SELECT lifecycle_status FROM tenants WHERE id=$1", [ids.tenantB]))).resolves.toMatchObject({ rows: [{ lifecycle_status: 'pilot' }] });

    const evidence = await pool.query(`SELECT c.lifecycle_from,c.lifecycle_to,c.reason,c.actor_id,c.correlation_id,a.evidence_ref
      FROM tenant_control_events c JOIN audit_events a ON a.tenant_id=c.tenant_id AND a.correlation_id=c.correlation_id
      WHERE c.tenant_id=$1`, [ids.tenantA]);
    expect(evidence.rows[0]).toMatchObject({ lifecycle_from: 'pilot', lifecycle_to: 'suspended', reason: 'Pilot safety pause', actor_id: ids.adminA, correlation_id: correlationId });
    expect(evidence.rows[0].evidence_ref).toMatch(/^postgres:tenant-control-event:/);
  });

  it('ignores hostile lifecycle/kill metadata and restores only what current lifecycle permits', async () => {
    const enabled = await request('POST', `/v1/platform/tenants/${ids.tenantA}/kill-switch/enable`, 'Bearer admin-a', {
      reason: 'Immediate pilot pause', idempotencyKey: randomUUID(), expectedVersion: 1,
      tenantId: ids.tenantB, lifecycle: 'active', enabled: false,
    }, { 'x-tenant-id': ids.tenantB, 'x-tenant-lifecycle': 'active' });
    // Strict schema rejects client attempts to smuggle control fields.
    expect(enabled.statusCode).toBe(400);
    expect((await request('GET', `/v1/platform/tenants/${ids.tenantA}/control`, 'Bearer admin-a')).json().data.killSwitch.enabled).toBe(false);

    await kill(true);
    const disabled = await kill(false, 2);
    expect(disabled).toMatchObject({ killSwitchFrom: true, killSwitchTo: false, version: 3 });
    await pool.query("UPDATE tenants SET lifecycle_status='suspended' WHERE id=$1", [ids.tenantA]);
    const state = await request('GET', `/v1/platform/tenants/${ids.tenantA}/control`, 'Bearer admin-a');
    expect(state.json().data).toMatchObject({ lifecycle: 'suspended', killSwitch: { enabled: false } });
  });

  it('keeps B claimable while A kill switch is active', async () => {
    for (const tenantId of [ids.tenantA, ids.tenantB]) {
      await inTenantTransaction(pool, tenantId, (client) => client.query(
        "INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb) VALUES($1,'tenant',$1,'test.effect','{}')", [tenantId],
      ));
    }
    await kill(true);
    expect(await claimOutboxBatch(pool, ids.tenantA)).toHaveLength(0);
    expect(await claimOutboxBatch(pool, ids.tenantB)).toHaveLength(1);
  });

  it('revalidates an already-claimed Outbox event before its external effect', async () => {
    await inTenantTransaction(pool, ids.tenantA, (client) => client.query(
      "INSERT INTO outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload_jsonb) VALUES($1,'tenant',$1,'test.effect','{}')", [ids.tenantA],
    ));
    const [claimed] = await claimOutboxBatch(pool, ids.tenantA);
    expect(claimed).toBeTruthy();
    await kill(true);
    let effectExecuted = false;
    await expect(publishClaimedOutboxEvent(pool, ids.tenantA, claimed.id, async () => {
      effectExecuted = true;
    })).rejects.toMatchObject({ code: 'KILL_SWITCH_ENABLED' });
    expect(effectExecuted).toBe(false);
  });

  it('keeps tenant control records isolated under RLS', async () => {
    await kill(true);
    const visibleFromB = await inTenantTransaction(pool, ids.tenantB, (client) =>
      client.query('SELECT tenant_id FROM tenant_control_events'));
    expect(visibleFromB.rowCount).toBe(0);
  });
});
