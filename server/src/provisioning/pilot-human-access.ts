import type pg from 'pg';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createPool } from '../persistence/pool.js';

const uuid = z.string().uuid();
const people = [
  { key: 'AKETZA', name: 'Aketza', role: 'PLATFORM_ADMIN', scope: 'global' },
  { key: 'ZAQ', name: 'ZaQ', role: 'PLATFORM_OPERATOR', scope: 'tenant' },
  { key: 'ARKAITZ', name: 'Arkaitz', role: 'OWNER', scope: 'workshop' },
] as const;

type PilotPerson = (typeof people)[number];
export type PilotProvisioningResult = {
  name: PilotPerson['name'];
  userId: string;
  userStatus: 'active';
  issuer: string;
  subject: string;
  authority: { role: PilotPerson['role']; scope: PilotPerson['scope']; tenantId: string | null; status: 'active' };
};

const required = (environment: NodeJS.ProcessEnv, name: string) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};

export async function provisionPilotHumanAccess(
  pool: pg.Pool,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<PilotProvisioningResult[]> {
  const issuer = `${new URL(required(environment, 'OIDC_ISSUER')).origin}/`;
  const tenantId = uuid.parse(required(environment, 'HUMAN_AUTH_PILOT_TENANT_ID'));
  const inputs = people.map((person) => ({
    ...person,
    subject: required(environment, `PILOT_${person.key}_OIDC_SUBJECT`),
  }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_migrator');
    // These authority tables intentionally FORCE RLS for runtime roles. The migrator owns
    // them, so it can lift FORCE transactionally while taking exclusive table locks; FORCE
    // is restored before commit and a rollback restores it automatically on any failure.
    for (const table of ['users', 'external_identities', 'tenant_memberships', 'platform_access_grants']) {
      await client.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
    }
    const results: PilotProvisioningResult[] = [];
    for (const person of inputs) {
      // Serializes bootstrap attempts for this exact OIDC identity. The database-generated
      // UUID is created only when no canonical issuer+subject link exists.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${issuer}\n${person.subject}`]);
      const existing = await client.query<{ user_id: string }>(
        'SELECT user_id FROM external_identities WHERE issuer=$1 AND subject=$2', [issuer, person.subject],
      );
      let userId = existing.rows[0]?.user_id;
      if (!userId) {
        userId = (await client.query<{ id: string }>(
          "INSERT INTO users(status,pii_migration_state) VALUES('active','protected') RETURNING id",
        )).rows[0].id;
        await client.query(
          'INSERT INTO external_identities(user_id,issuer,subject) VALUES($1,$2,$3)',
          [userId, issuer, person.subject],
        );
      } else {
        await client.query("UPDATE users SET status='active',updated_at=now() WHERE id=$1", [userId]);
      }
      if (person.scope === 'workshop') {
        await client.query(`INSERT INTO tenant_memberships(user_id,tenant_id,role,status) VALUES($1,$2,$3,'active')
          ON CONFLICT(user_id,tenant_id) DO UPDATE SET role=excluded.role,status='active',valid_until=NULL,updated_at=now()`,
        [userId, tenantId, person.role]);
      } else {
        await client.query(`INSERT INTO platform_access_grants(user_id,role,scope_type,tenant_id,status)
          VALUES($1,$2,$3,$4,'active') ON CONFLICT DO NOTHING`,
        [userId, person.role, person.scope, person.scope === 'global' ? null : tenantId]);
        await client.query(`UPDATE platform_access_grants SET status='active',valid_until=NULL,updated_at=now()
          WHERE user_id=$1 AND role=$2 AND scope_type=$3 AND tenant_id IS NOT DISTINCT FROM $4`,
        [userId, person.role, person.scope, person.scope === 'global' ? null : tenantId]);
      }
      const verified = await client.query<{ user_active: boolean; identity_linked: boolean; authority_active: boolean }>(
        `SELECT
          EXISTS(SELECT 1 FROM users WHERE id=$1 AND status='active') AS user_active,
          EXISTS(SELECT 1 FROM external_identities WHERE user_id=$1 AND issuer=$2 AND subject=$3) AS identity_linked,
          CASE WHEN $4='workshop' THEN EXISTS(
            SELECT 1 FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$5 AND role=$6 AND status='active'
          ) ELSE EXISTS(
            SELECT 1 FROM platform_access_grants WHERE user_id=$1 AND role=$6 AND scope_type=$4
              AND tenant_id IS NOT DISTINCT FROM CASE WHEN $4='global' THEN NULL ELSE $5::uuid END AND status='active'
          ) END AS authority_active`,
        [userId, issuer, person.subject, person.scope, tenantId, person.role],
      );
      if (!verified.rows[0]?.user_active || !verified.rows[0].identity_linked || !verified.rows[0].authority_active) {
        throw new Error(`${person.key}_PROVISIONING_VERIFICATION_FAILED`);
      }
      results.push({
        name: person.name, userId, userStatus: 'active', issuer, subject: person.subject,
        authority: {
          role: person.role, scope: person.scope, tenantId: person.scope === 'global' ? null : tenantId, status: 'active',
        },
      });
    }
    for (const table of ['users', 'external_identities', 'tenant_memberships', 'platform_access_grants']) {
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pool = createPool('migrator');
  try {
    const results = await provisionPilotHumanAccess(pool);
    for (const result of results) process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}
