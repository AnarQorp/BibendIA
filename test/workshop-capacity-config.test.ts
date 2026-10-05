import { describe, it, expect, vi, afterEach } from 'vitest';
import { patchPlatformWorkshop } from '../src/services/platformAdmin';
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
});
