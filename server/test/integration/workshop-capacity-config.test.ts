import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';
import { testWorkshopCapacityPolicy } from '../support/workshop-capacity.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), otherTenant: randomUUID(), workshop: randomUUID(), otherWorkshop: randomUUID(),
  owner: randomUUID(), manager: randomUUID(), reception: randomUUID(), customer: randomUUID(), vehicle: randomUUID() };
const principal = (userId: string): PrincipalContext => ({ kind: 'workshop_user', audience: 'workshop', userId,
  issuer: 'test', subject: userId, sessionId: randomUUID(), authenticatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(), assurance: 'single_factor' });
const authentication: AuthenticationAdapter = { async authenticate(request) {
  if (request.authorization === 'Bearer owner') return principal(ids.owner);
  if (request.authorization === 'Bearer manager') return principal(ids.manager);
  if (request.authorization === 'Bearer reception') return principal(ids.reception);
  return null;
} };
const app = buildApi(pool, { authentication, piiProtection: pii });
const openingHours = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index + 1), [{ start: '00:00', end: '23:59' }]]));
const durationPolicy = { version: 'duration-v1', rules: { oil_service: 45 }, fallbackMinutes: null };

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Capacity config','pilot'),($2,'Other capacity','pilot')", [ids.tenant, ids.otherTenant]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active'),($2,'active'),($3,'active')", [ids.owner, ids.manager, ids.reception]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$4,'OWNER'),($2,$4,'MANAGER'),($3,$4,'RECEPTION')", [ids.owner, ids.manager, ids.reception, ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours,service_duration_policy,capacity_policy) VALUES($1,$2,'Configured','UTC',$3,$4,$5)",
      [ids.workshop, ids.tenant, JSON.stringify(openingHours), JSON.stringify(durationPolicy), JSON.stringify(testWorkshopCapacityPolicy)]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Capacity Customer' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '4321 CAP' });
    await client.query('INSERT INTO customer_vehicle_roles(tenant_id,customer_id,vehicle_id) VALUES($1,$2,$3)', [ids.tenant, ids.customer, ids.vehicle]);
  });
  await inTenantTransaction(pool, ids.otherTenant, (client) => client.query(
    "INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Other')", [ids.otherWorkshop, ids.otherTenant],
  ));
  await app.ready();
});

afterAll(async () => { await app.close(); await pool.end(); });

describe('Workshop capacity configuration contract', () => {
  it('allows OWNER/MANAGER, rejects RECEPTION, isolates tenant and enforces versioned idempotency', async () => {
    const url = `/v1/workshop/tenants/${ids.tenant}/workshops/${ids.workshop}/capacity`;
    const read = await app.inject({ url, headers: { authorization: 'Bearer owner' } });
    expect(read.statusCode).toBe(200);
    expect(read.json().data).toMatchObject({ version: 1, vehiclesCurrentlyOnSite: 0 });
    expect((await app.inject({ url, headers: { authorization: 'Bearer manager' } })).statusCode).toBe(200);
    expect((await app.inject({ url, headers: { authorization: 'Bearer reception' } })).statusCode).toBe(403);
    expect((await app.inject({ url: `/v1/workshop/tenants/${ids.otherTenant}/workshops/${ids.otherWorkshop}/capacity`,
      headers: { authorization: 'Bearer owner' } })).statusCode).toBe(403);

    const payload = { expectedVersion: 1, idempotencyKey: `capacity-${randomUUID()}`, openingHours,
      serviceDurationPolicy: durationPolicy,
      capacityPolicy: { ...testWorkshopCapacityPolicy, version: 'configured-v2', liftCount: 4 } };
    const updated = await app.inject({ method: 'PATCH', url, headers: { authorization: 'Bearer owner' }, payload });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({ version: 2, capacity_policy: { version: 'configured-v2', liftCount: 4 } });
    const replay = await app.inject({ method: 'PATCH', url, headers: { authorization: 'Bearer owner' }, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.version).toBe(2);
    const conflict = await app.inject({ method: 'PATCH', url, headers: { authorization: 'Bearer owner' },
      payload: { ...payload, capacityPolicy: { ...payload.capacityPolicy, liftCount: 5 } } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('keeps duration and wait mode server-authoritative and derives vehiclesCurrentlyOnSite from Appointment lifecycle', async () => {
    const start = new Date(Date.now() + 3 * 86_400_000); start.setUTCMinutes(0, 0, 0);
    const created = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
      headers: { authorization: 'Bearer manager' }, payload: { idempotencyKey: `appointment-${randomUUID()}`,
        startAt: start.toISOString(), durationMinutes: 120, serviceIntent: 'oil_service', customerWaitMode: 'WAIT_ON_SITE',
        customerId: ids.customer, vehicleId: ids.vehicle } });
    expect(created.statusCode).toBe(201);
    const appointment = created.json().data;
    expect(new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime()).toBe(45 * 60_000);
    expect(appointment.customer_wait_mode).toBe('WAIT_ON_SITE');
    const status = await app.inject({ method: 'PATCH', url: `/v1/workshop/tenants/${ids.tenant}/appointments/${appointment.id}/status`,
      headers: { authorization: 'Bearer manager' }, payload: { status: 'on_site', expectedVersion: appointment.version,
        idempotencyKey: `status-${randomUUID()}` } });
    expect(status.statusCode).toBe(200);
    const capacity = await app.inject({ url: `/v1/workshop/tenants/${ids.tenant}/workshops/${ids.workshop}/capacity`,
      headers: { authorization: 'Bearer owner' } });
    expect(capacity.json().data.vehiclesCurrentlyOnSite).toBe(1);
  });
});
