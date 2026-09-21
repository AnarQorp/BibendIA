import type pg from 'pg';
import type { AuthorizedTenantContext } from '../../auth/tenant-authorization.js';
import type { TenantContext } from '../../domain/ids.js';

export type TenantLifecycle = 'provisioning' | 'pilot' | 'active' | 'suspended' | 'deactivated';
export type TenantOperation =
  | 'workshop_read'
  | 'platform_read'
  | 'provider_ingress_capture'
  | 'conversation_start'
  | 'domain_mutation'
  | 'external_effect';

export type TenantControlState = {
  lifecycle: TenantLifecycle;
  lifecycleUpdatedAt: string | null;
  lifecycleUpdatedBy: { type: string; id: string } | null;
  lifecycleReason: string | null;
  killSwitch: {
    enabled: boolean;
    updatedAt: string | null;
    updatedBy: { type: string; id: string } | null;
    reason: string | null;
  };
  version: number;
};

type TenantControlRow = {
  lifecycle_status: TenantLifecycle;
  lifecycle_updated_at: Date | null;
  lifecycle_updated_by_type: string | null;
  lifecycle_updated_by_id: string | null;
  lifecycle_reason: string | null;
  kill_switch_enabled: boolean;
  kill_switch_updated_at: Date | null;
  kill_switch_updated_by_type: string | null;
  kill_switch_updated_by_id: string | null;
  kill_switch_reason: string | null;
  control_version: number;
};

export class TenantControlError extends Error {
  constructor(readonly code:
    | 'TENANT_NOT_OPERATIONAL'
    | 'TENANT_DEACTIVATED'
    | 'KILL_SWITCH_ENABLED'
    | 'INVALID_LIFECYCLE_TRANSITION'
    | 'CONTROL_VERSION_CONFLICT'
    | 'CONTROL_STATE_UNCHANGED'
    | 'PLATFORM_CONTROL_REQUIRED') {
    super(code);
  }
}

const transitions: Record<TenantLifecycle, readonly TenantLifecycle[]> = {
  provisioning: ['pilot', 'deactivated'],
  pilot: ['active', 'suspended', 'deactivated'],
  active: ['suspended', 'deactivated'],
  suspended: ['pilot', 'active', 'deactivated'],
  deactivated: [],
};

export async function readTenantControl(
  client: pg.PoolClient,
  tenantId: string,
  lock: 'none' | 'share' | 'update' = 'none',
): Promise<TenantControlState> {
  if (lock === 'share') {
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1::text, 271828))", [tenantId]);
  } else if (lock === 'update') {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 271828))", [tenantId]);
  }
  const suffix = lock === 'update' ? ' FOR UPDATE' : '';
  const result = await client.query<TenantControlRow>(
    `SELECT lifecycle_status,lifecycle_updated_at,lifecycle_updated_by_type,lifecycle_updated_by_id,lifecycle_reason,
      kill_switch_enabled,kill_switch_updated_at,kill_switch_updated_by_type,kill_switch_updated_by_id,
      kill_switch_reason,control_version FROM tenants WHERE id=$1${suffix}`,
    [tenantId],
  );
  if (result.rowCount !== 1) throw new TenantControlError('TENANT_NOT_OPERATIONAL');
  return toState(result.rows[0]);
}

export function operationDecision(state: TenantControlState, operation: TenantOperation): { allowed: boolean; code?: TenantControlError['code'] } {
  if (operation === 'platform_read' || operation === 'provider_ingress_capture') return { allowed: true };
  if (operation === 'workshop_read') {
    if (state.lifecycle === 'deactivated') return { allowed: false, code: 'TENANT_DEACTIVATED' };
    return state.lifecycle === 'provisioning'
      ? { allowed: false, code: 'TENANT_NOT_OPERATIONAL' }
      : { allowed: true };
  }
  if (state.lifecycle === 'deactivated') return { allowed: false, code: 'TENANT_DEACTIVATED' };
  if (state.lifecycle !== 'pilot' && state.lifecycle !== 'active') return { allowed: false, code: 'TENANT_NOT_OPERATIONAL' };
  if (state.killSwitch.enabled) return { allowed: false, code: 'KILL_SWITCH_ENABLED' };
  return { allowed: true };
}

export async function assertTenantOperation(
  client: pg.PoolClient,
  tenantId: string,
  operation: TenantOperation,
  lock: 'none' | 'share' = 'none',
): Promise<TenantControlState> {
  const state = await readTenantControl(client, tenantId, lock);
  const decision = operationDecision(state, operation);
  if (!decision.allowed) throw new TenantControlError(decision.code!);
  return state;
}

export async function changeTenantLifecycle(
  client: pg.PoolClient,
  context: AuthorizedTenantContext,
  command: { target: TenantLifecycle; reason: string; idempotencyKey: string; expectedVersion: number },
) {
  assertPlatformControl(context, 'platform:tenant:update');
  const replay = await existingEvent(client, context.tenantId, command.idempotencyKey, 'lifecycle_changed');
  if (replay) return replay;
  const before = await readTenantControl(client, context.tenantId, 'update');
  if (before.version !== command.expectedVersion) throw new TenantControlError('CONTROL_VERSION_CONFLICT');
  if (before.lifecycle === command.target) throw new TenantControlError('CONTROL_STATE_UNCHANGED');
  if (!transitions[before.lifecycle].includes(command.target)) throw new TenantControlError('INVALID_LIFECYCLE_TRANSITION');
  const nextVersion = before.version + 1;
  await client.query(
    `UPDATE tenants SET lifecycle_status=$2,lifecycle_updated_at=now(),lifecycle_updated_by_type=$3,
       lifecycle_updated_by_id=$4,lifecycle_reason=$5,control_version=$6 WHERE id=$1`,
    [context.tenantId, command.target, context.principal.kind, context.principal.userId, command.reason, nextVersion],
  );
  return recordControlEvent(client, context, {
    eventType: 'lifecycle_changed', lifecycleFrom: before.lifecycle, lifecycleTo: command.target,
    reason: command.reason, idempotencyKey: command.idempotencyKey, version: nextVersion,
  });
}

export async function setTenantKillSwitch(
  client: pg.PoolClient,
  context: AuthorizedTenantContext,
  command: { enabled: boolean; reason: string; idempotencyKey: string; expectedVersion: number },
) {
  assertPlatformControl(context, 'platform:kill-switch:manage');
  const replay = await existingEvent(client, context.tenantId, command.idempotencyKey, 'kill_switch_changed');
  if (replay) return replay;
  const before = await readTenantControl(client, context.tenantId, 'update');
  if (before.version !== command.expectedVersion) throw new TenantControlError('CONTROL_VERSION_CONFLICT');
  if (before.killSwitch.enabled === command.enabled) throw new TenantControlError('CONTROL_STATE_UNCHANGED');
  const nextVersion = before.version + 1;
  await client.query(
    `UPDATE tenants SET kill_switch_enabled=$2,kill_switch_updated_at=now(),kill_switch_updated_by_type=$3,
       kill_switch_updated_by_id=$4,kill_switch_reason=$5,control_version=$6 WHERE id=$1`,
    [context.tenantId, command.enabled, context.principal.kind, context.principal.userId, command.reason, nextVersion],
  );
  return recordControlEvent(client, context, {
    eventType: 'kill_switch_changed', killSwitchFrom: before.killSwitch.enabled, killSwitchTo: command.enabled,
    reason: command.reason, idempotencyKey: command.idempotencyKey, version: nextVersion,
  });
}

export async function assertTenantMutationAtPool(pool: pg.Pool, context: TenantContext): Promise<TenantControlState> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_api');
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [context.tenantId]);
    const state = await assertTenantOperation(client, context.tenantId, 'domain_mutation');
    await client.query('COMMIT');
    return state;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function existingEvent(client: pg.PoolClient, tenantId: string, key: string, expectedType: string) {
  const result = await client.query<{
    id: number; event_type: string; lifecycle_from: TenantLifecycle | null; lifecycle_to: TenantLifecycle | null;
    kill_switch_from: boolean | null; kill_switch_to: boolean | null; control_version: number; occurred_at: Date;
  }>(`SELECT id,event_type,lifecycle_from,lifecycle_to,kill_switch_from,kill_switch_to,control_version,occurred_at
      FROM tenant_control_events WHERE tenant_id=$1 AND idempotency_key=$2`, [tenantId, key]);
  if (result.rowCount === 0) return null;
  if (result.rows[0].event_type !== expectedType) throw new TenantControlError('CONTROL_VERSION_CONFLICT');
  return eventReceipt(result.rows[0]);
}

async function recordControlEvent(
  client: pg.PoolClient,
  context: AuthorizedTenantContext,
  event: {
    eventType: 'lifecycle_changed' | 'kill_switch_changed'; lifecycleFrom?: TenantLifecycle;
    lifecycleTo?: TenantLifecycle; killSwitchFrom?: boolean; killSwitchTo?: boolean; reason: string; idempotencyKey: string; version: number;
  },
) {
  if (context.principal.kind !== 'platform_user') {
    throw new TenantControlError('PLATFORM_CONTROL_REQUIRED');
  }
  const actorId = context.principal.userId;
  const inserted = await client.query<{
    id: number; event_type: string; lifecycle_from: TenantLifecycle | null; lifecycle_to: TenantLifecycle | null;
    kill_switch_from: boolean | null; kill_switch_to: boolean | null; control_version: number; occurred_at: Date;
  }>(`INSERT INTO tenant_control_events
      (tenant_id,event_type,lifecycle_from,lifecycle_to,kill_switch_from,kill_switch_to,reason,actor_type,actor_id,
       correlation_id,idempotency_key,control_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id,event_type,lifecycle_from,lifecycle_to,kill_switch_from,kill_switch_to,control_version,occurred_at`,
    [context.tenantId, event.eventType, event.lifecycleFrom ?? null, event.lifecycleTo ?? null,
      event.killSwitchFrom ?? null, event.killSwitchTo ?? null, event.reason, context.principal.kind, actorId,
      context.correlationId, event.idempotencyKey, event.version],
  );
  await client.query(
    `INSERT INTO audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
     VALUES($1::uuid,$2,$3,$4,'tenant',$1::text,$5,$6)`,
    [context.tenantId, context.principal.kind, actorId, event.eventType,
      context.correlationId, `postgres:tenant-control-event:${inserted.rows[0].id}`],
  );
  return eventReceipt(inserted.rows[0]);
}

function assertPlatformControl(context: AuthorizedTenantContext, capability: string): asserts context is AuthorizedTenantContext & { principal: { kind: 'platform_user'; userId: string } } {
  if (context.principal.kind !== 'platform_user' || context.capability !== capability) {
    throw new TenantControlError('PLATFORM_CONTROL_REQUIRED');
  }
}

function eventReceipt(row: {
  id: number; event_type: string; lifecycle_from: TenantLifecycle | null; lifecycle_to: TenantLifecycle | null;
  kill_switch_from: boolean | null; kill_switch_to: boolean | null; control_version: number; occurred_at: Date;
}) {
  return {
    eventId: row.id, eventType: row.event_type, lifecycleFrom: row.lifecycle_from,
    lifecycleTo: row.lifecycle_to, killSwitchFrom: row.kill_switch_from, killSwitchTo: row.kill_switch_to,
    version: row.control_version, occurredAt: row.occurred_at.toISOString(),
    evidenceRef: `postgres:tenant-control-event:${row.id}`,
  };
}

function toState(row: TenantControlRow): TenantControlState {
  return {
    lifecycle: row.lifecycle_status,
    lifecycleUpdatedAt: row.lifecycle_updated_at?.toISOString() ?? null,
    lifecycleUpdatedBy: actor(row.lifecycle_updated_by_type, row.lifecycle_updated_by_id),
    lifecycleReason: row.lifecycle_reason,
    killSwitch: {
      enabled: row.kill_switch_enabled,
      updatedAt: row.kill_switch_updated_at?.toISOString() ?? null,
      updatedBy: actor(row.kill_switch_updated_by_type, row.kill_switch_updated_by_id),
      reason: row.kill_switch_reason,
    },
    version: row.control_version,
  };
}

function actor(type: string | null, id: string | null) {
  return type && id ? { type, id } : null;
}
