import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { createAppointmentTransactional } from '../../src/modules/scheduling/postgres-scheduling.js';
import type { TenantContext } from '../../src/domain/ids.js';
import type { CreateAppointmentCommand } from '../../src/ports/scheduling.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool();
const pii = testPiiProtection();
const ids = { tenant: randomUUID(), workshop: randomUUID(), customer: randomUUID(), vehicle: randomUUID(), conversation: randomUUID(), case: randomUUID() };
const context: TenantContext = {
  tenantId: ids.tenant as TenantContext['tenantId'], workshopId: ids.workshop as TenantContext['workshopId'],
  correlationId: randomUUID(), actor: { type: 'voice_agent', id: 'integration-test' },
};
const slotToken = `slot-${randomUUID()}`;

beforeAll(async () => {
  await pool.query("INSERT INTO tenants (id,name,lifecycle_status) VALUES ($1,'Integration tenant','pilot')", [ids.tenant]);
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await client.query("INSERT INTO workshops (id,tenant_id,name) VALUES ($1,$2,'Test workshop')", [ids.workshop, ids.tenant]);
    await insertProtectedCustomer(client, pii, { id: ids.customer, tenantId: ids.tenant, displayName: 'Aitor Etxeberria' });
    await insertProtectedVehicle(client, pii, { id: ids.vehicle, tenantId: ids.tenant, plate: '1489 KMR' });
    await client.query("INSERT INTO conversations (id,tenant_id,workshop_id) VALUES ($1,$2,$3)", [ids.conversation, ids.tenant, ids.workshop]);
    await client.query("INSERT INTO reception_cases (id,tenant_id,conversation_id,customer_id,vehicle_id,intent) VALUES ($1,$2,$3,$4,$5,'oil_service')", [ids.case, ids.tenant, ids.conversation, ids.customer, ids.vehicle]);
    await client.query("INSERT INTO slot_holds (tenant_id,workshop_id,slot_token,start_at,end_at,capacity_requirements,expires_at) VALUES ($1,$2,$3,now()+interval '1 day',now()+interval '1 day 1 hour','[]',now()+interval '1 hour')", [ids.tenant, ids.workshop, slotToken]);
  });
});

afterAll(async () => { await pool.end(); });

describe('PostgreSQL appointment idempotency', () => {
  it('turns concurrent replay into exactly one appointment, action, audit and outbox event', async () => {
    const command: CreateAppointmentCommand = {
      slotToken, caseId: ids.case, customerId: ids.customer, vehicleId: ids.vehicle,
      serviceRequest: { intent: 'oil_service', symptoms: ['maintenance due'], notes: 'Customer requested oil service', estimatedDurationMinutes: 60, capacityRequirements: [{ resourceType: 'mechanic', quantity: 1 }] },
      confirmationEvidenceRef: 'test:message:confirmed', idempotencyKey: `appointment-${randomUUID()}`,
    };
    const results = await Promise.all(Array.from({ length: 8 }, () => createAppointmentTransactional(pool, context, command, pii)));
    expect(new Set(results.map((result) => result.value?.id)).size).toBe(1);

    const counts = await inTenantTransaction(pool, ids.tenant, async (client) => {
      const results = [];
      results.push(await client.query('SELECT count(*)::int AS count FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2', [ids.tenant, command.idempotencyKey]));
      results.push(await client.query('SELECT count(*)::int AS count FROM action_intents WHERE tenant_id=$1 AND idempotency_key=$2', [ids.tenant, command.idempotencyKey]));
      results.push(await client.query("SELECT count(*)::int AS count FROM audit_events WHERE tenant_id=$1 AND event_type='appointment_created'", [ids.tenant]));
      results.push(await client.query("SELECT count(*)::int AS count FROM outbox_events WHERE tenant_id=$1 AND event_type='appointment.created'", [ids.tenant]));
      return results;
    });
    expect(counts.map((result) => result.rows[0].count)).toEqual([1, 1, 1, 1]);
  });

  it('does not expose rows under a different tenant context', async () => {
    const otherTenant = randomUUID();
    await pool.query("INSERT INTO tenants (id,name,lifecycle_status) VALUES ($1,'Other tenant','pilot')", [otherTenant]);
    const visible = await inTenantTransaction(pool, otherTenant, async (client) => client.query('SELECT id FROM appointments'));
    expect(visible.rowCount).toBe(0);
  });
});
