import { z } from 'zod';
import { createPool } from '../persistence/pool.js';

const uuid = z.string().uuid();
const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};
const issuer = `${new URL(required('OIDC_ISSUER')).origin}/`;
const tenantId = uuid.parse(required('HUMAN_AUTH_PILOT_TENANT_ID'));
const people = [
  { key: 'AKETZA', name: 'Aketza', role: 'PLATFORM_ADMIN', scope: 'global' },
  { key: 'ZAQ', name: 'ZaQ', role: 'PLATFORM_OPERATOR', scope: 'tenant' },
  { key: 'ARKAITZ', name: 'Arkaitz', role: 'OWNER', scope: 'workshop' },
] as const;

const pool = createPool('migrator');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE bibendia_migrator');
  for (const person of people) {
    const userId = uuid.parse(required(`PILOT_${person.key}_USER_ID`));
    const subject = required(`PILOT_${person.key}_OIDC_SUBJECT`);
    await client.query(`INSERT INTO users(id,status) VALUES($1,'active')
      ON CONFLICT(id) DO UPDATE SET status='active',updated_at=now()`, [userId]);
    const existing = await client.query<{ user_id: string }>(
      'SELECT user_id FROM external_identities WHERE issuer=$1 AND subject=$2', [issuer, subject],
    );
    if (existing.rowCount && existing.rows[0].user_id !== userId) throw new Error(`${person.key}_OIDC_IDENTITY_CONFLICT`);
    await client.query(`INSERT INTO external_identities(user_id,issuer,subject) VALUES($1,$2,$3)
      ON CONFLICT(issuer,subject) DO NOTHING`, [userId, issuer, subject]);
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
    process.stdout.write(`${person.name} Auth0 app_metadata: ${JSON.stringify({ bibendia_user_id: userId })}\n`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
