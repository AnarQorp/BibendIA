import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { ServicePrincipal } from './principal.js';
import type { TenantContext } from '../domain/ids.js';

export class ProviderAuthorizationError extends Error {
  constructor(readonly code: 'PROVIDER_NOT_ALLOWED' | 'ENDPOINT_NOT_RESOLVED' | 'REPLAY_CONFLICT') {
    super(code);
  }
}

export type ProviderBindingRequest = {
  principal: ServicePrincipal;
  provider: 'twilio' | 'elevenlabs';
  calledEndpoint?: string;
  correlationId: string;
};

export async function inAuthorizedProviderTransaction<T>(
  pool: pg.Pool,
  request: ProviderBindingRequest,
  work: (client: pg.PoolClient, context: TenantContext) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_api');
    await client.query("SELECT set_config('app.principal_type','service',true)");
    await client.query("SELECT set_config('app.principal_id',$1,true)", [request.principal.serviceId]);
    await client.query("SELECT set_config('app.correlation_id',$1,true)", [request.correlationId]);

    const service = await client.query<{ provider: string; external_account_id: string; service_type: string }>(
      `SELECT provider, external_account_id, service_type FROM service_principals
       WHERE id=$1 AND status='active'`, [request.principal.serviceId],
    );
    if (service.rowCount !== 1
      || service.rows[0].provider !== request.provider
      || service.rows[0].external_account_id !== request.principal.externalAccountId
      || service.rows[0].service_type !== request.principal.serviceType) {
      throw new ProviderAuthorizationError('PROVIDER_NOT_ALLOWED');
    }

    const bindings = await client.query<{ tenant_id: string; workshop_id: string; channel_endpoint_id: string }>(
      `SELECT tenant_id, workshop_id, channel_endpoint_id FROM provider_bindings
       WHERE service_principal_id=$1 AND status='active'`, [request.principal.serviceId],
    );

    const candidates: typeof bindings.rows = [];
    for (const binding of bindings.rows) {
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [binding.tenant_id]);
      const endpoint = await client.query<{ called_endpoint: string }>(
        `SELECT called_endpoint FROM channel_endpoints
         WHERE id=$1 AND tenant_id=$2 AND workshop_id=$3 AND status='active'`,
        [binding.channel_endpoint_id, binding.tenant_id, binding.workshop_id],
      );
      if (endpoint.rowCount === 1
        && (!request.calledEndpoint || endpoint.rows[0].called_endpoint === request.calledEndpoint)) {
        candidates.push(binding);
      }
    }
    if (candidates.length !== 1) throw new ProviderAuthorizationError('ENDPOINT_NOT_RESOLVED');

    const binding = candidates[0];
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [binding.tenant_id]);
    const context: TenantContext = {
      tenantId: binding.tenant_id as TenantContext['tenantId'],
      workshopId: binding.workshop_id as TenantContext['workshopId'],
      correlationId: request.correlationId,
      actor: { type: 'voice_agent', id: request.principal.serviceId },
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

export async function claimInboxEvent(
  client: pg.PoolClient,
  input: {
    context: TenantContext;
    principal: ServicePrincipal;
    provider: 'twilio' | 'elevenlabs';
    externalEventId: string;
    rawBody: string;
    eventOccurredAt?: Date;
  },
): Promise<'claimed' | 'duplicate'> {
  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex');
  const inserted = await client.query(
    `INSERT INTO inbox_events
       (tenant_id,provider,external_event_id,payload_hash,status,service_principal_id,correlation_id,event_occurred_at,signature_verified_at)
     VALUES($1,$2,$3,$4,'received',$5,$6,$7,now())
     ON CONFLICT (tenant_id,provider,external_event_id) DO NOTHING
     RETURNING id`,
    [input.context.tenantId, input.provider, input.externalEventId, payloadHash,
      input.principal.serviceId, input.context.correlationId, input.eventOccurredAt ?? null],
  );
  if (inserted.rowCount === 1) return 'claimed';
  const existing = await client.query<{ payload_hash: string }>(
    `SELECT payload_hash FROM inbox_events
     WHERE tenant_id=$1 AND provider=$2 AND external_event_id=$3`,
    [input.context.tenantId, input.provider, input.externalEventId],
  );
  if (existing.rowCount !== 1 || existing.rows[0].payload_hash !== payloadHash) {
    throw new ProviderAuthorizationError('REPLAY_CONFLICT');
  }
  return 'duplicate';
}
