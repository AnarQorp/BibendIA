import { describe, expect, it } from 'vitest';
import { localIsoDateTime } from '../../src/api/provider-local-time.js';

describe('provider local appointment timestamps', () => {
  it('formats Europe/Madrid summer time with its DST offset', () => {
    expect(localIsoDateTime('2026-10-01T07:15:00.000Z', 'Europe/Madrid'))
      .toBe('2026-10-01T09:15:00+02:00');
  });

  it('formats Europe/Madrid winter time after the DST transition', () => {
    expect(localIsoDateTime('2026-11-01T08:15:00.000Z', 'Europe/Madrid'))
      .toBe('2026-11-01T09:15:00+01:00');
  });
});
