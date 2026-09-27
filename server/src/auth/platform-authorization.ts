import type pg from 'pg';
import { z } from 'zod';
import type { PlatformPrincipal } from './principal.js';
import { platformRoleAllows, type Capability, type PlatformRole } from './capabilities.js';
import { TenantAuthorizationError } from './tenant-authorization.js';

export type AuthorizedPlatformContext = {
  principal: PlatformPrincipal; capability: Capability; grantedRole: PlatformRole;
  correlationId: string; global: boolean; tenantIds: string[];
};

export async function inAuthorizedPlatformTransaction<T>(pool: pg.Pool, request: {
  principal: PlatformPrincipal; capability: Capability; correlationId: string; requireGlobal?: boolean;
}, work: (client: pg.PoolClient, context: AuthorizedPlatformContext) => Promise<T>): Promise<T> {
  const userId = z.string().uuid().safeParse(request.principal.userId);
  if (!userId.success) throw new TenantAuthorizationError('TENANT_ACCESS_DENIED');
  if (Date.parse(request.principal.expiresAt) <= Date.now()) throw new TenantAuthorizationError('AUTHENTICATION_EXPIRED');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_api');
    for (const [key,value] of Object.entries({
      'app.principal_type':'platform_user','app.principal_id':userId.data,'app.correlation_id':request.correlationId,
    })) await client.query('SELECT set_config($1,$2,true)', [key,value]);
    const user = await client.query<{status:string}>('SELECT status FROM users WHERE id=$1',[userId.data]);
    if (user.rows[0]?.status !== 'active') throw new TenantAuthorizationError('PRINCIPAL_INACTIVE');
    const grants = await client.query<{role:PlatformRole;scope_type:'global'|'tenant';tenant_id:string|null}>(
      `SELECT role,scope_type,tenant_id FROM platform_access_grants WHERE user_id=$1 AND status='active'
       AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())`,[userId.data]);
    const allowed = grants.rows.filter((g)=>platformRoleAllows(g.role,request.capability));
    const globalGrant = allowed.find((g)=>g.scope_type==='global');
    if (!allowed.length || (request.requireGlobal && !globalGrant)) throw new TenantAuthorizationError('TENANT_ACCESS_DENIED');
    await client.query('SELECT set_config($1,$2,true)',['app.authorized_capability',request.capability]);
    await client.query('SELECT set_config($1,$2,true)',['app.platform_global',globalGrant?'true':'false']);
    await client.query('SELECT set_config($1,$2,true)',['app.platform_tenant_ids',allowed.flatMap((g)=>g.tenant_id?[g.tenant_id]:[]).join(',')]);
    const context: AuthorizedPlatformContext = { principal:request.principal,capability:request.capability,
      grantedRole:(globalGrant ?? allowed[0]).role,correlationId:request.correlationId,global:Boolean(globalGrant),
      tenantIds:allowed.flatMap((g)=>g.tenant_id ? [g.tenant_id] : []) };
    const result=await work(client,context); await client.query('COMMIT'); return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
