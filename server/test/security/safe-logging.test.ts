import { describe, expect, it } from 'vitest';
import { redactForLog, safeErrorAttributes } from '../../src/security/safe-logging.js';

describe('P0.6 safe logging', () => {
  it('redacts PII and secrets recursively', () => {
    const sensitive = {
      authorization: 'Bearer super-secret', customerName: 'Aitor Etxeberria',
      nested: { plate: '1489 KMR', email: 'aitor@example.test', safeId: 'case-123' },
    };
    const serialized = JSON.stringify(redactForLog(sensitive));
    for (const forbidden of ['super-secret', 'Aitor Etxeberria', '1489 KMR', 'aitor@example.test']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).toContain('case-123');
  });

  it('never emits an exception message or embedded request value', () => {
    const error = Object.assign(new Error('failed for Aitor, 1489 KMR, token-secret'), { code: 'PII_AUTHENTICATION_FAILED' });
    const serialized = JSON.stringify(safeErrorAttributes(error));
    expect(serialized).toContain('PII_AUTHENTICATION_FAILED');
    expect(serialized).not.toContain('Aitor');
    expect(serialized).not.toContain('1489');
    expect(serialized).not.toContain('token-secret');
  });
});
