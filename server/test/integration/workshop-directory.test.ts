import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { testPiiProtection } from '../support/test-pii.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = {
  tenant: randomUUID(),
  otherTenant: randomUUID(),
  user: randomUUID(),
  otherUser: randomUUID(),
  workshop: randomUUID(),
  otherWorkshop: randomUUID(),
};

const principal: PrincipalContext = {
  kind: 'workshop_user',
  audience: 'workshop',
  userId: ids.user,
  issuer: 'test',
  subject: ids.user,
  sessionId: randomUUID(),
  authenticatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  assurance: 'single_factor',
};

const otherPrincipal: PrincipalContext = {
  kind: 'workshop_user',
  audience: 'workshop',
  userId: ids.otherUser,
  issuer: 'test',
  subject: ids.otherUser,
  sessionId: randomUUID(),
  authenticatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  assurance: 'single_factor',
};

const authentication: AuthenticationAdapter = {
  async authenticate(request) {
    if (request.authorization === 'Bearer workshop-owner') return principal;
    if (request.authorization === 'Bearer other-tenant-user') return otherPrincipal;
    return null;
  },
};

beforeAll(async () => {
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Directorio Tenant','pilot'),($2,'Other Tenant','pilot')", [ids.tenant, ids.otherTenant]);
  await pool.query("INSERT INTO workshops(id,tenant_id,name) VALUES($1,$2,'Taller Directorio'),($3,$4,'Taller Secundario')", [ids.workshop, ids.tenant, ids.otherWorkshop, ids.otherTenant]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active'),($2,'active')", [ids.user, ids.otherUser]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES($1,$2,'OWNER','active'),($3,$4,'OWNER','active')", [ids.user, ids.tenant, ids.otherUser, ids.otherTenant]);
});

afterAll(async () => {
  await pool.query('DELETE FROM estimate_draft_mutations WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM estimate_draft_lines WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM estimate_drafts WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM appointments WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM customer_vehicle_roles WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM vehicles WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM customers WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM workshops WHERE tenant_id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.query('DELETE FROM tenant_memberships WHERE user_id=ANY($1)', [[ids.user, ids.otherUser]]);
  await pool.query('DELETE FROM users WHERE id=ANY($1)', [[ids.user, ids.otherUser]]);
  await pool.query('DELETE FROM tenants WHERE id=ANY($1)', [[ids.tenant, ids.otherTenant]]);
  await pool.end();
});

describe('Workshop Directory Integration Tests', () => {
  const app = buildApi(pool, { authentication, piiProtection: pii });

  describe('1. Customer Directory: Creation, Search, Ficha Detail, Inline Edit, and Non-blocking Duplicate Suggestions', () => {
    let customerAId: string;

    it('creates customer Laura Sánchez with AES-256 encrypted PII', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          name: 'Laura Sánchez',
          phone: '600123456',
          email: 'laura@ejemplo.com',
          notes: 'Cliente preferente de recepción',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Laura Sánchez');
      expect(data.phone).toBe('600123456');
      expect(data.email).toBe('laura@ejemplo.com');
      customerAId = data.id;

      // Verify zero plaintext in database row
      const dbRow = await pool.query('SELECT * FROM customers WHERE id=$1', [customerAId]);
      expect(dbRow.rowCount).toBe(1);
      const row = dbRow.rows[0];
      expect(row.display_name_legacy).toBeNull();
      expect(row.phone_legacy_hash).toBeNull();
      expect(row.display_name_ciphertext).not.toBeNull();
      expect(row.phone_ciphertext).not.toBeNull();
      expect(row.email_ciphertext).not.toBeNull();
      expect(row.notes_ciphertext).not.toBeNull();
    });

    it('returns duplicate_suggestion (status 200) without blocking on duplicate phone', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          name: 'Laura Familiar',
          phone: '600123456',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.status).toBe('duplicate_suggestion');
      expect(json.code).toBe('CUSTOMER_PHONE_EXISTS');
      expect(json.existingCustomer.id).toBe(customerAId);
      expect(json.existingCustomer.name).toBe('Laura Sánchez');
    });

    it('returns 409 CUSTOMER_PHONE_EXISTS if duplicate phone creation is forced due to strict canonical DB unique constraint', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          name: 'Laura Familiar',
          phone: '600123456',
          allowDuplicate: true,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CUSTOMER_PHONE_EXISTS');
    });

    it('creates customer with identical email or name without conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          name: 'Laura Sánchez',
          email: 'laura@ejemplo.com',
          phone: '699111222',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.name).toBe('Laura Sánchez');
      expect(res.json().data.email).toBe('laura@ejemplo.com');
    });

    it('retrieves Customer Ficha with decrypted data and empty activity', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${customerAId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });

      expect(res.statusCode).toBe(200);
      const ficha = res.json().data;
      expect(ficha.customer.id).toBe(customerAId);
      expect(ficha.customer.name).toBe('Laura Sánchez');
      expect(ficha.customer.phone).toBe('+34600123456');
      expect(ficha.customer.notes).toBe('Cliente preferente de recepción');
      expect(ficha.vehicles).toEqual([]);
      expect(ficha.activity.appointments).toEqual([]);
      expect(ficha.activity.estimates).toEqual([]);
    });

    it('updates Customer Ficha (PATCH) with new data and persists cleanly', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${customerAId}`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          name: 'Laura Sánchez Martín',
          notes: 'Nota actualizada: llamar por las tardes',
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.json().data;
      expect(updated.name).toBe('Laura Sánchez Martín');
      expect(updated.notes).toBe('Nota actualizada: llamar por las tardes');

      // Verify in Ficha get
      const freshFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${customerAId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(freshFicha.json().data.customer.name).toBe('Laura Sánchez Martín');
      expect(freshFicha.json().data.customer.notes).toBe('Nota actualizada: llamar por las tardes');
    });
  });

  describe('2. Vehicle Directory: Plate-only creation, Duplicate Blocking, Ficha, and Inline Edit', () => {
    let vehicleAId: string;

    it('creates plate-only vehicle 7788BBB with zero make/model', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          plate: '7788BBB',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.id).toBeDefined();
      expect(data.plate).toBe('7788BBB');
      expect(data.make).toBeNull();
      expect(data.model).toBeNull();
      vehicleAId = data.id;

      // Verify zero plaintext plate in database
      const dbRow = await pool.query('SELECT * FROM vehicles WHERE id=$1', [vehicleAId]);
      expect(dbRow.rowCount).toBe(1);
      const row = dbRow.rows[0];
      expect(row.plate_legacy_value).toBeNull();
      expect(row.plate_legacy_hash).toBeNull();
      expect(row.plate_ciphertext).not.toBeNull();
    });

    it('blocks duplicate plate with 409 conflict and returns existing vehicle', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          plate: '7788-BBB', // Normalized equivalent
        },
      });

      expect(res.statusCode).toBe(409);
      const json = res.json();
      expect(json.code).toBe('VEHICLE_PLATE_EXISTS');
      expect(json.existingVehicle.id).toBe(vehicleAId);
      expect(json.existingVehicle.plate).toBe('7788BBB');
    });

    it('retrieves Vehicle Ficha without owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${vehicleAId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });

      expect(res.statusCode).toBe(200);
      const ficha = res.json().data;
      expect(ficha.vehicle.id).toBe(vehicleAId);
      expect(ficha.vehicle.plate).toBe('7788BBB');
      expect(ficha.customer).toBeNull();
      expect(ficha.activity.appointments).toEqual([]);
      expect(ficha.activity.estimates).toEqual([]);
    });

    it('completes Vehicle data via PATCH (make, model, year, VIN)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${vehicleAId}`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          make: 'Renault',
          model: 'Clio V',
          year: 2020,
          vin: 'VF1RJA00000000001',
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.json().data;
      expect(updated.make).toBe('Renault');
      expect(updated.model).toBe('Clio V');
      expect(updated.year).toBe(2020);
      expect(updated.vin).toBe('VF1RJA00000000001');

      // Verify in Ficha get
      const freshFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${vehicleAId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(freshFicha.json().data.vehicle.make).toBe('Renault');
      expect(freshFicha.json().data.vehicle.model).toBe('Clio V');
      expect(freshFicha.json().data.vehicle.year).toBe(2020);
      expect(freshFicha.json().data.vehicle.vin).toBe('VF1RJA00000000001');
    });

    it('blocks duplicate VIN with 409 conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          plate: '9999XYZ',
          vin: 'VF1RJA00000000001', // Same VIN as vehicleA
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('VEHICLE_VIN_EXISTS');
    });
  });

  describe('3. Customer-Vehicle Canonical Association (customer_vehicle_roles)', () => {
    let customerId: string;
    let vehicleId: string;

    beforeAll(async () => {
      const cRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { name: 'Manuel García', phone: '611222333' },
      });
      customerId = cRes.json().data.id;

      const vRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { plate: '3344FFF', make: 'Ford', model: 'Focus' },
      });
      vehicleId = vRes.json().data.id;
    });

    it('associates customer and vehicle using canonical customer_vehicle_roles', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customer-vehicle-roles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          customerId,
          vehicleId,
          role: 'owner',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.role).toBe('owner');
      expect(res.json().data.verificationStatus).toBe('verified');

      // Verify Customer Ficha now lists this vehicle
      const cFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${customerId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(cFicha.json().data.vehicles).toHaveLength(1);
      expect(cFicha.json().data.vehicles[0].id).toBe(vehicleId);
      expect(cFicha.json().data.vehicles[0].plate).toBe('3344FFF');

      // Verify Vehicle Ficha now shows Manuel García as owner
      const vFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${vehicleId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(vFicha.json().data.customer).not.toBeNull();
      expect(vFicha.json().data.customer.id).toBe(customerId);
      expect(vFicha.json().data.customer.name).toBe('Manuel García');
    });
  });

  describe('4. Contextual Reusability: Appointments, Estimates and Mixed Provenance', () => {
    let customerId: string;
    let vehicleId: string;

    beforeAll(async () => {
      const cRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { name: 'Elena Rivas', phone: '622333444' },
      });
      customerId = cRes.json().data.id;

      const vRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { plate: '5566HHH', make: 'Seat', model: 'Ibiza', customerId },
      });
      vehicleId = vRes.json().data.id;
    });

    it('creates an appointment linked to customer & vehicle and shows up in both fichas', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          idempotencyKey: `appt-${randomUUID()}`,
          startAt: '2026-10-15T10:00:00Z',
          durationMinutes: 45,
          serviceIntent: 'Cambio de aceite y filtros',
          customerId,
          vehicleId,
        },
      });

      expect(res.statusCode).toBe(201);
      const appt = res.json().data;
      expect(appt.customer_id).toBe(customerId);
      expect(appt.vehicle_id).toBe(vehicleId);

      // Verify customer ficha activity
      const cFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${customerId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(cFicha.json().data.activity.appointments).toHaveLength(1);
      expect(cFicha.json().data.activity.appointments[0].serviceIntent).toBe('Cambio de aceite y filtros');

      // Verify vehicle ficha activity
      const vFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${vehicleId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(vFicha.json().data.activity.appointments).toHaveLength(1);
      expect(vFicha.json().data.activity.appointments[0].serviceIntent).toBe('Cambio de aceite y filtros');
    });

    it('creates a manual estimate draft, reflects derived provenance (manual) and displays in both fichas', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          kind: 'manual',
          idempotencyKey: `draft-${randomUUID()}`,
          title: 'Presupuesto Pastillas y Discos',
          customerId,
          vehicleId,
          lines: [
            {
              mutationKey: 'line-1',
              description: 'Pastillas delanteras',
              itemType: 'PART_ROLE',
              quantity: 1,
              unitPrice: 50,
              currency: 'EUR',
              selected: true,
            },
            {
              mutationKey: 'line-2',
              description: 'Mano de obra montaje',
              itemType: 'LABOR',
              quantity: 1.5,
              unitPrice: 40,
              currency: 'EUR',
              selected: true,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const draft = res.json().data;
      expect(draft.customerId).toBe(customerId);
      expect(draft.vehicleId).toBe(vehicleId);

      // Verify customer ficha estimates activity
      const cFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${customerId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(cFicha.json().data.activity.estimates).toHaveLength(1);
      expect(cFicha.json().data.activity.estimates[0].title).toBe('Presupuesto Pastillas y Discos');
      expect(cFicha.json().data.activity.estimates[0].total).toBe(110);
      expect(cFicha.json().data.activity.estimates[0].provenance).toBe('manual');

      // Verify vehicle ficha estimates activity
      const vFicha = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${vehicleId}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(vFicha.json().data.activity.estimates).toHaveLength(1);
      expect(vFicha.json().data.activity.estimates[0].total).toBe(110);
    });
  });

  describe('5. Snapshot Consolidation on Estimate Drafts (Optimistic Concurrency & Role Association)', () => {
    it('consolidates customerId and vehicleId on an unlinked draft with version increment', async () => {
      // Create draft with freeform snapshots only
      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          kind: 'manual',
          idempotencyKey: `freeform-${randomUUID()}`,
          title: 'Presupuesto Libre',
          customerSnapshot: { name: 'Cliente Libre', phone: '699888777' },
          vehicleSnapshot: { plate: '1122JJJ', make: 'Audi', model: 'A3' },
        },
      });
      expect(createRes.statusCode).toBe(201);
      const initialDraft = createRes.json().data;
      expect(initialDraft.version).toBe(1);
      expect(initialDraft.customerId).toBeNull();
      expect(initialDraft.vehicleId).toBeNull();

      // Create persistent customer and vehicle in workshop
      const cRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { name: 'Cliente Libre Consolidado', phone: '699888777' },
      });
      const persistentCustomer = cRes.json().data;

      const vRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { plate: '1122JJJ', make: 'Audi', model: 'A3' },
      });
      const persistentVehicle = vRes.json().data;

      // Consolidate both customer and vehicle onto the estimate draft
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${initialDraft.id}`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          expectedVersion: 1,
          idempotencyKey: `consolidate-${randomUUID()}`,
          customerId: persistentCustomer.id,
          vehicleId: persistentVehicle.id,
        },
      });

      expect(patchRes.statusCode).toBe(200);
      const consolidatedDraft = patchRes.json().data;
      expect(consolidatedDraft.version).toBe(2);
      expect(consolidatedDraft.customerId).toBe(persistentCustomer.id);
      expect(consolidatedDraft.vehicleId).toBe(persistentVehicle.id);

      // Verify that consolidating both customer and vehicle auto-associated them in customer_vehicle_roles
      const rolesCheck = await pool.query(
        'SELECT role, verification_status FROM customer_vehicle_roles WHERE tenant_id=$1 AND customer_id=$2 AND vehicle_id=$3',
        [ids.tenant, persistentCustomer.id, persistentVehicle.id]
      );
      expect(rolesCheck.rowCount).toBe(1);
      expect(rolesCheck.rows[0].role).toBe('owner');
      expect(rolesCheck.rows[0].verification_status).toBe('verified');
    });
  });

  describe('6. Cross-Tenant Authorization & Security Isolation', () => {
    it('prevents other tenant from reading customers of primary tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer other-tenant-user' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('prevents other tenant from reading vehicles of primary tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer other-tenant-user' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('prevents accessing non-existent customer with 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers/${randomUUID()}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('CUSTOMER_NOT_FOUND');
    });

    it('prevents accessing non-existent vehicle with 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles/${randomUUID()}`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('VEHICLE_NOT_FOUND');
    });
  });
});
