import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import type { TenantContext } from '../../src/domain/ids.js';
import { findSlots } from '../../src/modules/scheduling/postgres-scheduling.js';
import { resolveCapacityRequirements } from '../../src/modules/scheduling/workshop-capacity-policy.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';
import { testWorkshopCapacityPolicy } from '../support/workshop-capacity.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), otherTenant: randomUUID(), workshop: randomUUID(), otherWorkshop: randomUUID(),
  bootstrapTenant: randomUUID(), bootstrapWorkshop: randomUUID(),
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
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Capacity config','pilot'),($2,'Other capacity','pilot'),($3,'Bootstrap capacity','pilot')", [ids.tenant, ids.otherTenant, ids.bootstrapTenant]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active'),($2,'active'),($3,'active')", [ids.owner, ids.manager, ids.reception]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$4,'OWNER'),($2,$4,'MANAGER'),($3,$4,'RECEPTION'),($1,$5,'OWNER')", [ids.owner, ids.manager, ids.reception, ids.tenant, ids.bootstrapTenant]);
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
  await inTenantTransaction(pool, ids.bootstrapTenant, (client) => client.query(
    "INSERT INTO workshops(id,tenant_id,name,timezone) VALUES($1,$2,'Fresh workshop','UTC')", [ids.bootstrapWorkshop, ids.bootstrapTenant],
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

    // Complete lifecycle: in_progress -> completed -> delivered
    const inProgress = await app.inject({
      method: 'PATCH',
      url: `/v1/workshop/tenants/${ids.tenant}/appointments/${appointment.id}/status`,
      headers: { authorization: 'Bearer manager' },
      payload: { status: 'in_progress', expectedVersion: 2, idempotencyKey: `status-${randomUUID()}` }
    });
    expect(inProgress.statusCode).toBe(200);

    const completed = await app.inject({
      method: 'PATCH',
      url: `/v1/workshop/tenants/${ids.tenant}/appointments/${appointment.id}/status`,
      headers: { authorization: 'Bearer manager' },
      payload: { status: 'completed', expectedVersion: 3, idempotencyKey: `status-${randomUUID()}` }
    });
    expect(completed.statusCode).toBe(200);

    const delivered = await app.inject({
      method: 'PATCH',
      url: `/v1/workshop/tenants/${ids.tenant}/appointments/${appointment.id}/status`,
      headers: { authorization: 'Bearer manager' },
      payload: { status: 'delivered', expectedVersion: 4, idempotencyKey: `status-${randomUUID()}` }
    });
    expect(delivered.statusCode).toBe(200);

    // Live occupancy must now drop to 0
    const finalCapacity = await app.inject({
      url: `/v1/workshop/tenants/${ids.tenant}/workshops/${ids.workshop}/capacity`,
      headers: { authorization: 'Bearer owner' }
    });
    expect(finalCapacity.json().data.vehiclesCurrentlyOnSite).toBe(0);
  });

  it('exposes GET /v1/workshop/tenants/:tenantId/workshops for workshop audience', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workshop/tenants/${ids.tenant}/workshops`,
      headers: { authorization: 'Bearer manager' }
    });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.data).toContainEqual({ id: ids.workshop, tenant_id: ids.tenant, name: 'Configured', timezone: 'UTC', version: expect.any(Number) });
    expect(Object.keys(json.data[0]).sort()).toEqual(['id','name','tenant_id','timezone','version']);
  });

  it('bootstraps canonical resources for a new workshop and becomes schedulable after physical configuration', async () => {
    const migrated = await pool.query('SELECT capacity_policy FROM workshops WHERE id=$1', [ids.otherWorkshop]);
    const raw = await pool.query('SELECT capacity_policy FROM workshops WHERE id=$1', [ids.bootstrapWorkshop]);
    const resources = raw.rows[0].capacity_policy.resourceRequirements;
    expect(migrated.rows[0].capacity_policy.resourceRequirements).toEqual(resources);
    expect(resources).toEqual({
      rules: {
        inspection: { mechanic: 1, lift: 0, genericBay: 1 },
        oil_service: { mechanic: 1, lift: 1, genericBay: 0 },
        brakes_or_noise: { mechanic: 1, lift: 1, genericBay: 0 },
        generic_fault: { mechanic: 1, lift: 0, genericBay: 1 },
      },
      fallback: { mechanic: 1, lift: 0, genericBay: 1 },
    });
    const configuredPolicy = { version: 'v1', liftCount: 2, nonLiftBayCount: 2, concurrentTechnicians: 2,
      maxVehiclesOnSite: 8, maxVehicleIntakesPerHour: 3, resourceRequirements: resources };
    const url = `/v1/workshop/tenants/${ids.bootstrapTenant}/workshops/${ids.bootstrapWorkshop}/capacity`;
    const updated = await app.inject({ method: 'PATCH', url, headers: { authorization: 'Bearer owner' }, payload: {
      expectedVersion: 1, idempotencyKey: `bootstrap-${randomUUID()}`, openingHours,
      serviceDurationPolicy: { version: 'v1', rules: { inspection: 45, oil_service: 45, brakes_or_noise: 60, generic_fault: 60 }, fallbackMinutes: 60 },
      capacityPolicy: configuredPolicy,
    } });
    expect(updated.statusCode).toBe(200);
    expect(resolveCapacityRequirements(configuredPolicy, 'inspection')).toEqual([{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'generic_bay', quantity: 1 }]);
    expect(resolveCapacityRequirements(configuredPolicy, 'oil_service')).toEqual([{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'lift', quantity: 1 }]);
    expect(resolveCapacityRequirements(configuredPolicy, 'brakes_or_noise')).toEqual([{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'lift', quantity: 1 }]);
    expect(resolveCapacityRequirements(configuredPolicy, 'generic_fault')).toEqual([{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'generic_bay', quantity: 1 }]);
    expect(resolveCapacityRequirements(configuredPolicy, 'future_intent' as never)).toEqual([{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'generic_bay', quantity: 1 }]);

    const start = new Date(Date.now() + 2 * 86_400_000); start.setUTCMinutes(0, 0, 0);
    const context: TenantContext = { tenantId: ids.bootstrapTenant as TenantContext['tenantId'], workshopId: ids.bootstrapWorkshop as TenantContext['workshopId'],
      correlationId: randomUUID(), actor: { type: 'voice_agent', id: 'bootstrap-voice' } };
    const slots = await findSlots(pool, context, { window: { from: start.toISOString(), to: new Date(start.getTime() + 3_600_000).toISOString() }, limit: 1,
      serviceRequest: { estimatedDurationMinutes: 45, capacityRequirements: resolveCapacityRequirements(configuredPolicy, 'oil_service') },
      serviceIntent: 'oil_service', durationPolicySource: 'service_intent' });
    expect(slots).toHaveLength(1);
    const manual = await app.inject({ method: 'POST', url: `/v1/workshop/tenants/${ids.bootstrapTenant}/appointments`, headers: { authorization: 'Bearer owner' },
      payload: { idempotencyKey: `manual-${randomUUID()}`, startAt: new Date(start.getTime() + 2 * 3_600_000).toISOString(), serviceIntent: 'oil_service' } });
    expect(manual.statusCode).toBe(201);
    expect(new Date(manual.json().data.end_at).getTime() - new Date(manual.json().data.start_at).getTime()).toBe(45 * 60_000);
    expect(() => resolveCapacityRequirements({ ...configuredPolicy, resourceRequirements: { rules: {}, fallback: null } }, 'oil_service'))
      .toThrow('WORKSHOP_RESOURCE_REQUIREMENTS_UNRESOLVED');
  });

  it('rejects appointment creation with 422 when maxVehicleIntakesPerHour or capacity is exceeded', async () => {
    // Settle policy with maxVehicleIntakesPerHour: 1
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/workshop/tenants/${ids.tenant}/workshops/${ids.workshop}/capacity`,
      headers: { authorization: 'Bearer owner' },
      payload: {
        expectedVersion: 2,
        idempotencyKey: `cap-limit-${randomUUID()}`,
        capacityPolicy: { ...testWorkshopCapacityPolicy, maxVehicleIntakesPerHour: 1 }
      }
    });
    expect(patchRes.statusCode).toBe(200);

    const slotStart = new Date(Date.now() + 5 * 86_400_000);
    slotStart.setUTCMinutes(0, 0, 0);

    // First appointment in that hour succeeds
    const appt1 = await app.inject({
      method: 'POST',
      url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
      headers: { authorization: 'Bearer manager' },
      payload: {
        idempotencyKey: `appt-intake-1-${randomUUID()}`,
        startAt: slotStart.toISOString(),
        serviceIntent: 'oil_service',
        customerId: ids.customer,
        vehicleId: ids.vehicle
      }
    });
    expect(appt1.statusCode).toBe(201);

    // Second appointment in same hour fails closed with 422
    const slotStart2 = new Date(slotStart.getTime() + 15 * 60_000);
    const appt2 = await app.inject({
      method: 'POST',
      url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
      headers: { authorization: 'Bearer manager' },
      payload: {
        idempotencyKey: `appt-intake-2-${randomUUID()}`,
        startAt: slotStart2.toISOString(),
        serviceIntent: 'oil_service',
        customerId: ids.customer,
        vehicleId: ids.vehicle
      }
    });
    expect(appt2.statusCode).toBe(422);
    expect(appt2.json().error).toBe('WORKSHOP_INTAKE_CAPACITY_EXCEEDED');
  });
});
