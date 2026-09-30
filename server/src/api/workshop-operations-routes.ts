import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';
import type { PiiProtection } from '../security/pii-protection.js';
import { normalizeSpanishPlate } from '../security/pii-protection.js';
import { insertProtectedCustomer, insertProtectedVehicle, revealCustomerRow, revealVehicleRow } from '../security/protected-records.js';

const tenantParams = z.object({ tenantId: z.string().uuid() });

const customerQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
}).strict();

const vehicleQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  customerId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createVehicleSchema = z.object({
  plate: z.string().trim().min(2).max(20).optional(),
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().trim().min(5).max(50).optional(),
  customerId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
}).strict().superRefine((data, ctx) => {
  const hasPlate = Boolean(data.plate);
  const hasVin = Boolean(data.vin);
  const hasMakeModel = Boolean(data.make && data.model);
  if (!hasPlate && !hasVin && !hasMakeModel) {
    ctx.addIssue({
      code: 'custom',
      message: 'Debe indicarse al menos la matrícula, el VIN o la combinación de marca y modelo.',
    });
  }
});

const createManualAppointmentSchema = z.object({
  idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  serviceIntent: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
  customerId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  customerSnapshot: z.object({
    name: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().max(200).optional(),
  }).strict().optional(),
  vehicleSnapshot: z.object({
    plate: z.string().trim().max(20).optional(),
    make: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    vin: z.string().trim().max(50).optional(),
  }).strict().optional(),
}).strict();

export function registerWorkshopOperationsRoutes(app: FastifyInstance, pool: pg.Pool, pii: PiiProtection): void {
  const auth = { config: { auth: { mode: 'authenticated' as const, audience: 'workshop' as const, principalKinds: ['workshop_user' as const] } } };

  // 1. Customers: List
  app.get('/v1/workshop/tenants/:tenantId/customers', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const query = customerQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: 'INVALID_CUSTOMER_QUERY', correlationId: request.id });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    const customers = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal,
      requestedTenantId: params.data.tenantId,
      capability: 'workshop:customers:read',
      correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'workshop_read');
      const result = await client.query(`
        SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
               phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
               email_ciphertext, email_nonce, email_auth_tag, email_key_id,
               notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
        FROM customers
        WHERE tenant_id = $1 AND pii_migration_state = 'protected'
        ORDER BY id DESC
        LIMIT 200
      `, [context.tenantId]);

      let revealed = result.rows.map((row) => revealCustomerRow(row, pii));
      if (query.data.search) {
        const searchLower = query.data.search.toLowerCase();
        revealed = revealed.filter((c) =>
          c.name.toLowerCase().includes(searchLower) ||
          (c.phone && c.phone.toLowerCase().includes(searchLower)) ||
          (c.email && c.email.toLowerCase().includes(searchLower))
        );
      }
      return revealed.slice(query.data.offset, query.data.offset + query.data.limit);
    });

    return { data: customers, correlationId: request.id };
  });

  // 2. Customers: Create
  app.post('/v1/workshop/tenants/:tenantId/customers', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const body = createCustomerSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'INVALID_CUSTOMER_PAYLOAD', correlationId: request.id });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    const customer = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal,
      requestedTenantId: params.data.tenantId,
      capability: 'workshop:customers:create',
      correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'domain_mutation');
      const id = randomUUID();
      await insertProtectedCustomer(client, pii, {
        id,
        tenantId: context.tenantId,
        displayName: body.data.name,
        phone: body.data.phone ?? null,
        email: body.data.email ?? null,
        notes: body.data.notes ?? null,
      });
      return {
        id,
        name: body.data.name,
        phone: body.data.phone ?? null,
        email: body.data.email ?? null,
        notes: body.data.notes ?? null,
      };
    });

    return reply.code(201).send({ data: customer, correlationId: request.id });
  });

  // 3. Vehicles: List
  app.get('/v1/workshop/tenants/:tenantId/vehicles', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const query = vehicleQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: 'INVALID_VEHICLE_QUERY', correlationId: request.id });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    const vehicles = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal,
      requestedTenantId: params.data.tenantId,
      capability: 'workshop:vehicles:read',
      correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'workshop_read');
      const sql = query.data.customerId
        ? `SELECT v.id, v.tenant_id, v.make, v.model, v.year,
                  v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                  v.vin_ciphertext, v.vin_nonce, v.vin_auth_tag, v.vin_key_id,
                  r.customer_id
           FROM vehicles v
           JOIN customer_vehicle_roles r ON r.vehicle_id = v.id AND r.tenant_id = v.tenant_id
           WHERE v.tenant_id = $1 AND v.pii_migration_state = 'protected' AND r.customer_id = $2
           ORDER BY v.id DESC
           LIMIT 200`
        : `SELECT v.id, v.tenant_id, v.make, v.model, v.year,
                  v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                  v.vin_ciphertext, v.vin_nonce, v.vin_auth_tag, v.vin_key_id,
                  (SELECT r.customer_id FROM customer_vehicle_roles r WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS customer_id
           FROM vehicles v
           WHERE v.tenant_id = $1 AND v.pii_migration_state = 'protected'
           ORDER BY v.id DESC
           LIMIT 200`;
      const queryArgs = query.data.customerId ? [context.tenantId, query.data.customerId] : [context.tenantId];
      const result = await client.query(sql, queryArgs);

      let revealed = result.rows.map((row) => revealVehicleRow(row, pii));
      if (query.data.search) {
        const searchLower = query.data.search.toLowerCase();
        revealed = revealed.filter((v) =>
          (v.plate && v.plate.toLowerCase().includes(searchLower)) ||
          (v.make && v.make.toLowerCase().includes(searchLower)) ||
          (v.model && v.model.toLowerCase().includes(searchLower)) ||
          (v.vin && v.vin.toLowerCase().includes(searchLower))
        );
      }
      return revealed.slice(query.data.offset, query.data.offset + query.data.limit);
    });

    return { data: vehicles, correlationId: request.id };
  });

  // 4. Vehicles: Create
  app.post('/v1/workshop/tenants/:tenantId/vehicles', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const body = createVehicleSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'INVALID_VEHICLE_PAYLOAD',
        message: body.success ? undefined : body.error.issues[0]?.message,
        correlationId: request.id,
      });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const vehicle = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:vehicles:create',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'domain_mutation');

        // Check for duplicate plate if provided
        if (body.data.plate) {
          const normalizedPlate = normalizeSpanishPlate(body.data.plate);
          const candidates = pii.lookupDigests(context.tenantId, 'vehicle.plate', normalizedPlate).map((i) => i.digest);
          const existing = await client.query(`
            SELECT id, tenant_id, make, model, year,
                   plate_ciphertext, plate_nonce, plate_auth_tag, plate_key_id,
                   vin_ciphertext, vin_nonce, vin_auth_tag, vin_key_id
            FROM vehicles
            WHERE tenant_id = $1 AND plate_lookup_digest = ANY($2::text[])
            LIMIT 1
          `, [context.tenantId, candidates]);
          if (existing.rowCount) {
            const conflictErr = new Error('VEHICLE_PLATE_EXISTS') as any;
            conflictErr.existingVehicle = revealVehicleRow(existing.rows[0], pii);
            throw conflictErr;
          }
        }

        // Check for duplicate VIN if provided
        if (body.data.vin) {
          const normalizedVin = body.data.vin.trim().toUpperCase();
          const candidates = pii.lookupDigests(context.tenantId, 'vehicle.vin', normalizedVin).map((i) => i.digest);
          const existing = await client.query(`
            SELECT id, tenant_id, make, model, year,
                   plate_ciphertext, plate_nonce, plate_auth_tag, plate_key_id,
                   vin_ciphertext, vin_nonce, vin_auth_tag, vin_key_id
            FROM vehicles
            WHERE tenant_id = $1 AND vin_lookup_digest = ANY($2::text[])
            LIMIT 1
          `, [context.tenantId, candidates]);
          if (existing.rowCount) {
            const conflictErr = new Error('VEHICLE_VIN_EXISTS') as any;
            conflictErr.existingVehicle = revealVehicleRow(existing.rows[0], pii);
            throw conflictErr;
          }
        }

        const id = randomUUID();
        await insertProtectedVehicle(client, pii, {
          id,
          tenantId: context.tenantId,
          plate: body.data.plate ?? null,
          make: body.data.make ?? null,
          model: body.data.model ?? null,
          year: body.data.year ?? null,
          vin: body.data.vin ?? null,
        });

        if (body.data.customerId) {
          await client.query(`
            INSERT INTO customer_vehicle_roles (tenant_id, customer_id, vehicle_id, verification_status)
            VALUES ($1, $2, $3, 'verified')
            ON CONFLICT DO NOTHING
          `, [context.tenantId, body.data.customerId, id]);
        }

        return {
          id,
          plate: body.data.plate ? normalizeSpanishPlate(body.data.plate) : null,
          make: body.data.make ?? null,
          model: body.data.model ?? null,
          year: body.data.year ?? null,
          vin: body.data.vin ? body.data.vin.trim().toUpperCase() : null,
          customerId: body.data.customerId ?? null,
        };
      });

      return reply.code(201).send({ data: vehicle, correlationId: request.id });
    } catch (err: any) {
      if (err.message === 'VEHICLE_PLATE_EXISTS') {
        return reply.code(409).send({
          error: 'VEHICLE_PLATE_EXISTS',
          message: 'Ya existe un vehículo registrado con esta matrícula en el taller.',
          existingVehicle: err.existingVehicle,
          correlationId: request.id,
        });
      }
      if (err.message === 'VEHICLE_VIN_EXISTS') {
        return reply.code(409).send({
          error: 'VEHICLE_VIN_EXISTS',
          message: 'Ya existe un vehículo registrado con este VIN en el taller.',
          existingVehicle: err.existingVehicle,
          correlationId: request.id,
        });
      }
      throw err;
    }
  });

  // 5. Appointments: Create Manual
  app.post('/v1/workshop/tenants/:tenantId/appointments', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const body = createManualAppointmentSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'INVALID_MANUAL_APPOINTMENT_PAYLOAD', correlationId: request.id });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    const appointment = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal,
      requestedTenantId: params.data.tenantId,
      capability: 'workshop:appointments:create',
      correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'domain_mutation');

      // Check idempotency replay
      const replay = await client.query(`
        SELECT a.id, a.tenant_id, a.workshop_id, a.case_id, a.customer_id, a.vehicle_id, a.identity_resolution_status,
               a.identity_claim_ciphertext, a.identity_claim_nonce, a.identity_claim_auth_tag, a.identity_claim_key_id,
               a.service_request,
               a.sensitive_details_ciphertext, a.sensitive_details_nonce, a.sensitive_details_auth_tag, a.sensitive_details_key_id,
               a.start_at, a.end_at, a.status, a.confirmation_evidence_ref, a.version, a.origin,
               c.display_name_ciphertext AS customer_name_ciphertext, c.display_name_nonce AS customer_name_nonce,
               c.display_name_auth_tag AS customer_name_auth_tag, c.display_name_key_id AS customer_name_key_id,
               v.plate_ciphertext AS vehicle_plate_ciphertext, v.plate_nonce AS vehicle_plate_nonce,
               v.plate_auth_tag AS vehicle_plate_auth_tag, v.plate_key_id AS vehicle_plate_key_id,
               v.make AS vehicle_make, v.model AS vehicle_model
        FROM appointments a
        LEFT JOIN customers c ON c.id = a.customer_id AND c.tenant_id = a.tenant_id
        LEFT JOIN vehicles v ON v.id = a.vehicle_id AND v.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1 AND a.idempotency_key = $2
      `, [context.tenantId, body.data.idempotencyKey]);

      if (replay.rowCount) {
        return revealAppointment(replay.rows[0], pii);
      }

      // Resolve workshop ID
      const wsResult = await client.query<{ id: string }>('SELECT id FROM workshops WHERE tenant_id = $1 LIMIT 1', [context.tenantId]);
      if (!wsResult.rowCount) throw new Error('WORKSHOP_NOT_FOUND');
      const workshopId = wsResult.rows[0].id;

      const startAt = new Date(body.data.startAt);
      const endAt = body.data.endAt ? new Date(body.data.endAt) : new Date(startAt.getTime() + body.data.durationMinutes * 60_000);

      // Sensitive details
      const protectedSensitive = pii.protect(context.tenantId, 'appointment.sensitive_details', JSON.stringify({
        symptoms: [],
        notes: body.data.notes || '',
      }));

      // Identity claim if unpersisted customer or vehicle data passed
      let identityClaim: ReturnType<typeof pii.protect> | null = null;
      if (body.data.customerSnapshot || body.data.vehicleSnapshot) {
        identityClaim = pii.protect(context.tenantId, 'appointment.identity_claim', JSON.stringify({
          customerName: body.data.customerSnapshot?.name,
          plate: body.data.vehicleSnapshot?.plate,
          vehicleDescription: [body.data.vehicleSnapshot?.make, body.data.vehicleSnapshot?.model].filter(Boolean).join(' ') || undefined,
        }));
      }

      const serviceRequest = {
        intent: body.data.serviceIntent,
        notes: body.data.notes,
        estimatedDurationMinutes: body.data.durationMinutes,
        capacityRequirements: [{ resourceType: 'mechanic', quantity: 1 }],
      };

      const inserted = await client.query(`
        INSERT INTO appointments (
          tenant_id, workshop_id, case_id, customer_id, vehicle_id,
          identity_resolution_status, identity_claim_ciphertext, identity_claim_nonce,
          identity_claim_auth_tag, identity_claim_key_id, service_request, symptoms, notes,
          sensitive_details_ciphertext, sensitive_details_nonce, sensitive_details_auth_tag,
          sensitive_details_key_id, pii_migration_state, estimated_duration_minutes,
          capacity_requirements, start_at, end_at, status, confirmation_evidence_ref,
          idempotency_key, origin
        ) VALUES (
          $1, $2, NULL, $3, $4,
          'workshop_manual', $5, $6, $7, $8,
          $9, '{}'::text[], NULL,
          $10, $11, $12, $13, 'protected', $14,
          $15, $16, $17, 'confirmed', NULL,
          $18, 'workshop_manual'
        )
        RETURNING id, tenant_id, workshop_id, case_id, customer_id, vehicle_id,
                  identity_resolution_status, start_at, end_at, status,
                  confirmation_evidence_ref, version, origin
      `, [
        context.tenantId, workshopId, body.data.customerId ?? null, body.data.vehicleId ?? null,
        identityClaim?.ciphertext ?? null, identityClaim?.nonce ?? null, identityClaim?.authTag ?? null, identityClaim?.keyId ?? null,
        JSON.stringify(serviceRequest),
        protectedSensitive.ciphertext, protectedSensitive.nonce, protectedSensitive.authTag, protectedSensitive.keyId,
        body.data.durationMinutes, JSON.stringify(serviceRequest.capacityRequirements),
        startAt, endAt, body.data.idempotencyKey,
      ]);

      const appointmentId = inserted.rows[0].id;

      // Re-read with joins for clean revealing
      const fresh = await client.query(`
        SELECT a.id, a.tenant_id, a.workshop_id, a.case_id, a.customer_id, a.vehicle_id, a.identity_resolution_status,
               a.identity_claim_ciphertext, a.identity_claim_nonce, a.identity_claim_auth_tag, a.identity_claim_key_id,
               a.service_request,
               a.sensitive_details_ciphertext, a.sensitive_details_nonce, a.sensitive_details_auth_tag, a.sensitive_details_key_id,
               a.start_at, a.end_at, a.status, a.confirmation_evidence_ref, a.version, a.origin,
               c.display_name_ciphertext AS customer_name_ciphertext, c.display_name_nonce AS customer_name_nonce,
               c.display_name_auth_tag AS customer_name_auth_tag, c.display_name_key_id AS customer_name_key_id,
               v.plate_ciphertext AS vehicle_plate_ciphertext, v.plate_nonce AS vehicle_plate_nonce,
               v.plate_auth_tag AS vehicle_plate_auth_tag, v.plate_key_id AS vehicle_plate_key_id,
               v.make AS vehicle_make, v.model AS vehicle_model
        FROM appointments a
        LEFT JOIN customers c ON c.id = a.customer_id AND c.tenant_id = a.tenant_id
        LEFT JOIN vehicles v ON v.id = a.vehicle_id AND v.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1 AND a.id = $2
      `, [context.tenantId, appointmentId]);

      return revealAppointment(fresh.rows[0], pii);
    });

    return reply.code(201).send({ data: appointment, correlationId: request.id });
  });
}

function revealAppointment(row: any, pii: PiiProtection) {
  let sensitive: { symptoms: string[]; notes?: string } = { symptoms: [] };
  if (row.sensitive_details_ciphertext) {
    try {
      sensitive = JSON.parse(pii.reveal(row.tenant_id, 'appointment.sensitive_details', {
        ciphertext: row.sensitive_details_ciphertext,
        nonce: row.sensitive_details_nonce,
        authTag: row.sensitive_details_auth_tag,
        keyId: row.sensitive_details_key_id,
      })) as { symptoms: string[]; notes?: string };
    } catch { /* ignore */ }
  }

  let customerName = 'Cliente';
  let plate = 'Sin matrícula';

  if (row.customer_name_ciphertext) {
    customerName = pii.reveal(row.tenant_id, 'customer.display_name', {
      ciphertext: row.customer_name_ciphertext,
      nonce: row.customer_name_nonce,
      authTag: row.customer_name_auth_tag,
      keyId: row.customer_name_key_id,
    });
  }
  if (row.vehicle_plate_ciphertext) {
    plate = pii.reveal(row.tenant_id, 'vehicle.plate', {
      ciphertext: row.vehicle_plate_ciphertext,
      nonce: row.vehicle_plate_nonce,
      authTag: row.vehicle_plate_auth_tag,
      keyId: row.vehicle_plate_key_id,
    });
  } else if (row.vehicle_make || row.vehicle_model) {
    plate = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ');
  }

  if (row.identity_claim_ciphertext && (!row.customer_name_ciphertext || !row.vehicle_plate_ciphertext)) {
    try {
      const claim = JSON.parse(pii.reveal(row.tenant_id, 'appointment.identity_claim', {
        ciphertext: row.identity_claim_ciphertext,
        nonce: row.identity_claim_nonce,
        authTag: row.identity_claim_auth_tag,
        keyId: row.identity_claim_key_id,
      })) as { customerName?: string; plate?: string; vehicleDescription?: string };
      if (!row.customer_name_ciphertext && claim.customerName) customerName = claim.customerName;
      if (!row.vehicle_plate_ciphertext && (claim.plate || claim.vehicleDescription)) {
        plate = claim.plate || claim.vehicleDescription || plate;
      }
    } catch { /* ignore */ }
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    workshop_id: row.workshop_id,
    case_id: row.case_id,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    identity_resolution: row.identity_resolution_status,
    service_request: { ...row.service_request, symptoms: sensitive.symptoms, notes: sensitive.notes },
    start_at: row.start_at,
    end_at: row.end_at,
    status: row.status,
    confirmation_evidence_ref: row.confirmation_evidence_ref,
    version: row.version,
    origin: row.origin,
    customer_name: customerName,
    vehicle_plate: plate,
  };
}
