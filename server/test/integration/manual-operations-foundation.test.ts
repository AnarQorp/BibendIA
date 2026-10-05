import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';
import { testWorkshopCapacityPolicy } from '../support/workshop-capacity.js';

const pool = createPool('migrator');
const pii = testPiiProtection();
const ids = {
  tenant: randomUUID(),
  otherTenant: randomUUID(),
  user: randomUUID(),
  otherUser: randomUUID(),
  vehicle: randomUUID(),
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
  await pool.query("INSERT INTO tenants(id,name,lifecycle_status) VALUES($1,'Manual Ops Tenant','pilot'),($2,'Other Tenant','pilot')", [ids.tenant, ids.otherTenant]);
  const durationPolicy = JSON.stringify({ version: 'test-v1', rules: { generic_fault: 45 }, fallbackMinutes: 60 });
  await pool.query("INSERT INTO workshops(id,tenant_id,name,service_duration_policy,capacity_policy) VALUES($1,$2,'Taller Central',$5,$6),($3,$4,'Taller Secundario',$5,$6)", [ids.workshop, ids.tenant, ids.otherWorkshop, ids.otherTenant, durationPolicy, JSON.stringify(testWorkshopCapacityPolicy)]);
  await pool.query("INSERT INTO users(id,status) VALUES($1,'active'),($2,'active')", [ids.user, ids.otherUser]);
  await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES($1,$2,'OWNER','active'),($3,$4,'OWNER','active')", [ids.user, ids.tenant, ids.otherUser, ids.otherTenant]);
  await inTenantTransaction(pool, ids.tenant, (client) => insertProtectedVehicle(client, pii,
    { id: ids.vehicle, tenantId: ids.tenant, plate: '2222 GOLF', make: 'Volkswagen', model: 'Golf VII' }));
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

describe('Manual Operations Foundation Integration Tests', () => {
  describe('1. Manual Estimate Drafts & Zero Plaintext PII', () => {
    it('creates a manual estimate draft without pre-existing vehicle or customer', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });
      const idempotencyKey = `manual-draft-${randomUUID()}`;

      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          kind: 'manual',
          idempotencyKey,
          title: 'Revisión y puesta a punto manual',
          customerSnapshot: {
            name: 'Carlos Conductor',
            phone: '654987321',
            email: 'carlos@example.com',
          },
          vehicleSnapshot: {
            plate: '4321-KMN',
            make: 'Renault',
            model: 'Megane',
            year: 2017,
          },
          lines: [
            {
              mutationKey: 'line-manual-001',
              description: 'Pastillas de freno delanteras',
              itemType: 'PART_ROLE',
              quantity: 1,
              unitPrice: 65,
              currency: 'EUR',
              selected: true,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const draft = res.json().data;
      expect(draft.draftType).toBe('MANUAL_WORKSHOP');
      expect(draft.title).toBe('Revisión y puesta a punto manual');
      expect(draft.customerSnapshot).toEqual({
        name: 'Carlos Conductor',
        phone: '654987321',
        email: 'carlos@example.com',
      });
      expect(draft.vehicleSnapshot).toMatchObject({
        plate: '4321-KMN',
        make: 'Renault',
        model: 'Megane',
        year: 2017,
      });
      expect(draft.lines).toHaveLength(1);
      expect(draft.lines[0]).toMatchObject({
        description: 'Pastillas de freno delanteras',
        itemType: 'PART_ROLE',
        unitPrice: 65,
        currency: 'EUR',
        lineSource: 'MANUAL_WORKSHOP',
      });

      // PII Verification: Verify zero plaintext PII in database row
      const rawRow = await pool.query(
        'SELECT * FROM estimate_drafts WHERE id=$1',
        [draft.id],
      );
      expect(rawRow.rowCount).toBe(1);
      const row = rawRow.rows[0];
      expect(row.customer_claim_ciphertext).not.toBeNull();
      expect(row.vehicle_claim_ciphertext).not.toBeNull();
      // Ensure raw JSON snapshots do NOT leak plaintext PII
      const vSnapshotStr = JSON.stringify(row.vehicle_snapshot);
      expect(vSnapshotStr).not.toContain('4321-KMN');
      expect(row.customer_id).toBeNull();
      expect(row.vehicle_id).toBeNull();

      // Idempotency check: Replay returns identical draft
      const replay = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          kind: 'manual',
          idempotencyKey,
          title: 'Revisión y puesta a punto manual',
        },
      });
      expect(replay.statusCode).toBe(201);
      expect(replay.json().data.id).toBe(draft.id);

      await app.close();
    });

    it('rejects draft creation when neither kind: "manual" nor repairJobCode is provided', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          idempotencyKey: `invalid-draft-${randomUUID()}`,
          title: 'Draft sin discriminante',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('INVALID_ESTIMATE_DRAFT_COMMAND');
      await app.close();
    });

    it('allows editing manual lines and deleting manual lines', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });
      const draftRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          kind: 'manual',
          idempotencyKey: `edit-draft-${randomUUID()}`,
          title: 'Borrador para edición',
          lines: [
            {
              mutationKey: 'line-to-keep',
              description: 'Aceite sintético 5W30',
              itemType: 'CONSUMABLE',
              quantity: 5,
              unitPrice: 12.5,
              currency: 'EUR',
              selected: true,
            },
            {
              mutationKey: 'line-to-delete',
              description: 'Líquido limpiaparabrisas',
              itemType: 'CONSUMABLE',
              quantity: 1,
              unitPrice: 5,
              currency: 'EUR',
              selected: true,
            },
          ],
        },
      });
      const draft = draftRes.json().data;
      const deleteLine = draft.lines.find((l: any) => l.description === 'Líquido limpiaparabrisas');
      const keepLine = draft.lines.find((l: any) => l.description === 'Aceite sintético 5W30');

      // Edit: add labor line, update keepLine price, delete deleteLine
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${draft.id}`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          expectedVersion: draft.version,
          idempotencyKey: `patch-${randomUUID()}`,
          lines: [
            {
              id: keepLine.id,
              description: 'Aceite sintético 5W30 Premium',
              itemType: 'CONSUMABLE',
              quantity: 5,
              unitPrice: 15,
              currency: 'EUR',
              selected: true,
            },
            {
              mutationKey: 'labor-line-added',
              description: 'Mano de obra cambio aceite',
              itemType: 'LABOR',
              quantity: 0.8,
              unitPrice: 55,
              currency: 'EUR',
              selected: true,
            },
          ],
          deleteLineIds: [deleteLine.id],
        },
      });

      expect(patchRes.statusCode).toBe(200);
      const updated = patchRes.json().data;
      expect(updated.version).toBe(draft.version + 1);
      expect(updated.lines).toHaveLength(2);
      expect(updated.lines.find((l: any) => l.id === deleteLine.id)).toBeUndefined();
      const updatedKeep = updated.lines.find((l: any) => l.id === keepLine.id);
      expect(updatedKeep.unitPrice).toBe(15);
      expect(updatedKeep.description).toBe('Aceite sintético 5W30 Premium');

      await app.close();
    });
  });

  describe('2. Mixed RK + Manual Lines and Provenance Integrity', () => {
    it('adds manual lines to an RK draft and forbids deleting RK lines physically', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });

      // Create RK draft
      const rkRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          vehicleId: ids.vehicle,
          idempotencyKey: `mixed-rk-${randomUUID()}`,
          vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' },
          repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
        },
      });
      expect(rkRes.statusCode).toBe(201);
      const rkDraft = rkRes.json().data;
      expect(rkDraft.draftType).toBe('REPAIR_KNOWLEDGE');
      const rkLine = rkDraft.lines[0];
      expect(rkLine.lineSource).toBe('REPAIR_KNOWLEDGE');

      // Add manual line to RK draft
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${rkDraft.id}`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          expectedVersion: rkDraft.version,
          idempotencyKey: `mixed-patch-${randomUUID()}`,
          lines: [
            {
              mutationKey: 'custom-flush-circuit',
              description: 'Limpieza circuito refrigerante',
              itemType: 'LABOR',
              quantity: 1,
              unitPrice: 48,
              currency: 'EUR',
              selected: true,
            },
          ],
        },
      });

      expect(patchRes.statusCode).toBe(200);
      const mixedDraft = patchRes.json().data;
      const manualLine = mixedDraft.lines.find((l: any) => l.description === 'Limpieza circuito refrigerante');
      expect(manualLine).toBeDefined();
      expect(manualLine.lineSource).toBe('MANUAL_WORKSHOP');

      // Negative check: trying to delete an RK line physically must fail with 409
      const illegalDeleteRes = await app.inject({
        method: 'PATCH',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts/${rkDraft.id}`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          expectedVersion: mixedDraft.version,
          idempotencyKey: `illegal-del-${randomUUID()}`,
          deleteLineIds: [rkLine.id],
        },
      });
      expect(illegalDeleteRes.statusCode).toBe(409);
      expect(illegalDeleteRes.json().error).toBe('RK_LINE_DELETE_FORBIDDEN');

      await app.close();
    });
  });

  describe('3. Customer Operations & PII Protection', () => {
    it('creates customer with encrypted PII and retrieves via bounded search', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });

      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          name: 'Ana García López',
          phone: '612345678',
          email: 'ana.garcia@example.es',
          notes: 'Preferencia contacto por WhatsApp',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const customer = createRes.json().data;
      expect(customer.name).toBe('Ana García López');
      expect(customer.phone).toBe('612345678');
      expect(customer.email).toBe('ana.garcia@example.es');
      expect(customer.notes).toBe('Preferencia contacto por WhatsApp');

      // Verify zero plaintext PII in customers table
      const dbRow = await pool.query('SELECT * FROM customers WHERE id=$1', [customer.id]);
      expect(dbRow.rowCount).toBe(1);
      const raw = dbRow.rows[0];
      expect(raw.display_name_ciphertext).not.toBeNull();
      expect(raw.phone_ciphertext).not.toBeNull();
      expect(raw.email_ciphertext).not.toBeNull();
      expect(raw.notes_ciphertext).not.toBeNull();

      // List and search
      const listRes = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers?search=ana.garcia`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data).toHaveLength(1);
      expect(listRes.json().data[0].id).toBe(customer.id);

      await app.close();
    });
  });

  describe('4. Flexible Vehicle Creation & Deduplication', () => {
    it('creates vehicles flexibly: plate alone, VIN alone, make+model alone', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });

      // 1. Plate alone
      const resPlate = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { plate: '7890 BBB' },
      });
      expect(resPlate.statusCode).toBe(201);
      expect(resPlate.json().data.plate).toBe('7890BBB');

      // 2. VIN alone
      const resVin = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { vin: 'VF1BB0A0F12345678' },
      });
      expect(resVin.statusCode).toBe(201);
      expect(resVin.json().data.vin).toBe('VF1BB0A0F12345678');

      // 3. Make + Model alone
      const resMakeModel = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { make: 'Citroën', model: 'C4 Cactus', year: 2016 },
      });
      expect(resMakeModel.statusCode).toBe(201);
      expect(resMakeModel.json().data.make).toBe('Citroën');
      expect(resMakeModel.json().data.model).toBe('C4 Cactus');

      // 4. Duplicate plate check: 409 VEHICLE_PLATE_EXISTS
      const resDup = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { plate: '7890-BBB', make: 'Diferente' },
      });
      expect(resDup.statusCode).toBe(409);
      expect(resDup.json().error).toBe('VEHICLE_PLATE_EXISTS');
      expect(resDup.json().existingVehicle).toBeDefined();

      // 5. Invalid empty payload check
      const resEmpty = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: { year: 2020 },
      });
      expect(resEmpty.statusCode).toBe(400);

      await app.close();
    });
  });

  describe('5. Manual Appointments & Origin Provenance', () => {
    it('creates appointment with origin=workshop_manual and appears in appointments list', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });
      const idempotencyKey = `manual-appt-${randomUUID()}`;
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
        headers: { authorization: 'Bearer workshop-owner' },
        payload: {
          idempotencyKey,
          startAt,
          durationMinutes: 45,
          serviceIntent: 'generic_fault',
          customerWaitMode: 'WAIT_ON_SITE',
          notes: 'Cliente avisa que sólo puede dejarlo por la mañana',
          customerSnapshot: { name: 'Lucía Fernández', phone: '677889900' },
          vehicleSnapshot: { plate: '5566 JKL', make: 'Ford', model: 'Fiesta' },
        },
      });

      expect(createRes.statusCode).toBe(201);
      const appt = createRes.json().data;
      expect(appt.origin).toBe('workshop_manual');
      expect(appt.customer_wait_mode).toBe('WAIT_ON_SITE');
      expect(appt.confirmation_evidence_ref).toBeNull();
      expect(appt.identity_resolution).toBe('workshop_manual');
      expect(appt.customer_name).toBe('Lucía Fernández');
      expect(appt.vehicle_plate).toBe('5566 JKL');

      // Database integrity: case_id is null, confirmation_evidence_ref is null, sensitive details encrypted
      const rawAppt = await pool.query('SELECT * FROM appointments WHERE id=$1', [appt.id]);
      expect(rawAppt.rowCount).toBe(1);
      expect(rawAppt.rows[0].case_id).toBeNull();
      expect(rawAppt.rows[0].confirmation_evidence_ref).toBeNull();
      expect(rawAppt.rows[0].origin).toBe('workshop_manual');
      expect(rawAppt.rows[0].customer_wait_mode).toBe('WAIT_ON_SITE');
      expect(rawAppt.rows[0].sensitive_details_ciphertext).not.toBeNull();

      // Query appointments list
      const listRes = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
        headers: { authorization: 'Bearer workshop-owner' },
      });
      expect(listRes.statusCode).toBe(200);
      const found = listRes.json().data.find((a: any) => a.id === appt.id);
      expect(found).toBeDefined();
      expect(found.origin).toBe('workshop_manual');
      expect(found.customer_name).toBe('Lucía Fernández');

      await app.close();
    });
  });

  describe('6. Cross-Tenant Isolation (Negative Tests)', () => {
    it('denies user of other tenant from accessing customers, vehicles, appointments, or drafts', async () => {
      const app = buildApi(pool, { authentication, piiProtection: pii });

      // Other user tries to access ids.tenant
      const resDrafts = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer other-tenant-user' },
      });
      expect(resDrafts.statusCode).toBe(403);

      const resCustomers = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer other-tenant-user' },
      });
      expect(resCustomers.statusCode).toBe(403);

      const resVehicles = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer other-tenant-user' },
      });
      expect(resVehicles.statusCode).toBe(403);

      const resAppts = await app.inject({
        method: 'GET',
        url: `/v1/workshop/tenants/${ids.tenant}/appointments`,
        headers: { authorization: 'Bearer other-tenant-user' },
      });
      expect(resAppts.statusCode).toBe(403);

      await app.close();
    });
  });
});
