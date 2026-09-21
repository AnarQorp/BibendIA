import type pg from 'pg';
import { z } from 'zod';
import type { PrincipalContext } from './principal.js';
import {
  platformRoleAllows, workshopRoleAllows,
  type Capability, type PlatformRole, type WorkshopRole,
} from './capabilities.js';

const uuid = z.string().uuid();

export type AuthorizedTenantContext = {
  tenantId: string;
  principal: PrincipalContext;
  capability: Capability;
  grantedRole: WorkshopRole | PlatformRole;
  correlationId: string;
};

export class TenantAuthorizationError extends Error {
  constructor(public readonly code: 'TENANT_ACCESS_DENIED' | 'PRINCIPAL_INACTIVE' | 'AUTHENTICATION_EXPIRED') {
    super(code);
    this.name = 'TenantAuthorizationError';
  }
}

type AuthorizationRequest = {
  principal: PrincipalContext;
  requestedTenantId: string;
  capability: Capability;
  correlationId: string;
};

export async function inAuthorizedTenantTransaction<T>(
  pool: pg.Pool,
  request: AuthorizationRequest,
  work: (client: pg.PoolClient, context: AuthorizedTenantContext) => Promise<T>,
): Promise<T> {
  const tenantId = uuid.safeParse(request.requestedTenantId);
  const principalId = request.principal.kind === 'service' ? null : uuid.safeParse(request.principal.userId);
  if (!tenantId.success || !principalId?.success || request.principal.kind === 'service') {
    throw new TenantAuthorizationError('TENANT_ACCESS_DENIED');
  }
  if (Date.parse(request.principal.expiresAt) <= Date.now()) {
    throw new TenantAuthorizationError('AUTHENTICATION_EXPIRED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_api');
    await setLocal(client, 'app.principal_type', request.principal.kind);
    await setLocal(client, 'app.principal_id', principalId.data);
    await setLocal(client, 'app.requested_tenant_id', tenantId.data);
    await setLocal(client, 'app.correlation_id', request.correlationId);

    const user = await client.query<{ status: string }>('SELECT status FROM users WHERE id=$1', [principalId.data]);
    if (user.rowCount !== 1 || user.rows[0].status !== 'active') {
      throw new TenantAuthorizationError('PRINCIPAL_INACTIVE');
    }

    const grantedRole = request.principal.kind === 'workshop_user'
      ? await authorizeWorkshop(client, principalId.data, tenantId.data, request.capability)
      : await authorizePlatform(client, principalId.data, tenantId.data, request.capability);
    if (!grantedRole) throw new TenantAuthorizationError('TENANT_ACCESS_DENIED');

    const tenant = await client.query('SELECT id FROM tenants WHERE id=$1', [tenantId.data]);
    if (tenant.rowCount !== 1) throw new TenantAuthorizationError('TENANT_ACCESS_DENIED');

    await setLocal(client, 'app.tenant_id', tenantId.data);
    const context: AuthorizedTenantContext = {
      tenantId: tenantId.data,
      principal: request.principal,
      capability: request.capability,
      grantedRole,
      correlationId: request.correlationId,
    };
    const result = await work(client, context);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function authorizeWorkshop(client: pg.PoolClient, userId: string, tenantId: string, capability: Capability) {
  const result = await client.query<{ role: WorkshopRole }>(
    `SELECT role FROM tenant_memberships
     WHERE user_id=$1 AND tenant_id=$2 AND status='active'
       AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now())`,
    [userId, tenantId],
  );
  const role = result.rows[0]?.role;
  return role && workshopRoleAllows(role, capability) ? role : null;
}

async function authorizePlatform(client: pg.PoolClient, userId: string, tenantId: string, capability: Capability) {
  const result = await client.query<{ role: PlatformRole }>(
    `SELECT role FROM platform_access_grants
     WHERE user_id=$1 AND status='active'
       AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now())
       AND (scope_type='global' OR tenant_id=$2)`,
    [userId, tenantId],
  );
  return result.rows.map((row) => row.role).find((role) => platformRoleAllows(role, capability)) ?? null;
}

async function setLocal(client: pg.PoolClient, key: string, value: string) {
  await client.query("SELECT set_config($1, $2, true)", [key, value]);
}
