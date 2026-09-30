import type pg from 'pg';
import type { PiiProtection, StoredProtectedValue } from './pii-protection.js';
import { normalizeE164Phone, normalizeSpanishPlate, PiiProtectionError } from './pii-protection.js';

export function normalizeSpanishOrE164Phone(value: string): string {
  let cleaned = value.trim().replace(/[\s().-]/g, '');
  if (!cleaned.startsWith('+') && /^\d{9}$/.test(cleaned)) {
    cleaned = `+34${cleaned}`;
  }
  return normalizeE164Phone(cleaned);
}

export async function insertProtectedCustomer(
  client: pg.PoolClient,
  pii: PiiProtection,
  input: { id: string; tenantId: string; displayName: string; phone?: string | null; email?: string | null; notes?: string | null },
): Promise<void> {
  const protectedName = pii.protect(input.tenantId, 'customer.display_name', input.displayName.trim());
  const normalizedPhone = input.phone ? normalizeSpanishOrE164Phone(input.phone) : null;
  const protectedPhone = normalizedPhone ? pii.protect(input.tenantId, 'customer.phone', normalizedPhone) : null;
  const phoneLookup = normalizedPhone ? pii.activeLookupDigest(input.tenantId, 'customer.phone', normalizedPhone) : null;
  if (normalizedPhone) {
    const candidates = pii.lookupDigests(input.tenantId, 'customer.phone', normalizedPhone).map((item) => item.digest);
    const existing = await client.query('SELECT 1 FROM customers WHERE tenant_id=$1 AND phone_lookup_digest=ANY($2::text[])', [input.tenantId, candidates]);
    if (existing.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
  }

  const cleanEmail = input.email?.trim().toLowerCase() || null;
  const protectedEmail = cleanEmail ? pii.protect(input.tenantId, 'customer.email', cleanEmail) : null;
  const emailLookup = cleanEmail ? pii.activeLookupDigest(input.tenantId, 'customer.email', cleanEmail) : null;

  const cleanNotes = input.notes?.trim() || null;
  const protectedNotes = cleanNotes ? pii.protect(input.tenantId, 'customer.notes', cleanNotes) : null;

  await client.query(
    `INSERT INTO customers
      (id,tenant_id,display_name_legacy,display_name_ciphertext,display_name_nonce,
       display_name_auth_tag,display_name_key_id,phone_legacy_hash,phone_ciphertext,phone_nonce,
       phone_auth_tag,phone_key_id,phone_lookup_digest,phone_lookup_key_id,pii_migration_state,
       email_ciphertext,email_nonce,email_auth_tag,email_key_id,email_lookup_digest,email_lookup_key_id,
       notes_ciphertext,notes_nonce,notes_auth_tag,notes_key_id)
     VALUES($1,$2,NULL,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,'protected',
            $13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [input.id, input.tenantId, protectedName.ciphertext, protectedName.nonce, protectedName.authTag, protectedName.keyId,
      protectedPhone?.ciphertext ?? null, protectedPhone?.nonce ?? null, protectedPhone?.authTag ?? null,
      protectedPhone?.keyId ?? null, phoneLookup?.digest ?? null, phoneLookup?.keyId ?? null,
      protectedEmail?.ciphertext ?? null, protectedEmail?.nonce ?? null, protectedEmail?.authTag ?? null,
      protectedEmail?.keyId ?? null, emailLookup?.digest ?? null, emailLookup?.keyId ?? null,
      protectedNotes?.ciphertext ?? null, protectedNotes?.nonce ?? null, protectedNotes?.authTag ?? null,
      protectedNotes?.keyId ?? null],
  );
}

export async function insertProtectedVehicle(
  client: pg.PoolClient,
  pii: PiiProtection,
  input: { id: string; tenantId: string; plate?: string | null; make?: string | null; model?: string | null; year?: number | null; vin?: string | null },
): Promise<void> {
  const normalizedPlate = input.plate ? normalizeSpanishPlate(input.plate) : null;
  let protectedPlate: ReturnType<PiiProtection['protect']> | null = null;
  let plateLookup: ReturnType<PiiProtection['activeLookupDigest']> | null = null;

  if (normalizedPlate) {
    protectedPlate = pii.protect(input.tenantId, 'vehicle.plate', normalizedPlate);
    plateLookup = pii.activeLookupDigest(input.tenantId, 'vehicle.plate', normalizedPlate);
    const candidates = pii.lookupDigests(input.tenantId, 'vehicle.plate', normalizedPlate).map((item) => item.digest);
    const existing = await client.query('SELECT 1 FROM vehicles WHERE tenant_id=$1 AND plate_lookup_digest=ANY($2::text[])', [input.tenantId, candidates]);
    if (existing.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
  }

  const normalizedVin = input.vin?.trim().toUpperCase() || null;
  let protectedVin: ReturnType<PiiProtection['protect']> | null = null;
  let vinLookup: ReturnType<PiiProtection['activeLookupDigest']> | null = null;

  if (normalizedVin) {
    protectedVin = pii.protect(input.tenantId, 'vehicle.vin', normalizedVin);
    vinLookup = pii.activeLookupDigest(input.tenantId, 'vehicle.vin', normalizedVin);
    const candidates = pii.lookupDigests(input.tenantId, 'vehicle.vin', normalizedVin).map((item) => item.digest);
    const existing = await client.query('SELECT 1 FROM vehicles WHERE tenant_id=$1 AND vin_lookup_digest=ANY($2::text[])', [input.tenantId, candidates]);
    if (existing.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
  }

  await client.query(
    `INSERT INTO vehicles
      (id,tenant_id,plate_legacy_value,plate_legacy_hash,plate_ciphertext,plate_nonce,plate_auth_tag,
       plate_key_id,plate_lookup_digest,plate_lookup_key_id,pii_migration_state,make,model,year,
       vin_ciphertext,vin_nonce,vin_auth_tag,vin_key_id,vin_lookup_digest,vin_lookup_key_id)
     VALUES($1,$2,NULL,NULL,$3,$4,$5,$6,$7,$8,'protected',$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [input.id, input.tenantId,
      protectedPlate?.ciphertext ?? null, protectedPlate?.nonce ?? null, protectedPlate?.authTag ?? null,
      protectedPlate?.keyId ?? null, plateLookup?.digest ?? null, plateLookup?.keyId ?? null,
      input.make ?? null, input.model ?? null, input.year ?? null,
      protectedVin?.ciphertext ?? null, protectedVin?.nonce ?? null, protectedVin?.authTag ?? null,
      protectedVin?.keyId ?? null, vinLookup?.digest ?? null, vinLookup?.keyId ?? null],
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

export function revealCustomerRow(
  row: {
    id: string;
    tenant_id: string;
    display_name_ciphertext: Buffer | null;
    display_name_nonce: Buffer | null;
    display_name_auth_tag: Buffer | null;
    display_name_key_id: string | null;
    phone_ciphertext: Buffer | null;
    phone_nonce: Buffer | null;
    phone_auth_tag: Buffer | null;
    phone_key_id: string | null;
    email_ciphertext?: Buffer | null;
    email_nonce?: Buffer | null;
    email_auth_tag?: Buffer | null;
    email_key_id?: string | null;
    notes_ciphertext?: Buffer | null;
    notes_nonce?: Buffer | null;
    notes_auth_tag?: Buffer | null;
    notes_key_id?: string | null;
  },
  pii: PiiProtection,
) {
  const name = row.display_name_ciphertext ? pii.reveal(row.tenant_id, 'customer.display_name', {
    ciphertext: row.display_name_ciphertext, nonce: row.display_name_nonce!,
    authTag: row.display_name_auth_tag!, keyId: row.display_name_key_id!,
  }) : 'Cliente';

  const phone = row.phone_ciphertext ? pii.reveal(row.tenant_id, 'customer.phone', {
    ciphertext: row.phone_ciphertext, nonce: row.phone_nonce!,
    authTag: row.phone_auth_tag!, keyId: row.phone_key_id!,
  }) : null;

  const email = row.email_ciphertext ? pii.reveal(row.tenant_id, 'customer.email', {
    ciphertext: row.email_ciphertext, nonce: row.email_nonce!,
    authTag: row.email_auth_tag!, keyId: row.email_key_id!,
  }) : null;

  const notes = row.notes_ciphertext ? pii.reveal(row.tenant_id, 'customer.notes', {
    ciphertext: row.notes_ciphertext, nonce: row.notes_nonce!,
    authTag: row.notes_auth_tag!, keyId: row.notes_key_id!,
  }) : null;

  return { id: row.id, name, phone, email, notes };
}

export function revealVehicleRow(
  row: {
    id: string;
    tenant_id: string;
    make: string | null;
    model: string | null;
    year?: number | null;
    plate_ciphertext: Buffer | null;
    plate_nonce: Buffer | null;
    plate_auth_tag: Buffer | null;
    plate_key_id: string | null;
    vin_ciphertext?: Buffer | null;
    vin_nonce?: Buffer | null;
    vin_auth_tag?: Buffer | null;
    vin_key_id?: string | null;
    customer_id?: string | null;
  },
  pii: PiiProtection,
) {
  const plate = row.plate_ciphertext ? pii.reveal(row.tenant_id, 'vehicle.plate', {
    ciphertext: row.plate_ciphertext, nonce: row.plate_nonce!,
    authTag: row.plate_auth_tag!, keyId: row.plate_key_id!,
  }) : null;

  const vin = row.vin_ciphertext ? pii.reveal(row.tenant_id, 'vehicle.vin', {
    ciphertext: row.vin_ciphertext, nonce: row.vin_nonce!,
    authTag: row.vin_auth_tag!, keyId: row.vin_key_id!,
  }) : null;

  return {
    id: row.id,
    plate,
    vin,
    make: row.make,
    model: row.model,
    year: row.year ?? null,
    customerId: row.customer_id ?? null,
  };
}
