import type pg from 'pg';
import type { PiiProtection, StoredProtectedValue } from './pii-protection.js';
import { normalizeE164Phone, normalizeSpanishPlate, PiiProtectionError } from './pii-protection.js';

export async function insertProtectedCustomer(
  client: pg.PoolClient,
  pii: PiiProtection,
  input: { id: string; tenantId: string; displayName: string; phone?: string },
): Promise<void> {
  const protectedName = pii.protect(input.tenantId, 'customer.display_name', input.displayName);
  const normalizedPhone = input.phone ? normalizeE164Phone(input.phone) : null;
  const protectedPhone = normalizedPhone ? pii.protect(input.tenantId, 'customer.phone', normalizedPhone) : null;
  const phoneLookup = normalizedPhone ? pii.activeLookupDigest(input.tenantId, 'customer.phone', normalizedPhone) : null;
  if (normalizedPhone) {
    const candidates = pii.lookupDigests(input.tenantId, 'customer.phone', normalizedPhone).map((item) => item.digest);
    const existing = await client.query('SELECT 1 FROM customers WHERE tenant_id=$1 AND phone_lookup_digest=ANY($2::text[])', [input.tenantId, candidates]);
    if (existing.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
  }
  await client.query(
    `INSERT INTO customers
      (id,tenant_id,display_name_legacy,display_name_ciphertext,display_name_nonce,
       display_name_auth_tag,display_name_key_id,phone_legacy_hash,phone_ciphertext,phone_nonce,
       phone_auth_tag,phone_key_id,phone_lookup_digest,phone_lookup_key_id,pii_migration_state)
     VALUES($1,$2,NULL,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,'protected')`,
    [input.id, input.tenantId, protectedName.ciphertext, protectedName.nonce, protectedName.authTag, protectedName.keyId,
      protectedPhone?.ciphertext ?? null, protectedPhone?.nonce ?? null, protectedPhone?.authTag ?? null,
      protectedPhone?.keyId ?? null, phoneLookup?.digest ?? null, phoneLookup?.keyId ?? null],
  );
}

export async function insertProtectedVehicle(
  client: pg.PoolClient,
  pii: PiiProtection,
  input: { id: string; tenantId: string; plate: string; make?: string | null; model?: string | null },
): Promise<void> {
  const normalized = normalizeSpanishPlate(input.plate);
  const protectedPlate = pii.protect(input.tenantId, 'vehicle.plate', normalized);
  const lookup = pii.activeLookupDigest(input.tenantId, 'vehicle.plate', normalized);
  const candidates = pii.lookupDigests(input.tenantId, 'vehicle.plate', normalized).map((item) => item.digest);
  const existing = await client.query('SELECT 1 FROM vehicles WHERE tenant_id=$1 AND plate_lookup_digest=ANY($2::text[])', [input.tenantId, candidates]);
  if (existing.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
  await client.query(
    `INSERT INTO vehicles
      (id,tenant_id,plate_legacy_value,plate_legacy_hash,plate_ciphertext,plate_nonce,plate_auth_tag,
       plate_key_id,plate_lookup_digest,plate_lookup_key_id,pii_migration_state,make,model)
     VALUES($1,$2,NULL,NULL,$3,$4,$5,$6,$7,$8,'protected',$9,$10)`,
    [input.id, input.tenantId, protectedPlate.ciphertext, protectedPlate.nonce, protectedPlate.authTag,
      protectedPlate.keyId, lookup.digest, lookup.keyId, input.make ?? null, input.model ?? null],
  );
}

export function revealStored(
  pii: PiiProtection,
  scopeId: string,
  field: string,
  row: { ciphertext: Buffer; nonce: Buffer; auth_tag: Buffer; key_id: string },
): string {
  return pii.reveal(scopeId, field, row as StoredProtectedValue);
}
