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
  input: { id: string; tenantId: string; displayName: string; phone?: string | null; email?: string | null; notes?: string | null; allowDuplicatePhone?: boolean },
): Promise<void> {
  const protectedName = pii.protect(input.tenantId, 'customer.display_name', input.displayName.trim());
  const normalizedPhone = input.phone ? normalizeSpanishOrE164Phone(input.phone) : null;
  const protectedPhone = normalizedPhone ? pii.protect(input.tenantId, 'customer.phone', normalizedPhone) : null;
  const phoneLookup = normalizedPhone ? pii.activeLookupDigest(input.tenantId, 'customer.phone', normalizedPhone) : null;
  if (normalizedPhone && !input.allowDuplicatePhone) {
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

export async function updateProtectedCustomer(
  client: pg.PoolClient,
  pii: PiiProtection,
  input: {
    customerId: string;
    tenantId: string;
    displayName?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    allowDuplicatePhone?: boolean;
  },
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2',
    [input.customerId, input.tenantId]
  );
  if (!existing.rowCount) throw new Error('CUSTOMER_NOT_FOUND');

  const updates: string[] = [];
  const values: any[] = [input.customerId, input.tenantId];
  let pIdx = 3;

  if (input.displayName !== undefined) {
    const trimmed = input.displayName.trim();
    const protectedName = pii.protect(input.tenantId, 'customer.display_name', trimmed);
    updates.push(`display_name_ciphertext = $${pIdx++}, display_name_nonce = $${pIdx++}, display_name_auth_tag = $${pIdx++}, display_name_key_id = $${pIdx++}`);
    values.push(protectedName.ciphertext, protectedName.nonce, protectedName.authTag, protectedName.keyId);
  }

  if (input.phone !== undefined) {
    if (input.phone && input.phone.trim()) {
      const normalizedPhone = normalizeSpanishOrE164Phone(input.phone);
      const candidates = pii.lookupDigests(input.tenantId, 'customer.phone', normalizedPhone).map((item) => item.digest);
      if (!input.allowDuplicatePhone) {
        const conflict = await client.query('SELECT id FROM customers WHERE tenant_id = $1 AND phone_lookup_digest = ANY($2::text[]) AND id <> $3', [input.tenantId, candidates, input.customerId]);
        if (conflict.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
      }
      const protectedPhone = pii.protect(input.tenantId, 'customer.phone', normalizedPhone);
      const phoneLookup = pii.activeLookupDigest(input.tenantId, 'customer.phone', normalizedPhone);
      updates.push(`phone_ciphertext = $${pIdx++}, phone_nonce = $${pIdx++}, phone_auth_tag = $${pIdx++}, phone_key_id = $${pIdx++}, phone_lookup_digest = $${pIdx++}, phone_lookup_key_id = $${pIdx++}`);
      values.push(protectedPhone.ciphertext, protectedPhone.nonce, protectedPhone.authTag, protectedPhone.keyId, phoneLookup.digest, phoneLookup.keyId);
    } else {
      updates.push(`phone_ciphertext = NULL, phone_nonce = NULL, phone_auth_tag = NULL, phone_key_id = NULL, phone_lookup_digest = NULL, phone_lookup_key_id = NULL`);
    }
  }

  if (input.email !== undefined) {
    if (input.email && input.email.trim()) {
      const cleanEmail = input.email.trim().toLowerCase();
      const protectedEmail = pii.protect(input.tenantId, 'customer.email', cleanEmail);
      const emailLookup = pii.activeLookupDigest(input.tenantId, 'customer.email', cleanEmail);
      updates.push(`email_ciphertext = $${pIdx++}, email_nonce = $${pIdx++}, email_auth_tag = $${pIdx++}, email_key_id = $${pIdx++}, email_lookup_digest = $${pIdx++}, email_lookup_key_id = $${pIdx++}`);
      values.push(protectedEmail.ciphertext, protectedEmail.nonce, protectedEmail.authTag, protectedEmail.keyId, emailLookup.digest, emailLookup.keyId);
    } else {
      updates.push(`email_ciphertext = NULL, email_nonce = NULL, email_auth_tag = NULL, email_key_id = NULL, email_lookup_digest = NULL, email_lookup_key_id = NULL`);
    }
  }

  if (input.notes !== undefined) {
    if (input.notes && input.notes.trim()) {
      const cleanNotes = input.notes.trim();
      const protectedNotes = pii.protect(input.tenantId, 'customer.notes', cleanNotes);
      updates.push(`notes_ciphertext = $${pIdx++}, notes_nonce = $${pIdx++}, notes_auth_tag = $${pIdx++}, notes_key_id = $${pIdx++}`);
      values.push(protectedNotes.ciphertext, protectedNotes.nonce, protectedNotes.authTag, protectedNotes.keyId);
    } else {
      updates.push(`notes_ciphertext = NULL, notes_nonce = NULL, notes_auth_tag = NULL, notes_key_id = NULL`);
    }
  }

  if (updates.length > 0) {
    await client.query(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = $2`,
      values,
    );
  }
}

export async function updateProtectedVehicle(
  client: pg.PoolClient,
  pii: PiiProtection,
  input: {
    vehicleId: string;
    tenantId: string;
    plate?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    vin?: string | null;
  },
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM vehicles WHERE id = $1 AND tenant_id = $2',
    [input.vehicleId, input.tenantId]
  );
  if (!existing.rowCount) throw new Error('VEHICLE_NOT_FOUND');

  const updates: string[] = [];
  const values: any[] = [input.vehicleId, input.tenantId];
  let pIdx = 3;

  if (input.make !== undefined) {
    updates.push(`make = $${pIdx++}`);
    values.push(input.make?.trim() || null);
  }

  if (input.model !== undefined) {
    updates.push(`model = $${pIdx++}`);
    values.push(input.model?.trim() || null);
  }

  if (input.year !== undefined) {
    updates.push(`year = $${pIdx++}`);
    values.push(input.year ?? null);
  }

  if (input.plate !== undefined) {
    if (input.plate && input.plate.trim()) {
      const normalizedPlate = normalizeSpanishPlate(input.plate);
      const candidates = pii.lookupDigests(input.tenantId, 'vehicle.plate', normalizedPlate).map((item) => item.digest);
      const conflict = await client.query('SELECT id FROM vehicles WHERE tenant_id = $1 AND plate_lookup_digest = ANY($2::text[]) AND id <> $3', [input.tenantId, candidates, input.vehicleId]);
      if (conflict.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
      const protectedPlate = pii.protect(input.tenantId, 'vehicle.plate', normalizedPlate);
      const plateLookup = pii.activeLookupDigest(input.tenantId, 'vehicle.plate', normalizedPlate);
      updates.push(`plate_ciphertext = $${pIdx++}, plate_nonce = $${pIdx++}, plate_auth_tag = $${pIdx++}, plate_key_id = $${pIdx++}, plate_lookup_digest = $${pIdx++}, plate_lookup_key_id = $${pIdx++}`);
      values.push(protectedPlate.ciphertext, protectedPlate.nonce, protectedPlate.authTag, protectedPlate.keyId, plateLookup.digest, plateLookup.keyId);
    } else {
      updates.push(`plate_ciphertext = NULL, plate_nonce = NULL, plate_auth_tag = NULL, plate_key_id = NULL, plate_lookup_digest = NULL, plate_lookup_key_id = NULL`);
    }
  }

  if (input.vin !== undefined) {
    if (input.vin && input.vin.trim()) {
      const normalizedVin = input.vin.trim().toUpperCase();
      const candidates = pii.lookupDigests(input.tenantId, 'vehicle.vin', normalizedVin).map((item) => item.digest);
      const conflict = await client.query('SELECT id FROM vehicles WHERE tenant_id = $1 AND vin_lookup_digest = ANY($2::text[]) AND id <> $3', [input.tenantId, candidates, input.vehicleId]);
      if (conflict.rowCount) throw new PiiProtectionError('PII_LOOKUP_CONFLICT');
      const protectedVin = pii.protect(input.tenantId, 'vehicle.vin', normalizedVin);
      const vinLookup = pii.activeLookupDigest(input.tenantId, 'vehicle.vin', normalizedVin);
      updates.push(`vin_ciphertext = $${pIdx++}, vin_nonce = $${pIdx++}, vin_auth_tag = $${pIdx++}, vin_key_id = $${pIdx++}, vin_lookup_digest = $${pIdx++}, vin_lookup_key_id = $${pIdx++}`);
      values.push(protectedVin.ciphertext, protectedVin.nonce, protectedVin.authTag, protectedVin.keyId, vinLookup.digest, vinLookup.keyId);
    } else {
      updates.push(`vin_ciphertext = NULL, vin_nonce = NULL, vin_auth_tag = NULL, vin_key_id = NULL, vin_lookup_digest = NULL, vin_lookup_key_id = NULL`);
    }
  }

  if (updates.length > 0) {
    await client.query(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = $2`,
      values,
    );
  }
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
