import { describe, expect, it } from 'vitest';
import { canUseVehicleCatalogFallback } from '../../../src/services/vehicleCatalog.js';

describe('vehicle catalog fallback guard', () => {
  it('allows fallback only for a local development runtime', () => {
    expect(canUseVehicleCatalogFallback(new URL('http://localhost/?mock_catalog'), true)).toBe(true);
    expect(canUseVehicleCatalogFallback(new URL('http://127.0.0.1/'), true)).toBe(true);
  });

  it('fails closed for production regardless of hostname or query parameters', () => {
    expect(canUseVehicleCatalogFallback(new URL('https://app.bibendia.com/?mock_catalog'), false)).toBe(false);
    expect(canUseVehicleCatalogFallback(new URL('http://localhost/?mock_catalog'), false)).toBe(false);
  });

  it('does not allow a development build on a production hostname', () => {
    expect(canUseVehicleCatalogFallback(new URL('https://app.bibendia.com/?mock_catalog'), true)).toBe(false);
  });
});
