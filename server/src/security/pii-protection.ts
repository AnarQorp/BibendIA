import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export type ProtectedValue = {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  keyId: string;
};

export type StoredProtectedValue = {
  ciphertext: Buffer;
  nonce: Buffer;
  auth_tag: Buffer;
  key_id: string;
};

export type LookupDigest = { keyId: string; digest: string };

export interface PiiProtection {
  protect(scopeId: string, field: string, plaintext: string): ProtectedValue;
  reveal(scopeId: string, field: string, value: ProtectedValue | StoredProtectedValue): string;
  lookupDigests(scopeId: string, field: string, normalizedValue: string): LookupDigest[];
  activeLookupDigest(scopeId: string, field: string, normalizedValue: string): LookupDigest;
}

export class PiiProtectionError extends Error {
  constructor(readonly code:
    | 'PII_KEYS_UNAVAILABLE'
    | 'PII_KEY_UNKNOWN'
    | 'PII_KEY_INVALID'
    | 'PII_LOOKUP_CONFLICT'
    | 'PII_AUTHENTICATION_FAILED') {
    super(code);
    this.name = 'PiiProtectionError';
  }
}

export class UnavailablePiiProtection implements PiiProtection {
  protect(): never { throw new PiiProtectionError('PII_KEYS_UNAVAILABLE'); }
  reveal(): never { throw new PiiProtectionError('PII_KEYS_UNAVAILABLE'); }
  lookupDigests(): never { throw new PiiProtectionError('PII_KEYS_UNAVAILABLE'); }
  activeLookupDigest(): never { throw new PiiProtectionError('PII_KEYS_UNAVAILABLE'); }
}

export class AesGcmPiiProtection implements PiiProtection {
  constructor(
    private readonly encryptionKeys: ReadonlyMap<string, Buffer>,
    private readonly activeEncryptionKeyId: string,
    private readonly lookupKeys: ReadonlyMap<string, Buffer>,
    private readonly activeLookupKeyId: string,
  ) {
    assertKey(this.encryptionKeys.get(this.activeEncryptionKeyId));
    assertKey(this.lookupKeys.get(this.activeLookupKeyId));
  }

  protect(scopeId: string, field: string, plaintext: string): ProtectedValue {
    const key = this.encryptionKeys.get(this.activeEncryptionKeyId);
    assertKey(key);
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad(scopeId, field));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { ciphertext, nonce, authTag: cipher.getAuthTag(), keyId: this.activeEncryptionKeyId };
  }

  reveal(scopeId: string, field: string, value: ProtectedValue | StoredProtectedValue): string {
    const keyId = 'keyId' in value ? value.keyId : value.key_id;
    const authTag = 'authTag' in value ? value.authTag : value.auth_tag;
    const key = this.encryptionKeys.get(keyId);
    if (!key) throw new PiiProtectionError('PII_KEY_UNKNOWN');
    assertKey(key);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, value.nonce, { authTagLength: TAG_BYTES });
      decipher.setAAD(aad(scopeId, field));
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new PiiProtectionError('PII_AUTHENTICATION_FAILED');
    }
  }

  lookupDigests(scopeId: string, field: string, normalizedValue: string): LookupDigest[] {
    return [...this.lookupKeys].map(([keyId, key]) => ({ keyId, digest: digest(key, scopeId, field, normalizedValue) }));
  }

  activeLookupDigest(scopeId: string, field: string, normalizedValue: string): LookupDigest {
    const key = this.lookupKeys.get(this.activeLookupKeyId);
    assertKey(key);
    return { keyId: this.activeLookupKeyId, digest: digest(key, scopeId, field, normalizedValue) };
  }
}

export function piiProtectionFromEnvironment(env: NodeJS.ProcessEnv = process.env): PiiProtection {
  const encryptionJson = env.PII_ENCRYPTION_KEYS_JSON;
  const activeEncryption = env.PII_ACTIVE_ENCRYPTION_KEY_ID;
  const lookupJson = env.PII_LOOKUP_KEYS_JSON;
  const activeLookup = env.PII_ACTIVE_LOOKUP_KEY_ID;
  if (!encryptionJson || !activeEncryption || !lookupJson || !activeLookup) {
    throw new PiiProtectionError('PII_KEYS_UNAVAILABLE');
  }
  return new AesGcmPiiProtection(
    parseKeyMap(encryptionJson), activeEncryption, parseKeyMap(lookupJson), activeLookup,
  );
}

export function normalizeSpanishPlate(value: string): string {
  const normalized = value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{4,12}$/.test(normalized)) throw new PiiProtectionError('PII_KEY_INVALID');
  return normalized;
}

export function normalizeE164Phone(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) throw new PiiProtectionError('PII_KEY_INVALID');
  return normalized;
}

function aad(scopeId: string, field: string): Buffer {
  if (!scopeId || !field) throw new PiiProtectionError('PII_KEY_INVALID');
  return Buffer.from(`bibendia-pii-v1\0${scopeId}\0${field}`, 'utf8');
}

function digest(key: Buffer, scopeId: string, field: string, normalizedValue: string): string {
  assertKey(key);
  return createHmac('sha256', key)
    .update(`bibendia-lookup-v1\0${scopeId}\0${field}\0${normalizedValue}`, 'utf8')
    .digest('hex');
}

function parseKeyMap(raw: string): Map<string, Buffer> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new PiiProtectionError('PII_KEY_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PiiProtectionError('PII_KEY_INVALID');
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) throw new PiiProtectionError('PII_KEY_INVALID');
  const keys = new Map<string, Buffer>();
  for (const [keyId, encoded] of entries) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof encoded !== 'string') throw new PiiProtectionError('PII_KEY_INVALID');
    const key = Buffer.from(encoded, 'base64');
    assertKey(key);
    keys.set(keyId, key);
  }
  return keys;
}

function assertKey(key: Buffer | undefined): asserts key is Buffer {
  if (!key || key.length !== KEY_BYTES) throw new PiiProtectionError('PII_KEY_INVALID');
}
