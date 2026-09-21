import { AesGcmPiiProtection } from '../../src/security/pii-protection.js';

// [TEST ONLY] Deterministic non-production keys for exercising real AES-GCM/HMAC code paths.
export function testPiiProtection() {
  return new AesGcmPiiProtection(
    new Map([['test-enc-v1', Buffer.alloc(32, 0x11)]]),
    'test-enc-v1',
    new Map([['test-lookup-v1', Buffer.alloc(32, 0x22)]]),
    'test-lookup-v1',
  );
}
