import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TenantContext } from '../../src/domain/ids.js';
import { findSlots, holdSlot } from '../../src/modules/scheduling/postgres-scheduling.js';
import type { CapacityRequirement, ServiceRequest } from '../../src/modules/scheduling/model.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';

const pool = createPool('migrator');
const ids = { tenant: randomUUID(), workshop: randomUUID(), otherTenant: randomUUID(), otherWorkshop: randomUUID() };
const context = (tenantId = ids.tenant, workshopId = ids.workshop): TenantContext => ({
  tenantId: tenantId as TenantContext['tenantId'], workshopId: workshopId as TenantContext['workshopId'],
  correlationId: randomUUID(), actor: { type: 'voice_agent', id: `capacity-${randomUUID()}` },
});
const openingHours = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index + 1), [{ start: '00:00', end: '23:59' }]]));
const basePolicy = {
  version: 'capacity-v1', liftCount: 2, nonLiftBayCount: 1, concurrentTechnicians: 3,
  maxVehiclesOnSite: 10, maxVehicleIntakesPerHour: 10,
  resourceRequirements: { rules: {}, fallback: { mechanic: 1, lift: 0, genericBay: 0 } },
};
const liftJob: Pick<ServiceRequest, 'estimatedDurationMinutes' | 'capacityRequirements'> = {
  estimatedDurationMinutes: 45, capacityRequirements: [{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'lift', quantity: 1 }],
};
const bayJob: Pick<ServiceRequest, 'estimatedDurationMinutes' | 'capacityRequirements'> = {
  estimatedDurationMinutes: 45, capacityRequirements: [{ resourceType: 'mechanic', quantity: 1 }, { resourceType: 'generic_bay', quantity: 1 }],
};

function window() {
  const from = new Date(Date.now() + 10 * 86_400_000);
  from.setUTCMinutes(0, 0, 0);
  return { from, to: new Date(from.getTime() + 45 * 60_000) };
}

async function insertHold(startAt: Date, endAt: Date, requirements: CapacityRequirement[], tenantId = ids.tenant, workshopId = ids.workshop) {
  await inTenantTransaction(pool, tenantId, (client) => client.query(
    `INSERT INTO slot_holds(tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at,
       duration_minutes,duration_policy_source)
     VALUES($1,$2,$3,$4,$5,$6,now()+interval '1 hour',$7,'service_intent')`,
    [tenantId, workshopId, randomUUID(), startAt, endAt, JSON.stringify(requirements),
      Math.round((endAt.getTime() - startAt.getTime()) / 60_000)],
  ));
}

async function setPolicy(patch: Partial<typeof basePolicy>) {
  await inTenantTransaction(pool, ids.tenant, (client) => client.query(
    'UPDATE workshops SET capacity_policy=$1 WHERE id=$2', [JSON.stringify({ ...basePolicy, ...patch }), ids.workshop],
  ));
}

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Capacity A','pilot'),($2,'Capacity B','pilot')", [ids.tenant, ids.otherTenant]);
  await inTenantTransaction(pool, ids.tenant, (client) => client.query(
    "INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours,capacity_policy) VALUES($1,$2,'Capacity A','UTC',$3,$4)",
    [ids.workshop, ids.tenant, JSON.stringify(openingHours), JSON.stringify(basePolicy)],
  ));
  await inTenantTransaction(pool, ids.otherTenant, (client) => client.query(
    "INSERT INTO workshops(id,tenant_id,name,timezone,opening_hours,capacity_policy) VALUES($1,$2,'Capacity B','UTC',$3,$4)",
    [ids.otherWorkshop, ids.otherTenant, JSON.stringify(openingHours), JSON.stringify(basePolicy)],
  ));
});

beforeEach(async () => {
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query('DELETE FROM slot_candidates WHERE tenant_id=$1', [ids.tenant]);
    await client.query('DELETE FROM slot_holds WHERE tenant_id=$1', [ids.tenant]);
    await client.query('UPDATE workshops SET capacity_policy=$1 WHERE id=$2', [JSON.stringify(basePolicy), ids.workshop]);
  });
});

afterAll(async () => { await pool.end(); });

describe('Workshop Capacity & Scheduling v1', () => {
  it('blocks lift work when both lifts are occupied', async () => {
    const { from, to } = window();
    await insertHold(from, to, liftJob.capacityRequirements);
    await insertHold(from, to, liftJob.capacityRequirements);
    await expect(findSlots(pool, context(), { serviceRequest: liftJob, window: { from: from.toISOString(), to: to.toISOString() } }))
      .resolves.toHaveLength(0);
  });

  it('blocks on technicians even when more lifts exist', async () => {
    const { from, to } = window();
    await setPolicy({ liftCount: 3, concurrentTechnicians: 1 });
    await insertHold(from, to, liftJob.capacityRequirements);
    await expect(findSlots(pool, context(), { serviceRequest: liftJob, window: { from: from.toISOString(), to: to.toISOString() } }))
      .resolves.toHaveLength(0);
  });

  it('allows a non-lift bay job while lifts are occupied', async () => {
    const { from, to } = window();
    await insertHold(from, to, liftJob.capacityRequirements);
    await insertHold(from, to, liftJob.capacityRequirements);
    const slots = await findSlots(pool, context(), { serviceRequest: bayJob, window: { from: from.toISOString(), to: to.toISOString() }, limit: 1 });
    expect(slots[0]?.startAt).toBe(from.toISOString());
  });

  it('blocks the third intake in the same workshop-local hour', async () => {
    const { from, to } = window();
    await setPolicy({ maxVehicleIntakesPerHour: 2 });
    await insertHold(from, new Date(from.getTime() + 15 * 60_000), [{ resourceType: 'mechanic', quantity: 1 }]);
    await insertHold(new Date(from.getTime() + 15 * 60_000), new Date(from.getTime() + 30 * 60_000), [{ resourceType: 'mechanic', quantity: 1 }]);
    await expect(findSlots(pool, context(), { serviceRequest: bayJob, window: { from: from.toISOString(), to: to.toISOString() } }))
      .resolves.toHaveLength(0);
  });

  it('blocks projected site occupancy at the configured maximum', async () => {
    const { from, to } = window();
    await setPolicy({ maxVehiclesOnSite: 2 });
    await insertHold(from, to, [{ resourceType: 'mechanic', quantity: 1 }]);
    await insertHold(from, to, [{ resourceType: 'mechanic', quantity: 1 }]);
    await expect(findSlots(pool, context(), { serviceRequest: bayJob, window: { from: from.toISOString(), to: to.toISOString() } }))
      .resolves.toHaveLength(0);
  });

  it('serializes consumption of the final technician and remains tenant-isolated', async () => {
    const { from, to } = window();
    await setPolicy({ concurrentTechnicians: 1 });
    const candidates = await findSlots(pool, context(), {
      serviceRequest: liftJob, window: { from: from.toISOString(), to: new Date(to.getTime() + 15 * 60_000).toISOString() }, limit: 2,
    });
    const attempts = await Promise.allSettled(candidates.map((candidate) => holdSlot(pool, context(), candidate.token, 300)));
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const other = await findSlots(pool, context(ids.otherTenant, ids.otherWorkshop), {
      serviceRequest: liftJob, window: { from: from.toISOString(), to: to.toISOString() }, limit: 1,
    });
    expect(other).toHaveLength(1);
  });

  it('fails closed when workshop capacity configuration is incomplete', async () => {
    const { from, to } = window();
    await inTenantTransaction(pool, ids.tenant, (client) => client.query(
      "UPDATE workshops SET capacity_policy='{\"version\":\"v1\"}'::jsonb WHERE id=$1", [ids.workshop],
    ));
    await expect(findSlots(pool, context(), { serviceRequest: liftJob, window: { from: from.toISOString(), to: to.toISOString() } }))
      .rejects.toThrow('WORKSHOP_CAPACITY_POLICY_INVALID');
  });
});
