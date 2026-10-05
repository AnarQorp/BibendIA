import { describe, it, expect, vi, afterEach } from 'vitest';
import { patchPlatformWorkshop } from '../src/services/platformAdmin';
import { getWorkshopCapacity, patchWorkshopCapacity } from '../src/services/workshopOperations';
import type { WorkshopOpeningHours, WorkshopServiceDurationPolicy } from '../src/types';

describe('Workshop Capacity and Operational Configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const workshopId = '22222222-2222-4222-8222-222222222222';

  it('sends opening hours with 1 and 2 slots per day, optimistic lock expectedVersion, and idempotencyKey', async () => {
    const mockReceipt = {
      receiptId: 'rcpt_987654321',
      operation: 'workshop.update_configuration',
      entityType: 'workshop',
      entityId: workshopId,
      correlationId: 'corr-123',
      occurredAt: '2026-10-05T10:00:00Z'
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: (header: string) => (header.toLowerCase() === 'x-correlation-id' ? 'corr-123' : null) },
      json: async () => ({
        receipt: mockReceipt,
        correlationId: 'corr-123'
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const openingHours: WorkshopOpeningHours = {
      '1': [{ start: '08:00', end: '13:00' }, { start: '15:00', end: '19:00' }],
      '6': [{ start: '09:00', end: '13:00' }],
      '7': []
    };

    const durationPolicy: WorkshopServiceDurationPolicy = {
      version: 'v1',
      rules: {
        inspection: 45,
        oil_service: 45,
        brakes_or_noise: 60,
        generic_fault: 90
      },
      fallbackMinutes: 60
    };

    const result = await patchPlatformWorkshop(tenantId, workshopId, {
      openingHours: openingHours,
      serviceDurationPolicy: durationPolicy,
      expectedVersion: 3,
      idempotencyKey: 'test-idemp-123'
    });

    expect(result.status).toBe('success');
    expect(result.ok).toBe(true);
    expect(result.receipt?.receiptId).toBe('rcpt_987654321');
    expect(result.correlationId).toBe('corr-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain(`/v1/platform/tenants/${tenantId}/workshops/${workshopId}`);
    expect(options.method).toBe('PATCH');
    // Strictly verify NO Idempotency-Key header is sent (body holds idempotencyKey)
    expect(options.headers['Idempotency-Key']).toBeUndefined();

    // Strictly verify body uses camelCase contract keys matching backend authority
    const body = JSON.parse(options.body);
    expect(body.expectedVersion).toBe(3);
    expect(body.idempotencyKey).toBe('test-idemp-123');
    expect(body.openingHours['1']).toHaveLength(2);
    expect(body.openingHours['6']).toHaveLength(1);
    expect(body.openingHours['7']).toHaveLength(0);
    expect(body.serviceDurationPolicy.rules.generic_fault).toBe(90);
    expect(body.serviceDurationPolicy.fallbackMinutes).toBe(60);
  });

  it('handles 409 Conflict with optimistic lock version_conflict status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 409,
      ok: false,
      headers: { get: () => 'corr-conflict' },
      json: async () => ({
        message: 'Conflict: Workshop was modified by another session'
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await patchPlatformWorkshop(tenantId, workshopId, {
      expectedVersion: 2,
      idempotencyKey: 'test-idemp-conflict'
    });

    expect(result.status).toBe('version_conflict');
    expect(result.message).toContain('Conflicto');
  });

  it('handles 401/403 unauthorized responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      headers: { get: () => 'corr-auth' },
      json: async () => ({})
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await patchPlatformWorkshop(tenantId, workshopId, {
      expectedVersion: 1,
      idempotencyKey: 'test-idemp-unauth'
    });
    expect(result.status).toBe('unauthorized');
  });

  describe('getWorkshopCapacity & patchWorkshopCapacity (Operational Surface)', () => {
    it('fetches real capacity and live on-site vehicle occupancy via GET /v1/workshop/tenants/:tenantId/workshops/:workshopId/capacity', async () => {
      const mockCapacityPayload = {
        workshopId,
        tenantId,
        version: 5,
        capacityPolicy: {
          version: 'v1',
          liftCount: 3,
          nonLiftBayCount: 2,
          concurrentTechnicians: 4,
          maxVehiclesOnSite: 8,
          maxVehicleIntakesPerHour: 2
        },
        vehiclesCurrentlyOnSite: 3
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: { get: () => null },
        json: async () => mockCapacityPayload
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getWorkshopCapacity(tenantId, workshopId);

      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data?.version).toBe(5);
      expect(result.data?.capacityPolicy.liftCount).toBe(3);
      expect(result.data?.capacityPolicy.maxVehiclesOnSite).toBe(8);
      expect(result.data?.vehiclesCurrentlyOnSite).toBe(3);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(`/v1/workshop/tenants/${tenantId}/workshops/${workshopId}/capacity`);
      expect(options.method).toBe('GET');
    });

    it('patches physical capacity resources with expectedVersion and idempotencyKey', async () => {
      const mockResponse = {
        receipt: {
          receiptId: 'rcpt_cap_123',
          operation: 'workshop.update_capacity',
          entityType: 'workshop_capacity',
          entityId: workshopId,
          correlationId: 'corr-cap-1',
          occurredAt: '2026-10-05T11:00:00Z'
        },
        correlationId: 'corr-cap-1'
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: { get: () => 'corr-cap-1' },
        json: async () => mockResponse
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await patchWorkshopCapacity(tenantId, workshopId, {
        capacityPolicy: {
          version: 'v1',
          liftCount: 4,
          nonLiftBayCount: 3,
          concurrentTechnicians: 5,
          maxVehiclesOnSite: 10,
          maxVehicleIntakesPerHour: 3
        },
        expectedVersion: 5,
        idempotencyKey: 'idemp-cap-update-1'
      });

      expect(result.status).toBe('success');
      expect(result.ok).toBe(true);
      expect(result.receipt?.receiptId).toBe('rcpt_cap_123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(`/v1/workshop/tenants/${tenantId}/workshops/${workshopId}/capacity`);
      expect(options.method).toBe('PATCH');

      const body = JSON.parse(options.body);
      expect(body.expectedVersion).toBe(5);
      expect(body.idempotencyKey).toBe('idemp-cap-update-1');
      expect(body.capacityPolicy.liftCount).toBe(4);
      expect(body.capacityPolicy.maxVehiclesOnSite).toBe(10);
    });

    it('handles 403 Forbidden when unauthorized user (such as RECEPTION) attempts capacity modification', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        headers: { get: () => 'corr-403' },
        json: async () => ({
          error: 'FORBIDDEN',
          message: 'Insufficient capability for workshop capacity configuration'
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await patchWorkshopCapacity(tenantId, workshopId, {
        expectedVersion: 1,
        idempotencyKey: 'idemp-unauth'
      });

      expect(result.status).toBe('unauthorized');
      expect(result.message).toContain('No autorizado');
    });

    it('handles 409 Conflict when version mismatches during capacity patch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 409,
        ok: false,
        headers: { get: () => 'corr-409' },
        json: async () => ({
          error: 'VERSION_CONFLICT',
          message: 'Version conflict: Expected version does not match'
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await patchWorkshopCapacity(tenantId, workshopId, {
        expectedVersion: 1,
        idempotencyKey: 'idemp-conflict'
      });

      expect(result.status).toBe('version_conflict');
      expect(result.message).toContain('Conflicto');
    });
  });
});
