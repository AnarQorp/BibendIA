import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { inAuthorizedTenantTransaction } from '../auth/tenant-authorization.js';
import { assertTenantOperation } from '../modules/tenant-control/tenant-control.js';
import type { PiiProtection } from '../security/pii-protection.js';
import { normalizeSpanishPlate } from '../security/pii-protection.js';
import {
  insertProtectedCustomer,
  insertProtectedVehicle,
  updateProtectedCustomer,
  updateProtectedVehicle,
  revealCustomerRow,
  revealVehicleRow,
  normalizeSpanishOrE164Phone,
} from '../security/protected-records.js';
import { workshopServiceDurationPolicySchema, resolveServiceDuration, serviceIntentSchema } from '../modules/scheduling/service-duration-policy.js';
import {
  assertWorkshopCapacity, resolveCapacityRequirements, vehiclesCurrentlyOnSite, workshopCapacityPolicySchema,
} from '../modules/scheduling/workshop-capacity-policy.js';

export class WorkshopOperationsError extends Error {
  constructor(readonly code: 'WORKSHOP_NOT_FOUND' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT') { super(code); }
}

const tenantParams = z.object({ tenantId: z.string().uuid() });
const customerParams = z.object({ tenantId: z.string().uuid(), customerId: z.string().uuid() });
const vehicleParams = z.object({ tenantId: z.string().uuid(), vehicleId: z.string().uuid() });
const workshopParams = z.object({ tenantId: z.string().uuid(), workshopId: z.string().uuid() });
const appointmentParams = z.object({ tenantId: z.string().uuid(), appointmentId: z.string().uuid() });
const appointmentOperationalStatusSchema = z.object({
  status: z.enum(['awaiting_arrival','on_site','in_progress','waiting','completed','delivered','cancelled']),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(200),
}).strict();
const allowedAppointmentTransitions: Record<string, readonly string[]> = {
  tentative: ['held','cancelled'], held: ['confirmed','cancelled'],
  confirmed: ['awaiting_arrival','on_site','cancelled'], awaiting_arrival: ['on_site','cancelled'],
  on_site: ['in_progress','waiting','completed'], in_progress: ['waiting','completed'],
  waiting: ['in_progress','completed'], completed: ['delivered'], delivered: [], cancelled: [],
};

const workshopCapacityPatchSchema = z.object({
  openingHours: z.record(z.string(), z.unknown()).optional(),
  serviceDurationPolicy: workshopServiceDurationPolicySchema.optional(),
  capacityPolicy: workshopCapacityPolicySchema.optional(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(200),
}).strict().refine((value) => value.openingHours !== undefined || value.serviceDurationPolicy !== undefined || value.capacityPolicy !== undefined, {
  message: 'At least one policy must be updated',
});

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
  allowDuplicate: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
}).strict();

const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  allowDuplicate: z.boolean().optional(),
}).strict().refine((d) => d.name !== undefined || d.phone !== undefined || d.email !== undefined || d.notes !== undefined, {
  message: 'Al menos un campo debe ser actualizado.',
});

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

const updateVehicleSchema = z.object({
  plate: z.string().trim().min(2).max(20).nullable().optional(),
  make: z.string().trim().min(1).max(100).nullable().optional(),
  model: z.string().trim().min(1).max(100).nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  vin: z.string().trim().min(5).max(50).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
}).strict().refine((d) => d.plate !== undefined || d.make !== undefined || d.model !== undefined || d.year !== undefined || d.vin !== undefined || d.customerId !== undefined, {
  message: 'Al menos un campo debe ser actualizado.',
});

const associateRoleSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  role: z.string().trim().min(1).max(50).default('owner'),
}).strict();

const createManualAppointmentSchema = z.object({
  idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  serviceIntent: z.string().trim().min(1).max(200),
  customerWaitMode: z.enum(['DROP_OFF','WAIT_ON_SITE']).default('DROP_OFF'),
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

  app.get('/v1/workshop/tenants/:tenantId/workshops', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_TENANT_SELECTOR', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const data = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal, requestedTenantId: params.data.tenantId,
      capability: 'workshop:appointments:read', correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'workshop_read');
      const result = await client.query<{
        id: string;
        tenant_id: string;
        name: string;
        timezone: string;
        version: number;
      }>(
        'SELECT id,tenant_id,name,timezone,version FROM workshops WHERE tenant_id=$1 ORDER BY name,id',
        [context.tenantId],
      );
      return result.rows;
    });
    return { data, correlationId: request.id };
  });

  app.get('/v1/workshop/tenants/:tenantId/workshops/:workshopId/capacity', auth, async (request, reply) => {
    const params = workshopParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_WORKSHOP_SELECTOR', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const data = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal, requestedTenantId: params.data.tenantId,
      capability: 'workshop:configuration:read', correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'workshop_read');
      const result = await client.query(
        `SELECT id,tenant_id,opening_hours,service_duration_policy,capacity_policy,version,updated_at
         FROM workshops WHERE tenant_id=$1 AND id=$2`, [context.tenantId, params.data.workshopId],
      );
      if (result.rowCount !== 1) throw new WorkshopOperationsError('WORKSHOP_NOT_FOUND');
      return { ...result.rows[0], vehiclesCurrentlyOnSite: await vehiclesCurrentlyOnSite(client, context.tenantId, params.data.workshopId) };
    });
    return { data, correlationId: request.id };
  });

  app.patch('/v1/workshop/tenants/:tenantId/workshops/:workshopId/capacity', auth, async (request, reply) => {
    const params = workshopParams.safeParse(request.params);
    const body = workshopCapacityPatchSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'INVALID_WORKSHOP_CAPACITY_PAYLOAD', correlationId: request.id });
    if (!request.principal || request.principal.kind !== 'workshop_user') return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const data = await inAuthorizedTenantTransaction(pool, {
      principal: request.principal, requestedTenantId: params.data.tenantId,
      capability: 'workshop:configuration:update', correlationId: request.id,
    }, async (client, context) => {
      await assertTenantOperation(client, context.tenantId, 'domain_mutation');
      const actorId = request.principal!.kind === 'workshop_user' ? request.principal!.userId : '';
      const payloadHash = createHash('sha256').update(JSON.stringify(body.data)).digest('hex');
      const replay = await client.query(
        `SELECT workshop_id,operation,payload_hash,after_jsonb FROM workshop_command_receipts
         WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3`,
        [context.tenantId, actorId, body.data.idempotencyKey],
      );
      if (replay.rowCount) {
        if (replay.rows[0].workshop_id !== params.data.workshopId || replay.rows[0].operation !== 'workshop.capacity.update'
          || replay.rows[0].payload_hash !== payloadHash) throw new WorkshopOperationsError('IDEMPOTENCY_CONFLICT');
        return replay.rows[0].after_jsonb;
      }
      const before = await client.query(
        `SELECT id,tenant_id,opening_hours,service_duration_policy,capacity_policy,version,updated_at
         FROM workshops WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [context.tenantId, params.data.workshopId],
      );
      if (before.rowCount !== 1) throw new WorkshopOperationsError('WORKSHOP_NOT_FOUND');
      const updated = await client.query(
        `UPDATE workshops SET opening_hours=COALESCE($3,opening_hours),
           service_duration_policy=COALESCE($4,service_duration_policy),capacity_policy=COALESCE($5,capacity_policy),
           version=version+1,updated_at=now()
         WHERE tenant_id=$1 AND id=$2 AND version=$6
         RETURNING id,tenant_id,opening_hours,service_duration_policy,capacity_policy,version,updated_at`,
        [context.tenantId, params.data.workshopId, body.data.openingHours ?? null,
          body.data.serviceDurationPolicy ?? null, body.data.capacityPolicy ?? null, body.data.expectedVersion],
      );
      if (updated.rowCount !== 1) throw new WorkshopOperationsError('VERSION_CONFLICT');
      const after = updated.rows[0];
      await client.query(
        `INSERT INTO workshop_command_receipts
         (tenant_id,workshop_id,operation,actor_id,idempotency_key,payload_hash,before_jsonb,after_jsonb,correlation_id)
         VALUES($1,$2,'workshop.capacity.update',$3,$4,$5,$6,$7,$8)`,
        [context.tenantId, params.data.workshopId, actorId, body.data.idempotencyKey, payloadHash,
          before.rows[0], after, request.id],
      );
      await client.query(
        `INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
         VALUES($1,'human',$2,'workshop_capacity_updated','workshop',$3,$4,$5)`,
        [context.tenantId, actorId, params.data.workshopId, request.id,
          `postgres:workshop-command:${body.data.idempotencyKey}`],
      );
      return after;
    });
    return { data, correlationId: request.id };
  });

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

      const exactIds: string[] = [];
      if (query.data.search) {
        const term = query.data.search.trim();
        const candidateDigests: string[] = [];
        if (term.includes('@')) {
          candidateDigests.push(...pii.lookupDigests(context.tenantId, 'customer.email', term.toLowerCase()).map((d) => d.digest));
        }
        if (/[\d]{6,}/.test(term.replace(/[\s().+-]/g, ''))) {
          try {
            const normPhone = normalizeSpanishOrE164Phone(term);
            candidateDigests.push(...pii.lookupDigests(context.tenantId, 'customer.phone', normPhone).map((d) => d.digest));
          } catch { /* ignore */ }
        }
        try {
          const normPlate = normalizeSpanishPlate(term);
          const plateDigests = pii.lookupDigests(context.tenantId, 'vehicle.plate', normPlate).map((d) => d.digest);
          if (plateDigests.length > 0) {
            const vRes = await client.query(`
              SELECT r.customer_id
              FROM customer_vehicle_roles r
              JOIN vehicles v ON v.id = r.vehicle_id AND v.tenant_id = r.tenant_id
              WHERE r.tenant_id = $1 AND v.plate_lookup_digest = ANY($2::text[])
            `, [context.tenantId, plateDigests]);
            if (vRes.rowCount) {
              exactIds.push(...vRes.rows.map((r: any) => r.customer_id as string));
            }
          }
        } catch { /* ignore */ }

        if (candidateDigests.length > 0) {
          const dRes = await client.query(`
            SELECT id FROM customers
            WHERE tenant_id = $1 AND (phone_lookup_digest = ANY($2::text[]) OR email_lookup_digest = ANY($2::text[]))
          `, [context.tenantId, candidateDigests]);
          if (dRes.rowCount) {
            exactIds.push(...dRes.rows.map((r: any) => r.id as string));
          }
        }
      }

      const hasExactMatches = exactIds.length > 0;
      const sql = hasExactMatches
        ? `SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
                  phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
                  email_ciphertext, email_nonce, email_auth_tag, email_key_id,
                  notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
           FROM customers
           WHERE tenant_id = $1 AND pii_migration_state = 'protected' AND id = ANY($2::uuid[])
           ORDER BY id DESC
           LIMIT 100`
        : `SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
                  phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
                  email_ciphertext, email_nonce, email_auth_tag, email_key_id,
                  notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
           FROM customers
           WHERE tenant_id = $1 AND pii_migration_state = 'protected'
           ORDER BY id DESC
           LIMIT 100`;

      const result = await client.query(sql, exactIds && exactIds.length > 0 ? [context.tenantId, exactIds] : [context.tenantId]);
      const revealed = result.rows.map((row) => revealCustomerRow(row, pii));

      const customerIds = revealed.map((c) => c.id);
      const customerVehicles: Record<string, any[]> = {};
      const apptCounts: Record<string, { count: number; last?: string }> = {};
      const draftCounts: Record<string, number> = {};

      if (customerIds.length > 0) {
        const vResult = await client.query(`
          SELECT r.customer_id, v.id, v.tenant_id, v.make, v.model, v.year,
                 v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id
          FROM customer_vehicle_roles r
          JOIN vehicles v ON v.id = r.vehicle_id AND v.tenant_id = r.tenant_id
          WHERE r.tenant_id = $1 AND r.customer_id = ANY($2::uuid[])
        `, [context.tenantId, customerIds]);

        for (const row of vResult.rows) {
          const v = revealVehicleRow(row, pii);
          if (!customerVehicles[row.customer_id]) customerVehicles[row.customer_id] = [];
          customerVehicles[row.customer_id].push(v);
        }

        const aResult = await client.query(`
          SELECT a.customer_id, COUNT(*)::int AS cnt, MAX(a.start_at) AS last_appt
          FROM appointments a
          WHERE a.tenant_id = $1 AND a.customer_id = ANY($2::uuid[])
          GROUP BY a.customer_id
        `, [context.tenantId, customerIds]);
        for (const row of aResult.rows) {
          apptCounts[row.customer_id] = { count: row.cnt, last: row.last_appt ? new Date(row.last_appt).toISOString() : undefined };
        }

        const dResult = await client.query(`
          SELECT d.customer_id, COUNT(*)::int AS cnt
          FROM estimate_drafts d
          WHERE d.tenant_id = $1 AND d.customer_id = ANY($2::uuid[]) AND d.status <> 'superseded'
          GROUP BY d.customer_id
        `, [context.tenantId, customerIds]);
        for (const row of dResult.rows) {
          draftCounts[row.customer_id] = row.cnt;
        }
      }

      const enriched = revealed.map((c) => {
        const vehicles = customerVehicles[c.id] || [];
        const apptInfo = apptCounts[c.id] || { count: 0 };
        const dCount = draftCounts[c.id] || 0;
        return {
          ...c,
          vehicles,
          activitySummary: {
            appointmentsCount: apptInfo.count,
            estimatesCount: dCount,
            lastAppointmentAt: apptInfo.last,
          },
        };
      });

      if (query.data.search && !exactIds) {
        const searchLower = query.data.search.toLowerCase();
        return enriched.filter((c) =>
          c.name.toLowerCase().includes(searchLower) ||
          (c.phone && c.phone.toLowerCase().includes(searchLower)) ||
          (c.email && c.email.toLowerCase().includes(searchLower)) ||
          c.vehicles.some((v: any) => v.plate && v.plate.toLowerCase().includes(searchLower))
        ).slice(query.data.offset, query.data.offset + query.data.limit);
      }

      return enriched.slice(query.data.offset, query.data.offset + query.data.limit);
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

    try {
      const customer = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:customers:create',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'domain_mutation');

        // Suggest/handle duplicate phone if provided
        if (body.data.phone && !body.data.allowDuplicate) {
          const normalizedPhone = normalizeSpanishOrE164Phone(body.data.phone);
          const candidates = pii.lookupDigests(context.tenantId, 'customer.phone', normalizedPhone).map((i) => i.digest);
          const existing = await client.query(`
            SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
                   phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
                   email_ciphertext, email_nonce, email_auth_tag, email_key_id,
                   notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
            FROM customers
            WHERE tenant_id = $1 AND phone_lookup_digest = ANY($2::text[])
            LIMIT 1
          `, [context.tenantId, candidates]);
          if (existing.rowCount) {
            return {
              duplicateSuggestion: true,
              existingCustomer: revealCustomerRow(existing.rows[0], pii),
            };
          }
        }

        const id = randomUUID();
        await insertProtectedCustomer(client, pii, {
          id,
          tenantId: context.tenantId,
          displayName: body.data.name,
          phone: body.data.phone ?? null,
          email: body.data.email ?? null,
          notes: body.data.notes ?? null,
          allowDuplicatePhone: true,
        });
        return {
          id,
          name: body.data.name,
          phone: body.data.phone ?? null,
          email: body.data.email ?? null,
          notes: body.data.notes ?? null,
        };
      });

      if ('duplicateSuggestion' in customer) {
        return reply.code(200).send({
          status: 'duplicate_suggestion',
          code: 'CUSTOMER_PHONE_EXISTS',
          message: 'Ya existe un cliente registrado con este teléfono en el taller.',
          existingCustomer: (customer as any).existingCustomer,
          correlationId: request.id,
        });
      }

      return reply.code(201).send({ data: customer, correlationId: request.id });
    } catch (err: any) {
      if (err.code === '23505' || err.message === 'PII_LOOKUP_CONFLICT' || err.code === 'CUSTOMER_PHONE_EXISTS') {
        return reply.code(409).send({
          error: 'CUSTOMER_PHONE_EXISTS',
          code: 'CUSTOMER_PHONE_EXISTS',
          message: 'Ya existe un cliente registrado con este teléfono en el taller (regla canónica estricta).',
          correlationId: request.id,
        });
      }
      throw err;
    }
  });

  // 3. Customers: Detail (Ficha)
  app.get('/v1/workshop/tenants/:tenantId/customers/:customerId', auth, async (request, reply) => {
    const params = customerParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_CUSTOMER_ID', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const data = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:customers:read',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'workshop_read');

        const cRes = await client.query(`
          SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
                 phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
                 email_ciphertext, email_nonce, email_auth_tag, email_key_id,
                 notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
          FROM customers
          WHERE tenant_id = $1 AND id = $2 AND pii_migration_state = 'protected'
        `, [context.tenantId, params.data.customerId]);
        if (!cRes.rowCount) throw new Error('CUSTOMER_NOT_FOUND');

        const customer = revealCustomerRow(cRes.rows[0], pii);

        // Associated vehicles
        const vRes = await client.query(`
          SELECT v.id, v.tenant_id, v.make, v.model, v.year,
                 v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                 v.vin_ciphertext, v.vin_nonce, v.vin_auth_tag, v.vin_key_id
          FROM customer_vehicle_roles r
          JOIN vehicles v ON v.id = r.vehicle_id AND v.tenant_id = r.tenant_id
          WHERE r.tenant_id = $1 AND r.customer_id = $2
          ORDER BY v.id DESC
        `, [context.tenantId, params.data.customerId]);
        const vehicles = vRes.rows.map((r) => revealVehicleRow(r, pii));

        // Appointments
        const aRes = await client.query(`
          SELECT a.id, a.tenant_id, a.workshop_id, a.start_at, a.end_at, a.status, a.origin, a.service_request,
                 a.vehicle_id,
                 v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                 v.make AS vehicle_make, v.model AS vehicle_model
          FROM appointments a
          LEFT JOIN vehicles v ON v.id = a.vehicle_id AND v.tenant_id = a.tenant_id
          WHERE a.tenant_id = $1 AND a.customer_id = $2
          ORDER BY a.start_at DESC
          LIMIT 50
        `, [context.tenantId, params.data.customerId]);

        const appointments = aRes.rows.map((row: any) => {
          let vehiclePlate = row.vehicle_make || row.vehicle_model ? [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') : null;
          if (row.plate_ciphertext) {
            try {
              vehiclePlate = pii.reveal(row.tenant_id, 'vehicle.plate', {
                ciphertext: row.plate_ciphertext,
                nonce: row.plate_nonce,
                authTag: row.plate_auth_tag,
                keyId: row.plate_key_id,
              });
            } catch { /* ignore */ }
          }
          return {
            id: row.id,
            startAt: row.start_at,
            endAt: row.end_at,
            serviceIntent: row.service_request?.intent || 'Cita de taller',
            status: row.status,
            origin: row.origin,
            vehicleId: row.vehicle_id,
            vehiclePlate,
            vehicleMake: row.vehicle_make,
            vehicleModel: row.vehicle_model,
          };
        });

        // Estimate Drafts
        const dRes = await client.query(`
          SELECT d.id, d.tenant_id, d.title, d.draft_type, d.status, d.created_at, d.updated_at, d.vehicle_id,
                 (SELECT COALESCE(SUM(l.unit_price * COALESCE(l.quantity, 1)), 0)
                  FROM estimate_draft_lines l
                  WHERE l.draft_id = d.id AND l.selected = true AND l.unit_price IS NOT NULL) AS total_amount,
                 (SELECT COUNT(*) FROM estimate_draft_lines l WHERE l.draft_id = d.id AND l.line_source = 'REPAIR_KNOWLEDGE') AS rk_lines_count,
                 (SELECT COUNT(*) FROM estimate_draft_lines l WHERE l.draft_id = d.id AND l.line_source = 'MANUAL_WORKSHOP') AS manual_lines_count,
                 v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                 v.make AS vehicle_make, v.model AS vehicle_model
          FROM estimate_drafts d
          LEFT JOIN vehicles v ON v.id = d.vehicle_id AND v.tenant_id = d.tenant_id
          WHERE d.tenant_id = $1 AND d.customer_id = $2 AND d.status <> 'superseded'
          ORDER BY d.updated_at DESC
          LIMIT 50
        `, [context.tenantId, params.data.customerId]);

        const estimates = dRes.rows.map((row: any) => {
          let vehiclePlate = row.vehicle_make || row.vehicle_model ? [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') : null;
          if (row.plate_ciphertext) {
            try {
              vehiclePlate = pii.reveal(row.tenant_id, 'vehicle.plate', {
                ciphertext: row.plate_ciphertext,
                nonce: row.plate_nonce,
                authTag: row.plate_auth_tag,
                keyId: row.plate_key_id,
              });
            } catch { /* ignore */ }
          }
          let provenance: 'manual' | 'rk' | 'mixed' = 'manual';
          if (row.draft_type === 'REPAIR_KNOWLEDGE') {
            provenance = Number(row.manual_lines_count) > 0 ? 'mixed' : 'rk';
          } else {
            provenance = 'manual';
          }
          return {
            id: row.id,
            title: row.title,
            draftType: row.draft_type,
            provenance,
            status: row.status,
            total: Math.round(Number(row.total_amount) * 100) / 100,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            vehicleId: row.vehicle_id,
            vehiclePlate,
            vehicleMake: row.vehicle_make,
            vehicleModel: row.vehicle_model,
          };
        });

        return { customer, vehicles, activity: { appointments, estimates } };
      });

      return { data, correlationId: request.id };
    } catch (err: any) {
      if (err.message === 'CUSTOMER_NOT_FOUND') {
        return reply.code(404).send({ error: 'CUSTOMER_NOT_FOUND', correlationId: request.id });
      }
      throw err;
    }
  });

  // 4. Customers: Update (Ficha Edit)
  app.patch('/v1/workshop/tenants/:tenantId/customers/:customerId', auth, async (request, reply) => {
    const params = customerParams.safeParse(request.params);
    const body = updateCustomerSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'INVALID_CUSTOMER_UPDATE_PAYLOAD',
        message: body.success ? undefined : body.error.issues[0]?.message,
        correlationId: request.id,
      });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const updated = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:customers:update',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'domain_mutation');

        if (body.data.phone && !body.data.allowDuplicate) {
          const normalizedPhone = normalizeSpanishOrE164Phone(body.data.phone);
          const candidates = pii.lookupDigests(context.tenantId, 'customer.phone', normalizedPhone).map((i) => i.digest);
          const conflict = await client.query(`
            SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
                   phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
                   email_ciphertext, email_nonce, email_auth_tag, email_key_id,
                   notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
            FROM customers
            WHERE tenant_id = $1 AND phone_lookup_digest = ANY($2::text[]) AND id <> $3
            LIMIT 1
          `, [context.tenantId, candidates, params.data.customerId]);
          if (conflict.rowCount) {
            return {
              duplicateSuggestion: true,
              existingCustomer: revealCustomerRow(conflict.rows[0], pii),
            };
          }
        }

        await updateProtectedCustomer(client, pii, {
          customerId: params.data.customerId,
          tenantId: context.tenantId,
          displayName: body.data.name,
          phone: body.data.phone,
          email: body.data.email,
          notes: body.data.notes,
          allowDuplicatePhone: true,
        });

        const fresh = await client.query(`
          SELECT id, tenant_id, display_name_ciphertext, display_name_nonce, display_name_auth_tag, display_name_key_id,
                 phone_ciphertext, phone_nonce, phone_auth_tag, phone_key_id,
                 email_ciphertext, email_nonce, email_auth_tag, email_key_id,
                 notes_ciphertext, notes_nonce, notes_auth_tag, notes_key_id
          FROM customers
          WHERE tenant_id = $1 AND id = $2
        `, [context.tenantId, params.data.customerId]);

        return revealCustomerRow(fresh.rows[0], pii);
      });

      if ('duplicateSuggestion' in updated) {
        return reply.code(200).send({
          status: 'duplicate_suggestion',
          code: 'CUSTOMER_PHONE_EXISTS',
          message: 'Ya existe un cliente con este teléfono en el taller.',
          existingCustomer: (updated as any).existingCustomer,
          correlationId: request.id,
        });
      }

      return { data: updated, correlationId: request.id };
    } catch (err: any) {
      if (err.message === 'CUSTOMER_NOT_FOUND') {
        return reply.code(404).send({ error: 'CUSTOMER_NOT_FOUND', correlationId: request.id });
      }
      if (err.code === '23505' || err.message === 'PII_LOOKUP_CONFLICT' || err.code === 'CUSTOMER_PHONE_EXISTS') {
        return reply.code(409).send({
          error: 'CUSTOMER_PHONE_EXISTS',
          code: 'CUSTOMER_PHONE_EXISTS',
          message: 'Ya existe un cliente con este teléfono en el taller.',
          correlationId: request.id,
        });
      }
      throw err;
    }
  });

  // 5. Vehicles: List
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

      let exactVehicleIds: string[] | null = null;
      if (query.data.search) {
        const term = query.data.search.trim();
        const candidateDigests: string[] = [];
        try {
          const normPlate = normalizeSpanishPlate(term);
          candidateDigests.push(...pii.lookupDigests(context.tenantId, 'vehicle.plate', normPlate).map((d) => d.digest));
        } catch { /* ignore */ }
        if (term.length >= 5) {
          candidateDigests.push(...pii.lookupDigests(context.tenantId, 'vehicle.vin', term.toUpperCase()).map((d) => d.digest));
        }
        if (candidateDigests.length > 0) {
          const vRes = await client.query(`
            SELECT id FROM vehicles
            WHERE tenant_id = $1 AND (plate_lookup_digest = ANY($2::text[]) OR vin_lookup_digest = ANY($2::text[]))
          `, [context.tenantId, candidateDigests]);
          if (vRes.rowCount) {
            exactVehicleIds = vRes.rows.map((r: any) => r.id);
          }
        }
      }

      const sql = query.data.customerId
        ? `SELECT v.id, v.tenant_id, v.make, v.model, v.year,
                  v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                  v.vin_ciphertext, v.vin_nonce, v.vin_auth_tag, v.vin_key_id,
                  r.customer_id,
                  c.display_name_ciphertext, c.display_name_nonce, c.display_name_auth_tag, c.display_name_key_id,
                  c.phone_ciphertext, c.phone_nonce, c.phone_auth_tag, c.phone_key_id
           FROM vehicles v
           JOIN customer_vehicle_roles r ON r.vehicle_id = v.id AND r.tenant_id = v.tenant_id
           LEFT JOIN customers c ON c.id = r.customer_id AND c.tenant_id = v.tenant_id
           WHERE v.tenant_id = $1 AND v.pii_migration_state = 'protected' AND r.customer_id = $2
           ORDER BY v.id DESC
           LIMIT 100`
        : exactVehicleIds && exactVehicleIds.length > 0
        ? `SELECT v.id, v.tenant_id, v.make, v.model, v.year,
                  v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                  v.vin_ciphertext, v.vin_nonce, v.vin_auth_tag, v.vin_key_id,
                  (SELECT r.customer_id FROM customer_vehicle_roles r WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS customer_id,
                  (SELECT c.display_name_ciphertext FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_ciphertext,
                  (SELECT c.display_name_nonce FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_nonce,
                  (SELECT c.display_name_auth_tag FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_auth_tag,
                  (SELECT c.display_name_key_id FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_key_id,
                  (SELECT c.phone_ciphertext FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_ciphertext,
                  (SELECT c.phone_nonce FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_nonce,
                  (SELECT c.phone_auth_tag FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_auth_tag,
                  (SELECT c.phone_key_id FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_key_id
           FROM vehicles v
           WHERE v.tenant_id = $1 AND v.pii_migration_state = 'protected' AND v.id = ANY($2::uuid[])
           ORDER BY v.id DESC
           LIMIT 100`
        : `SELECT v.id, v.tenant_id, v.make, v.model, v.year,
                  v.plate_ciphertext, v.plate_nonce, v.plate_auth_tag, v.plate_key_id,
                  v.vin_ciphertext, v.vin_nonce, v.vin_auth_tag, v.vin_key_id,
                  (SELECT r.customer_id FROM customer_vehicle_roles r WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS customer_id,
                  (SELECT c.display_name_ciphertext FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_ciphertext,
                  (SELECT c.display_name_nonce FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_nonce,
                  (SELECT c.display_name_auth_tag FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_auth_tag,
                  (SELECT c.display_name_key_id FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS display_name_key_id,
                  (SELECT c.phone_ciphertext FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_ciphertext,
                  (SELECT c.phone_nonce FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_nonce,
                  (SELECT c.phone_auth_tag FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_auth_tag,
                  (SELECT c.phone_key_id FROM customer_vehicle_roles r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id LIMIT 1) AS phone_key_id
           FROM vehicles v
           WHERE v.tenant_id = $1 AND v.pii_migration_state = 'protected'
           ORDER BY v.id DESC
           LIMIT 100`;

      const queryArgs = query.data.customerId ? [context.tenantId, query.data.customerId] : exactVehicleIds && exactVehicleIds.length > 0 ? [context.tenantId, exactVehicleIds] : [context.tenantId];
      const result = await client.query(sql, queryArgs);

      let revealed = result.rows.map((row) => {
        const v = revealVehicleRow(row, pii);
        let customer: { id: string; name: string; phone?: string | null } | null = null;
        if (row.customer_id) {
          const custRow = {
            id: row.customer_id,
            tenant_id: row.tenant_id,
            display_name_ciphertext: row.display_name_ciphertext,
            display_name_nonce: row.display_name_nonce,
            display_name_auth_tag: row.display_name_auth_tag,
            display_name_key_id: row.display_name_key_id,
            phone_ciphertext: row.phone_ciphertext,
            phone_nonce: row.phone_nonce,
            phone_auth_tag: row.phone_auth_tag,
            phone_key_id: row.phone_key_id,
          };
          const c = revealCustomerRow(custRow as any, pii);
          customer = { id: c.id, name: c.name, phone: c.phone };
        }
        return { ...v, customer };
      });

      if (query.data.search && !exactVehicleIds) {
        const searchLower = query.data.search.toLowerCase();
        revealed = revealed.filter((v) =>
          (v.plate && v.plate.toLowerCase().includes(searchLower)) ||
          (v.make && v.make.toLowerCase().includes(searchLower)) ||
          (v.model && v.model.toLowerCase().includes(searchLower)) ||
          (v.vin && v.vin.toLowerCase().includes(searchLower)) ||
          (v.customer && v.customer.name.toLowerCase().includes(searchLower))
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
          code: 'VEHICLE_PLATE_EXISTS',
          message: 'Ya existe un vehículo registrado con esta matrícula en el taller.',
          existingVehicle: err.existingVehicle,
          correlationId: request.id,
        });
      }
      if (err.message === 'VEHICLE_VIN_EXISTS') {
        return reply.code(409).send({
          error: 'VEHICLE_VIN_EXISTS',
          code: 'VEHICLE_VIN_EXISTS',
          message: 'Ya existe un vehículo registrado con este VIN en el taller.',
          existingVehicle: err.existingVehicle,
          correlationId: request.id,
        });
      }
      throw err;
    }
  });

  // 5. Vehicles: Detail (Ficha)
  app.get('/v1/workshop/tenants/:tenantId/vehicles/:vehicleId', auth, async (request, reply) => {
    const params = vehicleParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_VEHICLE_ID', correlationId: request.id });
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const data = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:vehicles:read',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'workshop_read');

        const vRes = await client.query(`
          SELECT id, tenant_id, make, model, year,
                 plate_ciphertext, plate_nonce, plate_auth_tag, plate_key_id,
                 vin_ciphertext, vin_nonce, vin_auth_tag, vin_key_id
          FROM vehicles
          WHERE tenant_id = $1 AND id = $2 AND pii_migration_state = 'protected'
        `, [context.tenantId, params.data.vehicleId]);
        if (!vRes.rowCount) throw new Error('VEHICLE_NOT_FOUND');

        const vehicle = revealVehicleRow(vRes.rows[0], pii);

        // Associated customers
        const cRes = await client.query(`
          SELECT c.id, c.tenant_id,
                 c.display_name_ciphertext, c.display_name_nonce, c.display_name_auth_tag, c.display_name_key_id,
                 c.phone_ciphertext, c.phone_nonce, c.phone_auth_tag, c.phone_key_id,
                 c.email_ciphertext, c.email_nonce, c.email_auth_tag, c.email_key_id
          FROM customer_vehicle_roles r
          JOIN customers c ON c.id = r.customer_id AND c.tenant_id = r.tenant_id
          WHERE r.tenant_id = $1 AND r.vehicle_id = $2
          ORDER BY c.id
        `, [context.tenantId, params.data.vehicleId]);

        const customers = cRes.rows.map((r) => revealCustomerRow(r, pii));
        const customer = customers[0] ?? null;

        // Appointments
        const aRes = await client.query(`
          SELECT a.id, a.tenant_id, a.workshop_id, a.start_at, a.end_at, a.status, a.origin, a.service_request,
                 a.customer_id,
                 c.display_name_ciphertext, c.display_name_nonce, c.display_name_auth_tag, c.display_name_key_id
          FROM appointments a
          LEFT JOIN customers c ON c.id = a.customer_id AND c.tenant_id = a.tenant_id
          WHERE a.tenant_id = $1 AND a.vehicle_id = $2
          ORDER BY a.start_at DESC
          LIMIT 50
        `, [context.tenantId, params.data.vehicleId]);

        const appointments = aRes.rows.map((row: any) => {
          let customerName = 'Cliente';
          if (row.display_name_ciphertext) {
            try {
              customerName = pii.reveal(row.tenant_id, 'customer.display_name', {
                ciphertext: row.display_name_ciphertext,
                nonce: row.display_name_nonce,
                authTag: row.display_name_auth_tag,
                keyId: row.display_name_key_id,
              });
            } catch { /* ignore */ }
          }
          return {
            id: row.id,
            startAt: row.start_at,
            endAt: row.end_at,
            serviceIntent: row.service_request?.intent || 'Cita de taller',
            status: row.status,
            origin: row.origin,
            customerId: row.customer_id,
            customerName,
          };
        });

        // Estimate Drafts
        const dRes = await client.query(`
          SELECT d.id, d.tenant_id, d.title, d.draft_type, d.status, d.created_at, d.updated_at, d.customer_id,
                 (SELECT COALESCE(SUM(l.unit_price * COALESCE(l.quantity, 1)), 0)
                  FROM estimate_draft_lines l
                  WHERE l.draft_id = d.id AND l.selected = true AND l.unit_price IS NOT NULL) AS total_amount,
                 (SELECT COUNT(*) FROM estimate_draft_lines l WHERE l.draft_id = d.id AND l.line_source = 'REPAIR_KNOWLEDGE') AS rk_lines_count,
                 (SELECT COUNT(*) FROM estimate_draft_lines l WHERE l.draft_id = d.id AND l.line_source = 'MANUAL_WORKSHOP') AS manual_lines_count,
                 c.display_name_ciphertext, c.display_name_nonce, c.display_name_auth_tag, c.display_name_key_id
          FROM estimate_drafts d
          LEFT JOIN customers c ON c.id = d.customer_id AND c.tenant_id = d.tenant_id
          WHERE d.tenant_id = $1 AND d.vehicle_id = $2 AND d.status <> 'superseded'
          ORDER BY d.updated_at DESC
          LIMIT 50
        `, [context.tenantId, params.data.vehicleId]);

        const estimates = dRes.rows.map((row: any) => {
          let customerName = 'Cliente';
          if (row.display_name_ciphertext) {
            try {
              customerName = pii.reveal(row.tenant_id, 'customer.display_name', {
                ciphertext: row.display_name_ciphertext,
                nonce: row.display_name_nonce,
                authTag: row.display_name_auth_tag,
                keyId: row.display_name_key_id,
              });
            } catch { /* ignore */ }
          }
          let provenance: 'manual' | 'rk' | 'mixed' = 'manual';
          if (row.draft_type === 'REPAIR_KNOWLEDGE') {
            provenance = Number(row.manual_lines_count) > 0 ? 'mixed' : 'rk';
          } else {
            provenance = 'manual';
          }
          return {
            id: row.id,
            title: row.title,
            draftType: row.draft_type,
            provenance,
            status: row.status,
            total: Math.round(Number(row.total_amount) * 100) / 100,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            customerId: row.customer_id,
            customerName,
          };
        });

        return { vehicle, customer, customers, activity: { appointments, estimates } };
      });

      return { data, correlationId: request.id };
    } catch (err: any) {
      if (err.message === 'VEHICLE_NOT_FOUND') {
        return reply.code(404).send({ error: 'VEHICLE_NOT_FOUND', correlationId: request.id });
      }
      throw err;
    }
  });

  // 6. Vehicles: Update (Ficha Edit)
  app.patch('/v1/workshop/tenants/:tenantId/vehicles/:vehicleId', auth, async (request, reply) => {
    const params = vehicleParams.safeParse(request.params);
    const body = updateVehicleSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'INVALID_VEHICLE_UPDATE_PAYLOAD',
        message: body.success ? undefined : body.error.issues[0]?.message,
        correlationId: request.id,
      });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const updated = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:vehicles:update',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'domain_mutation');

        // Check duplicate plate
        if (body.data.plate) {
          const normalizedPlate = normalizeSpanishPlate(body.data.plate);
          const candidates = pii.lookupDigests(context.tenantId, 'vehicle.plate', normalizedPlate).map((i) => i.digest);
          const conflict = await client.query(`
            SELECT id, tenant_id, make, model, year,
                   plate_ciphertext, plate_nonce, plate_auth_tag, plate_key_id,
                   vin_ciphertext, vin_nonce, vin_auth_tag, vin_key_id
            FROM vehicles
            WHERE tenant_id = $1 AND plate_lookup_digest = ANY($2::text[]) AND id <> $3
            LIMIT 1
          `, [context.tenantId, candidates, params.data.vehicleId]);
          if (conflict.rowCount) {
            const conflictErr = new Error('VEHICLE_PLATE_EXISTS') as any;
            conflictErr.existingVehicle = revealVehicleRow(conflict.rows[0], pii);
            throw conflictErr;
          }
        }

        // Check duplicate VIN
        if (body.data.vin) {
          const normalizedVin = body.data.vin.trim().toUpperCase();
          const candidates = pii.lookupDigests(context.tenantId, 'vehicle.vin', normalizedVin).map((i) => i.digest);
          const conflict = await client.query(`
            SELECT id, tenant_id, make, model, year,
                   plate_ciphertext, plate_nonce, plate_auth_tag, plate_key_id,
                   vin_ciphertext, vin_nonce, vin_auth_tag, vin_key_id
            FROM vehicles
            WHERE tenant_id = $1 AND vin_lookup_digest = ANY($2::text[]) AND id <> $3
            LIMIT 1
          `, [context.tenantId, candidates, params.data.vehicleId]);
          if (conflict.rowCount) {
            const conflictErr = new Error('VEHICLE_VIN_EXISTS') as any;
            conflictErr.existingVehicle = revealVehicleRow(conflict.rows[0], pii);
            throw conflictErr;
          }
        }

        await updateProtectedVehicle(client, pii, {
          vehicleId: params.data.vehicleId,
          tenantId: context.tenantId,
          plate: body.data.plate,
          make: body.data.make,
          model: body.data.model,
          year: body.data.year,
          vin: body.data.vin,
        });

        if (body.data.customerId) {
          const cCheck = await client.query('SELECT 1 FROM customers WHERE id = $1 AND tenant_id = $2', [body.data.customerId, context.tenantId]);
          if (!cCheck.rowCount) throw new Error('CUSTOMER_NOT_FOUND');
          await client.query(`
            INSERT INTO customer_vehicle_roles (tenant_id, customer_id, vehicle_id, verification_status)
            VALUES ($1, $2, $3, 'verified')
            ON CONFLICT DO NOTHING
          `, [context.tenantId, body.data.customerId, params.data.vehicleId]);
        }

        const fresh = await client.query(`
          SELECT id, tenant_id, make, model, year,
                 plate_ciphertext, plate_nonce, plate_auth_tag, plate_key_id,
                 vin_ciphertext, vin_nonce, vin_auth_tag, vin_key_id,
                 (SELECT r.customer_id FROM customer_vehicle_roles r WHERE r.vehicle_id = vehicles.id AND r.tenant_id = vehicles.tenant_id LIMIT 1) AS customer_id
          FROM vehicles
          WHERE tenant_id = $1 AND id = $2
        `, [context.tenantId, params.data.vehicleId]);

        return revealVehicleRow(fresh.rows[0], pii);
      });

      return { data: updated, correlationId: request.id };
    } catch (err: any) {
      if (err.message === 'VEHICLE_NOT_FOUND') {
        return reply.code(404).send({ error: 'VEHICLE_NOT_FOUND', correlationId: request.id });
      }
      if (err.message === 'CUSTOMER_NOT_FOUND') {
        return reply.code(404).send({ error: 'CUSTOMER_NOT_FOUND', correlationId: request.id });
      }
      if (err.message === 'VEHICLE_PLATE_EXISTS') {
        return reply.code(409).send({
          error: 'VEHICLE_PLATE_EXISTS',
          code: 'VEHICLE_PLATE_EXISTS',
          message: 'Ya existe un vehículo registrado con esta matrícula en el taller.',
          existingVehicle: err.existingVehicle,
          correlationId: request.id,
        });
      }
      if (err.message === 'VEHICLE_VIN_EXISTS') {
        return reply.code(409).send({
          error: 'VEHICLE_VIN_EXISTS',
          code: 'VEHICLE_VIN_EXISTS',
          message: 'Ya existe un vehículo registrado con este VIN en el taller.',
          existingVehicle: err.existingVehicle,
          correlationId: request.id,
        });
      }
      throw err;
    }
  });

  // 7. Customer <-> Vehicle Association
  app.post('/v1/workshop/tenants/:tenantId/customer-vehicle-roles', auth, async (request, reply) => {
    const params = tenantParams.safeParse(request.params);
    const body = associateRoleSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'INVALID_ASSOCIATION_PAYLOAD', correlationId: request.id });
    }
    if (!request.principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });

    try {
      const data = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal,
        requestedTenantId: params.data.tenantId,
        capability: 'workshop:vehicles:update',
        correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'domain_mutation');

        const cCheck = await client.query('SELECT 1 FROM customers WHERE id = $1 AND tenant_id = $2', [body.data.customerId, context.tenantId]);
        if (!cCheck.rowCount) throw new Error('CUSTOMER_NOT_FOUND');

        const vCheck = await client.query('SELECT 1 FROM vehicles WHERE id = $1 AND tenant_id = $2', [body.data.vehicleId, context.tenantId]);
        if (!vCheck.rowCount) throw new Error('VEHICLE_NOT_FOUND');

        await client.query(`
          INSERT INTO customer_vehicle_roles (tenant_id, customer_id, vehicle_id, role, verification_status)
          VALUES ($1, $2, $3, $4, 'verified')
          ON CONFLICT (tenant_id, customer_id, vehicle_id)
          DO UPDATE SET role = EXCLUDED.role, verification_status = 'verified'
        `, [context.tenantId, body.data.customerId, body.data.vehicleId, body.data.role]);

        return {
          customerId: body.data.customerId,
          vehicleId: body.data.vehicleId,
          role: body.data.role,
          verificationStatus: 'verified',
        };
      });

      return reply.code(201).send({ data, correlationId: request.id });
    } catch (err: any) {
      if (err.message === 'CUSTOMER_NOT_FOUND') return reply.code(404).send({ error: 'CUSTOMER_NOT_FOUND', correlationId: request.id });
      if (err.message === 'VEHICLE_NOT_FOUND') return reply.code(404).send({ error: 'VEHICLE_NOT_FOUND', correlationId: request.id });
      throw err;
    }
  });

  // 8. Appointments: Create Manual
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
               a.start_at, a.end_at, a.status, a.customer_wait_mode, a.confirmation_evidence_ref, a.version, a.origin,
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
      const wsResult = await client.query<{ id: string; timezone: string; service_duration_policy: unknown; capacity_policy: unknown }>(
        'SELECT id,timezone,service_duration_policy,capacity_policy FROM workshops WHERE tenant_id = $1 ORDER BY id LIMIT 1', [context.tenantId],
      );
      if (!wsResult.rowCount) throw new Error('WORKSHOP_NOT_FOUND');
      const workshopId = wsResult.rows[0].id;
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 314159))", [workshopId]);

      const startAt = new Date(body.data.startAt);
      const parsedIntent = serviceIntentSchema.safeParse(body.data.serviceIntent);
      const serviceIntent = parsedIntent.success ? parsedIntent.data : 'generic_fault';
      const duration = resolveServiceDuration({ policy: wsResult.rows[0].service_duration_policy, serviceIntent });
      const endAt = new Date(startAt.getTime() + duration.estimatedDurationMinutes * 60_000);
      if (body.data.endAt && new Date(body.data.endAt).getTime() !== endAt.getTime()) throw new Error('APPOINTMENT_DURATION_MISMATCH');
      const capacityRequirements = resolveCapacityRequirements(wsResult.rows[0].capacity_policy, serviceIntent);
      await assertWorkshopCapacity(client, {
        tenantId: context.tenantId, workshopId, startAt, endAt, requirements: capacityRequirements,
        policy: workshopCapacityPolicySchema.parse(wsResult.rows[0].capacity_policy), timezone: wsResult.rows[0].timezone,
      });

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
        intent: serviceIntent,
        notes: body.data.notes,
        estimatedDurationMinutes: duration.estimatedDurationMinutes,
        capacityRequirements,
      };

      const inserted = await client.query(`
        INSERT INTO appointments (
          tenant_id, workshop_id, case_id, customer_id, vehicle_id,
          identity_resolution_status, identity_claim_ciphertext, identity_claim_nonce,
          identity_claim_auth_tag, identity_claim_key_id, service_request, symptoms, notes,
          sensitive_details_ciphertext, sensitive_details_nonce, sensitive_details_auth_tag,
          sensitive_details_key_id, pii_migration_state, estimated_duration_minutes,
          capacity_requirements, start_at, end_at, status, confirmation_evidence_ref,
          idempotency_key, origin, customer_wait_mode
        ) VALUES (
          $1, $2, NULL, $3, $4,
          'workshop_manual', $5, $6, $7, $8,
          $9, '{}'::text[], NULL,
          $10, $11, $12, $13, 'protected', $14,
          $15, $16, $17, 'confirmed', NULL,
          $18, 'workshop_manual', $19
        )
        RETURNING id, tenant_id, workshop_id, case_id, customer_id, vehicle_id,
                  identity_resolution_status, start_at, end_at, status,
                  confirmation_evidence_ref, version, origin
      `, [
        context.tenantId, workshopId, body.data.customerId ?? null, body.data.vehicleId ?? null,
        identityClaim?.ciphertext ?? null, identityClaim?.nonce ?? null, identityClaim?.authTag ?? null, identityClaim?.keyId ?? null,
        JSON.stringify(serviceRequest),
        protectedSensitive.ciphertext, protectedSensitive.nonce, protectedSensitive.authTag, protectedSensitive.keyId,
        duration.estimatedDurationMinutes, JSON.stringify(serviceRequest.capacityRequirements),
        startAt, endAt, body.data.idempotencyKey, body.data.customerWaitMode,
      ]);

      const appointmentId = inserted.rows[0].id;

      // Re-read with joins for clean revealing
      const fresh = await client.query(`
        SELECT a.id, a.tenant_id, a.workshop_id, a.case_id, a.customer_id, a.vehicle_id, a.identity_resolution_status,
               a.identity_claim_ciphertext, a.identity_claim_nonce, a.identity_claim_auth_tag, a.identity_claim_key_id,
               a.service_request,
               a.sensitive_details_ciphertext, a.sensitive_details_nonce, a.sensitive_details_auth_tag, a.sensitive_details_key_id,
               a.start_at, a.end_at, a.status, a.customer_wait_mode, a.confirmation_evidence_ref, a.version, a.origin,
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

  app.patch('/v1/workshop/tenants/:tenantId/appointments/:appointmentId/status', auth, async (request, reply) => {
    const params = appointmentParams.safeParse(request.params);
    const body = appointmentOperationalStatusSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'INVALID_APPOINTMENT_STATUS_PAYLOAD', correlationId: request.id });
    if (!request.principal || request.principal.kind !== 'workshop_user') return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const actorId = request.principal.userId;
    try {
      const data = await inAuthorizedTenantTransaction(pool, {
        principal: request.principal, requestedTenantId: params.data.tenantId,
        capability: 'workshop:appointments:create', correlationId: request.id,
      }, async (client, context) => {
        await assertTenantOperation(client, context.tenantId, 'domain_mutation');
        const current = await client.query<{ id: string; workshop_id: string; status: string; version: number }>(
          'SELECT id,workshop_id,status,version FROM appointments WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
          [context.tenantId, params.data.appointmentId],
        );
        if (current.rowCount !== 1) throw new Error('APPOINTMENT_NOT_FOUND');
        if (!allowedAppointmentTransitions[current.rows[0].status]?.includes(body.data.status)) throw new Error('INVALID_APPOINTMENT_STATUS_TRANSITION');
        const updated = await client.query(
          `UPDATE appointments SET status=$3,version=version+1
           WHERE tenant_id=$1 AND id=$2 AND version=$4 RETURNING id,workshop_id,status,customer_wait_mode,version`,
          [context.tenantId, params.data.appointmentId, body.data.status, body.data.expectedVersion],
        );
        if (updated.rowCount !== 1) throw new Error('VERSION_CONFLICT');
        await client.query(
          `INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
           VALUES($1,'human',$2,'appointment_status_updated','appointment',$3,$4,$5)`,
          [context.tenantId, actorId, params.data.appointmentId, request.id,
            `postgres:appointment-status:${body.data.idempotencyKey}`],
        );
        return updated.rows[0];
      });
      return { data, correlationId: request.id };
    } catch (error) {
      const code = error instanceof Error ? error.message : 'APPOINTMENT_STATUS_UPDATE_FAILED';
      if (code === 'APPOINTMENT_NOT_FOUND') return reply.code(404).send({ error: code, correlationId: request.id });
      if (code === 'INVALID_APPOINTMENT_STATUS_TRANSITION' || code === 'VERSION_CONFLICT') return reply.code(409).send({ error: code, correlationId: request.id });
      throw error;
    }
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
    customer_wait_mode: row.customer_wait_mode,
    confirmation_evidence_ref: row.confirmation_evidence_ref,
    version: row.version,
    origin: row.origin,
    customer_name: customerName,
    vehicle_plate: plate,
  };
}
