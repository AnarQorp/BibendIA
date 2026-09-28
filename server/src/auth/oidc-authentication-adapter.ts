import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type pg from 'pg';
import type { AuthenticationAdapter, AuthenticationRequest } from './authentication-adapter.js';
import type { AuthAudience, HumanAssurance, PrincipalContext } from './principal.js';

export type HumanSurfaceConfig = {
  audience: 'workshop' | 'platform';
  clientId: string;
  clientSecret: string;
  origin: string;
  cookieName: string;
  requireMfa: boolean;
  authorizationTenantId: string;
};

export type HumanAuthenticationConfig = {
  issuer: string;
  sessionKey: string;
  sessionTtlSeconds: number;
  workshop: HumanSurfaceConfig;
  platform: HumanSurfaceConfig;
};

type HumanSession = {
  v: 1; userId: string; issuer: string; subject: string; sessionId: string;
  audience: 'workshop' | 'platform'; assurance: HumanAssurance; authenticatedAt: string; expiresAt: string;
};

export type HumanAuthority = { userId: string; tenantIds: string[] };

export class OidcAuthenticationAdapter implements AuthenticationAdapter {
  private readonly key: Buffer;
  constructor(private readonly pool: pg.Pool, readonly config: HumanAuthenticationConfig) {
    this.key = Buffer.from(config.sessionKey, 'base64url');
    if (this.key.length !== 32) throw new Error('HUMAN_SESSION_KEY_INVALID');
  }

  async authenticate(request: AuthenticationRequest, expectedAudience: AuthAudience): Promise<PrincipalContext | null> {
    if (expectedAudience !== 'workshop' && expectedAudience !== 'platform') return null;
    const surface = this.config[expectedAudience];
    const encoded = parseCookies(request.cookie)[surface.cookieName];
    if (!encoded) return null;
    const session = this.open<HumanSession>(encoded, `session:${expectedAudience}`);
    const expiresAt = session ? Date.parse(session.expiresAt) : Number.NaN;
    const expectedIssuer = `${this.config.issuer.replace(/\/$/, '')}/`;
    if (!session || session.v !== 1 || session.audience !== expectedAudience || !Number.isFinite(expiresAt) || expiresAt <= Date.now() ||
        !isUuid(session.userId) || session.issuer !== expectedIssuer || !session.subject ||
        (surface.requireMfa && session.assurance !== 'mfa')) return null;
    const authority = await resolveHumanAuthority(this.pool, session.userId, session.issuer, session.subject, expectedAudience, surface.authorizationTenantId);
    if (!authority || authority.userId !== session.userId) return null;
    return {
      kind: expectedAudience === 'workshop' ? 'workshop_user' : 'platform_user',
      audience: expectedAudience, userId: session.userId, issuer: session.issuer, subject: session.subject,
      sessionId: session.sessionId, authenticatedAt: session.authenticatedAt, expiresAt: session.expiresAt,
      assurance: session.assurance,
    } as PrincipalContext;
  }

  sealSession(input: Omit<HumanSession, 'v' | 'sessionId' | 'expiresAt'>): { value: string; session: HumanSession } {
    const session: HumanSession = {
      ...input, v: 1, sessionId: randomUUID(),
      expiresAt: new Date(Date.now() + this.config.sessionTtlSeconds * 1000).toISOString(),
    };
    return { value: this.seal(session, `session:${session.audience}`), session };
  }

  seal<T>(value: T, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(purpose));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
  }

  open<T>(value: string, purpose: string): T | null {
    try {
      const [ivRaw, tagRaw, bodyRaw, extra] = value.split('.');
      if (!ivRaw || !tagRaw || !bodyRaw || extra) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64url'));
      decipher.setAAD(Buffer.from(purpose));
      decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bodyRaw, 'base64url')), decipher.final()]).toString('utf8')) as T;
    } catch { return null; }
  }
}

export async function resolveHumanAuthority(
  pool: pg.Pool, userId: string, issuer: string, subject: string, audience: 'workshop' | 'platform', authorizationTenantId: string,
): Promise<HumanAuthority | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_api');
    await setLocal(client, 'app.principal_id', userId);
    await setLocal(client, 'app.principal_type', audience === 'workshop' ? 'workshop_user' : 'platform_user');
    await setLocal(client, 'app.requested_tenant_id', authorizationTenantId);
    const identity = await client.query<{ user_id: string }>(
      'SELECT user_id FROM external_identities WHERE user_id=$1 AND issuer=$2 AND subject=$3', [userId, issuer, subject],
    );
    if (identity.rows[0]?.user_id !== userId) { await client.query('ROLLBACK'); return null; }
    const user = await client.query<{ status: string }>('SELECT status FROM users WHERE id=$1', [userId]);
    if (user.rows[0]?.status !== 'active') { await client.query('ROLLBACK'); return null; }
    const authority = audience === 'workshop'
      ? await client.query<{ tenant_id: string }>(`SELECT tenant_id FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2 AND status='active'
          AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now()) ORDER BY tenant_id`, [userId, authorizationTenantId])
      : await client.query<{ tenant_id: string | null }>(`SELECT tenant_id FROM platform_access_grants WHERE user_id=$1 AND status='active'
          AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now()) ORDER BY tenant_id NULLS FIRST`, [userId]);
    if (!authority.rowCount) { await client.query('ROLLBACK'); return null; }
    await client.query('COMMIT');
    return { userId, tenantIds: [authorizationTenantId] };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export type VerifiedOidcIdentity = {
  userId: string; issuer: string; subject: string; authenticatedAt: string; assurance: HumanAssurance;
};

export async function verifyOidcIdToken(
  token: string, surface: HumanSurfaceConfig, issuer: string, nonce: string,
): Promise<VerifiedOidcIdentity> {
  const normalizedIssuer = `${issuer.replace(/\/$/, '')}/`;
  const jwks = createRemoteJWKSet(new URL(`${normalizedIssuer}.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer: normalizedIssuer, audience: surface.clientId });
  const userId = payload['https://bibendia.com/user_id'];
  if (payload.nonce !== nonce || !payload.sub || typeof userId !== 'string' || !isUuid(userId)) throw new Error('OIDC_TOKEN_INVALID');
  const authenticatedEpoch = typeof payload.auth_time === 'number' ? payload.auth_time : payload.iat;
  if (typeof authenticatedEpoch !== 'number' || authenticatedEpoch * 1000 > Date.now() + 60_000) throw new Error('OIDC_TOKEN_INVALID');
  const assurance = assuranceFromPayload(payload);
  if (surface.requireMfa && assurance !== 'mfa') throw new Error('OIDC_MFA_REQUIRED');
  return {
    userId, issuer: normalizedIssuer, subject: payload.sub, assurance,
    authenticatedAt: new Date(authenticatedEpoch * 1000).toISOString(),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function assuranceFromPayload(payload: JWTPayload): HumanAssurance {
  const amr = Array.isArray(payload.amr) ? payload.amr : [];
  return amr.some((value) => value === 'mfa' || value === 'otp' || value === 'webauthn') ? 'mfa' : 'single_factor';
}

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(header.split(';').flatMap((part) => {
    const index = part.indexOf('=');
    if (index <= 0) return [];
    try { return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]]; } catch { return []; }
  }));
}

async function setLocal(client: pg.PoolClient, key: string, value: string) {
  await client.query('SELECT set_config($1,$2,true)', [key, value]);
}
