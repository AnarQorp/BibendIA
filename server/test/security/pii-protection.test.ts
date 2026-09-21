import { describe, expect, it } from 'vitest';
import {
  AesGcmPiiProtection, PiiProtectionError, normalizeE164Phone, normalizeSpanishPlate, piiProtectionFromEnvironment,
} from '../../src/security/pii-protection.js';

const enc = Buffer.alloc(32, 0x11);
const lookup = Buffer.alloc(32, 0x22);
const protection = () => new AesGcmPiiProtection(
  new Map([['enc-v1', enc]]), 'enc-v1', new Map([['lookup-v1', lookup]]), 'lookup-v1',
);

describe('P0.6 PII protection', () => {
  it('uses authenticated encryption bound to tenant and field', () => {
    const pii = protection();
    const protectedValue = pii.protect('tenant-a', 'vehicle.plate', '1489KMR');
    expect(protectedValue.ciphertext.toString('utf8')).not.toContain('1489KMR');
    expect(pii.reveal('tenant-a', 'vehicle.plate', protectedValue)).toBe('1489KMR');
    expect(() => pii.reveal('tenant-b', 'vehicle.plate', protectedValue)).toThrowError(PiiProtectionError);
    expect(() => pii.reveal('tenant-a', 'customer.display_name', protectedValue)).toThrowError(PiiProtectionError);
  });

  it('fails closed for altered ciphertext, wrong key and unknown key version', () => {
    const pii = protection();
    const value = pii.protect('tenant-a', 'vehicle.plate', '1489KMR');
    const altered = { ...value, ciphertext: Buffer.from(value.ciphertext) };
    altered.ciphertext[0] ^= 0xff;
    expect(() => pii.reveal('tenant-a', 'vehicle.plate', altered)).toThrowError('PII_AUTHENTICATION_FAILED');

    const wrong = new AesGcmPiiProtection(
      new Map([['enc-v1', Buffer.alloc(32, 0x33)]]), 'enc-v1', new Map([['lookup-v1', lookup]]), 'lookup-v1',
    );
    expect(() => wrong.reveal('tenant-a', 'vehicle.plate', value)).toThrowError('PII_AUTHENTICATION_FAILED');
    expect(() => pii.reveal('tenant-a', 'vehicle.plate', { ...value, keyId: 'missing' })).toThrowError('PII_KEY_UNKNOWN');
  });

  it('fails closed when environment key material is absent or malformed', () => {
    expect(() => piiProtectionFromEnvironment({})).toThrowError('PII_KEYS_UNAVAILABLE');
    expect(() => piiProtectionFromEnvironment({
      PII_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: 'not-a-32-byte-key' }), PII_ACTIVE_ENCRYPTION_KEY_ID: 'v1',
      PII_LOOKUP_KEYS_JSON: JSON.stringify({ v1: lookup.toString('base64') }), PII_ACTIVE_LOOKUP_KEY_ID: 'v1',
    })).toThrowError('PII_KEY_INVALID');
  });

  it('normalizes exact Spanish plate variants without enabling partial search', () => {
    expect(normalizeSpanishPlate(' 1489-kmr ')).toBe('1489KMR');
    expect(normalizeSpanishPlate('1489 KMR')).toBe('1489KMR');
    expect(() => normalizeSpanishPlate('149')).toThrowError('PII_KEY_INVALID');
    const pii = protection();
    expect(pii.activeLookupDigest('tenant-a', 'vehicle.plate', '1489KMR').digest)
      .toBe(pii.activeLookupDigest('tenant-a', 'vehicle.plate', normalizeSpanishPlate('1489-kmr')).digest);
    expect(pii.activeLookupDigest('tenant-a', 'vehicle.plate', '1489KMR').digest)
      .not.toBe(pii.activeLookupDigest('tenant-b', 'vehicle.plate', '1489KMR').digest);
  });

  it('accepts only normalized E.164 phone lookup input', () => {
    expect(normalizeE164Phone('+34 600-123-456')).toBe('+34600123456');
    expect(() => normalizeE164Phone('600123456')).toThrowError('PII_KEY_INVALID');
  });

  it('supports lookup-key rotation while new writes use only the active version', () => {
    const pii = new AesGcmPiiProtection(
      new Map([['enc-v1', enc]]), 'enc-v1',
      new Map([['lookup-v1', lookup], ['lookup-v2', Buffer.alloc(32, 0x44)]]), 'lookup-v2',
    );
    expect(pii.lookupDigests('tenant-a', 'vehicle.plate', '1489KMR')).toHaveLength(2);
    expect(pii.activeLookupDigest('tenant-a', 'vehicle.plate', '1489KMR').keyId).toBe('lookup-v2');
  });
});
