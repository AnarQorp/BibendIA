import { z } from 'zod';
import type pg from 'pg';
import type { CapacityRequirement, ServiceRequest } from './model.js';

const positiveCapacity = z.number().int().min(1).max(500);
const resourceRuleSchema = z.object({
  mechanic: z.number().int().min(0).max(20),
  lift: z.number().int().min(0).max(20),
  genericBay: z.number().int().min(0).max(20),
}).strict().refine((rule) => rule.mechanic + rule.lift + rule.genericBay > 0, 'At least one resource is required');

export const workshopCapacityPolicySchema = z.object({
  version: z.string().trim().min(1).max(100),
  liftCount: positiveCapacity,
  nonLiftBayCount: positiveCapacity,
  concurrentTechnicians: positiveCapacity,
  maxVehiclesOnSite: positiveCapacity,
  maxVehicleIntakesPerHour: positiveCapacity,
  resourceRequirements: z.object({
    rules: z.object({
      inspection: resourceRuleSchema.optional(),
      oil_service: resourceRuleSchema.optional(),
      brakes_or_noise: resourceRuleSchema.optional(),
      generic_fault: resourceRuleSchema.optional(),
    }).strict(),
    fallback: resourceRuleSchema.nullable(),
  }).strict(),
}).strict();

export type WorkshopCapacityPolicy = z.infer<typeof workshopCapacityPolicySchema>;

export const CANONICAL_WORKSHOP_RESOURCE_REQUIREMENTS_V1: WorkshopCapacityPolicy['resourceRequirements'] = {
  rules: {
    inspection: { mechanic: 1, lift: 0, genericBay: 1 },
    oil_service: { mechanic: 1, lift: 1, genericBay: 0 },
    brakes_or_noise: { mechanic: 1, lift: 1, genericBay: 0 },
    generic_fault: { mechanic: 1, lift: 0, genericBay: 1 },
  },
  fallback: { mechanic: 1, lift: 0, genericBay: 1 },
};

export class WorkshopCapacityError extends Error {
  constructor(readonly code:
    | 'WORKSHOP_CAPACITY_POLICY_INVALID'
    | 'WORKSHOP_RESOURCE_REQUIREMENTS_UNRESOLVED'
    | 'WORKSHOP_CAPACITY_EXCEEDED'
    | 'WORKSHOP_INTAKE_CAPACITY_EXCEEDED'
    | 'WORKSHOP_SITE_CAPACITY_EXCEEDED') { super(code); }
}

export function parseWorkshopCapacityPolicy(policy: unknown): WorkshopCapacityPolicy {
  const parsed = workshopCapacityPolicySchema.safeParse(policy);
  if (!parsed.success) throw new WorkshopCapacityError('WORKSHOP_CAPACITY_POLICY_INVALID');
  return parsed.data;
}

export function resolveCapacityRequirements(policyValue: unknown, intent?: ServiceRequest['intent']): CapacityRequirement[] {
  const policy = parseWorkshopCapacityPolicy(policyValue);
  const rule = (intent ? policy.resourceRequirements.rules[intent] : undefined) ?? policy.resourceRequirements.fallback;
  if (!rule) throw new WorkshopCapacityError('WORKSHOP_RESOURCE_REQUIREMENTS_UNRESOLVED');
  const requirements: CapacityRequirement[] = [];
  if (rule.mechanic) requirements.push({ resourceType: 'mechanic', quantity: rule.mechanic });
  if (rule.lift) requirements.push({ resourceType: 'lift', quantity: rule.lift });
  if (rule.genericBay) requirements.push({ resourceType: 'generic_bay', quantity: rule.genericBay });
  return requirements;
}

type CapacityCheck = {
  tenantId: string;
  workshopId: string;
  startAt: Date;
  endAt: Date;
  requirements: CapacityRequirement[];
  policy: WorkshopCapacityPolicy;
  timezone: string;
  excludeHoldId?: string;
  excludeAppointmentId?: string;
};

function quantities(requirements: unknown): Record<'mechanic' | 'lift' | 'generic_bay', number> {
  const result = { mechanic: 0, lift: 0, generic_bay: 0 };
  if (!Array.isArray(requirements)) return result;
  for (const item of requirements) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { resourceType?: string; quantity?: number };
    if (row.resourceType && row.resourceType in result && Number.isInteger(row.quantity) && (row.quantity ?? 0) > 0) {
      result[row.resourceType as keyof typeof result] += row.quantity!;
    }
  }
  return result;
}

export async function assertWorkshopCapacity(client: pg.PoolClient, input: CapacityCheck): Promise<void> {
  const scheduled = await client.query<{ capacity_requirements: unknown; vehicle_id: string | null }>(
    `SELECT capacity_requirements,vehicle_id FROM appointments
     WHERE tenant_id=$1 AND workshop_id=$2
       AND status NOT IN ('cancelled','delivered','completed')
       AND start_at < $4 AND end_at > $3
       AND ($5::uuid IS NULL OR id <> $5)`,
    [input.tenantId, input.workshopId, input.startAt, input.endAt, input.excludeAppointmentId ?? null],
  );
  const holds = await client.query<{ capacity_requirements: unknown }>(
    `SELECT capacity_requirements FROM slot_holds
     WHERE tenant_id=$1 AND workshop_id=$2 AND expires_at > now() AND consumed_at IS NULL
       AND start_at < $4 AND end_at > $3
       AND ($5::uuid IS NULL OR id <> $5)`,
    [input.tenantId, input.workshopId, input.startAt, input.endAt, input.excludeHoldId ?? null],
  );
  const used = { mechanic: 0, lift: 0, generic_bay: 0 };
  for (const row of [...scheduled.rows, ...holds.rows]) {
    const value = quantities(row.capacity_requirements);
    used.mechanic += value.mechanic;
    used.lift += value.lift;
    used.generic_bay += value.generic_bay;
  }
  const requested = quantities(input.requirements);
  if (used.mechanic + requested.mechanic > input.policy.concurrentTechnicians
    || used.lift + requested.lift > input.policy.liftCount
    || used.generic_bay + requested.generic_bay > input.policy.nonLiftBayCount) {
    throw new WorkshopCapacityError('WORKSHOP_CAPACITY_EXCEEDED');
  }

  const intake = await client.query<{ count: number }>(
    `SELECT count(*)::int count FROM (
       SELECT id::text FROM appointments
       WHERE tenant_id=$1 AND workshop_id=$2 AND status NOT IN ('cancelled','delivered')
         AND date_trunc('hour',start_at AT TIME ZONE $3)=date_trunc('hour',$4::timestamptz AT TIME ZONE $3)
         AND ($5::uuid IS NULL OR id <> $5)
       UNION ALL
       SELECT id::text FROM slot_holds
       WHERE tenant_id=$1 AND workshop_id=$2 AND expires_at > now() AND consumed_at IS NULL
         AND date_trunc('hour',start_at AT TIME ZONE $3)=date_trunc('hour',$4::timestamptz AT TIME ZONE $3)
         AND ($6::uuid IS NULL OR id <> $6)
     ) active_intakes`,
    [input.tenantId, input.workshopId, input.timezone, input.startAt,
      input.excludeAppointmentId ?? null, input.excludeHoldId ?? null],
  );
  if (intake.rows[0].count + 1 > input.policy.maxVehicleIntakesPerHour) {
    throw new WorkshopCapacityError('WORKSHOP_INTAKE_CAPACITY_EXCEEDED');
  }

  const onSite = await client.query<{ vehicle_id: string }>(
    `SELECT DISTINCT vehicle_id FROM appointments
     WHERE tenant_id=$1 AND workshop_id=$2 AND vehicle_id IS NOT NULL
       AND status IN ('on_site','in_progress','waiting','completed')`,
    [input.tenantId, input.workshopId],
  );
  const onSiteIds = new Set(onSite.rows.map((row) => row.vehicle_id));
  const overlappingVehicleIds = new Set(scheduled.rows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id) && !onSiteIds.has(id!)));
  const projected = onSiteIds.size + overlappingVehicleIds.size + (holds.rowCount ?? 0) + 1;
  if (projected > input.policy.maxVehiclesOnSite) {
    throw new WorkshopCapacityError('WORKSHOP_SITE_CAPACITY_EXCEEDED');
  }
}

export async function vehiclesCurrentlyOnSite(client: pg.PoolClient, tenantId: string, workshopId: string): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(DISTINCT vehicle_id)::int count FROM appointments
     WHERE tenant_id=$1 AND workshop_id=$2 AND vehicle_id IS NOT NULL
       AND status IN ('on_site','in_progress','waiting','completed')`,
    [tenantId, workshopId],
  );
  return result.rows[0].count;
}
