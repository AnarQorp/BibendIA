import { describe, it, expect, vi, afterEach } from 'vitest';
import { patchPlatformWorkshop } from '../src/services/platformAdmin';
import { getWorkshopCapacity, patchWorkshopCapacity } from '../src/services/workshopOperations';
import { parsePositiveCapacityField, parseDurationField } from '../src/components/admin/views/WorkshopCapacityConfigSection';
import type { WorkshopOpeningHours, WorkshopServiceDurationPolicy, WorkshopCapacityPolicy } from '../src/types';

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

  describe('Capacity & Duration Field Parsing and Validation (Zero Silent Conversion Bug)', () => {
    describe('parsePositiveCapacityField', () => {
      it('specifically validates "8 -> borrar -> 6 -> guardar = 6" and guarantees it NEVER becomes 16', () => {
        // Initial state before editing
        const initial = 8;
        const parsedInitial = parsePositiveCapacityField(initial, 'Máximo de vehículos en taller');
        expect(parsedInitial.value).toBe(8);

        // Step 1: User clears the input (value becomes "")
        const clearedInput = '';
        const parsedCleared = parsePositiveCapacityField(clearedInput, 'Máximo de vehículos en taller');
        // Must reject empty without defaulting silently to 1!
        expect(parsedCleared.error).toBe('El campo "Máximo de vehículos en taller" no puede estar vacío.');
        expect(parsedCleared.value).toBeUndefined();

        // Step 2: User types "6"
        const typedInput = '6';
        const parsedTyped = parsePositiveCapacityField(typedInput, 'Máximo de vehículos en taller');
        expect(parsedTyped.error).toBeUndefined();
        expect(parsedTyped.value).toBe(6);

        // Crucial bug prevention assertion: verify it NEVER equals 16
        expect(parsedTyped.value).not.toBe(16);
      });

      it('validates the editing sequence (initial -> erase -> new value) across all 5 physical capacity fields', () => {
        const fields = [
          { name: 'Elevadores disponibles', initial: 2, typed: '4', expected: 4, forbiddenBugValue: 14 },
          { name: 'Otros puestos de trabajo', initial: 1, typed: '3', expected: 3, forbiddenBugValue: 13 },
          { name: 'Técnicos simultáneos', initial: 3, typed: '5', expected: 5, forbiddenBugValue: 15 },
          { name: 'Máximo de vehículos en taller', initial: 8, typed: '6', expected: 6, forbiddenBugValue: 16 },
          { name: 'Máximo de entradas por hora', initial: 2, typed: '4', expected: 4, forbiddenBugValue: 14 },
        ];

        for (const field of fields) {
          // Erase
          const erased = parsePositiveCapacityField('', field.name);
          expect(erased.error).toBe(`El campo "${field.name}" no puede estar vacío.`);
          expect(erased.value).toBeUndefined();

          // Type new value
          const result = parsePositiveCapacityField(field.typed, field.name);
          expect(result.error).toBeUndefined();
          expect(result.value).toBe(field.expected);
          expect(result.value).not.toBe(field.forbiddenBugValue);
        }
      });

      it('rejects invalid inputs (empty, zero, negative, decimal, above 500) without inventing fallback values', () => {
        const fieldName = 'Elevadores disponibles';

        // Empty string
        expect(parsePositiveCapacityField('', fieldName).error).toContain('no puede estar vacío');
        expect(parsePositiveCapacityField('   ', fieldName).error).toContain('no puede estar vacío');

        // Zero
        expect(parsePositiveCapacityField(0, fieldName).error).toContain('debe estar comprendido entre 1 y 500');
        expect(parsePositiveCapacityField('0', fieldName).error).toContain('debe estar comprendido entre 1 y 500');

        // Negative
        expect(parsePositiveCapacityField(-1, fieldName).error).toContain('debe estar comprendido entre 1 y 500');
        expect(parsePositiveCapacityField('-5', fieldName).error).toContain('debe estar comprendido entre 1 y 500');

        // Decimal
        expect(parsePositiveCapacityField(1.5, fieldName).error).toContain('debe ser un número entero');
        expect(parsePositiveCapacityField('2.7', fieldName).error).toContain('debe ser un número entero');

        // Exceeding 500
        expect(parsePositiveCapacityField(501, fieldName).error).toContain('debe estar comprendido entre 1 y 500');
        expect(parsePositiveCapacityField('999', fieldName).error).toContain('debe estar comprendido entre 1 y 500');

        // Non-numeric
        expect(parsePositiveCapacityField('abc', fieldName).error).toContain('debe ser un número entero');
      });

      it('accepts boundary valid values (1 and 500)', () => {
        expect(parsePositiveCapacityField(1, 'Test').value).toBe(1);
        expect(parsePositiveCapacityField('1', 'Test').value).toBe(1);
        expect(parsePositiveCapacityField(500, 'Test').value).toBe(500);
        expect(parsePositiveCapacityField('500', 'Test').value).toBe(500);
      });
    });

    describe('parseDurationField', () => {
      it('validates duration between 15 and 480 minutes and rejects empty or out-of-range', () => {
        expect(parseDurationField(45, 'oil_service').value).toBe(45);
        expect(parseDurationField('60', 'inspection').value).toBe(60);
        expect(parseDurationField(15, 'min').value).toBe(15);
        expect(parseDurationField(480, 'max').value).toBe(480);

        // Under 15 min
        expect(parseDurationField(10, 'short').error).toContain('entre 15 y 480 minutos');
        expect(parseDurationField('0', 'zero').error).toContain('entre 15 y 480 minutos');

        // Over 480 min
        expect(parseDurationField(500, 'long').error).toContain('entre 15 y 480 minutos');

        // Empty
        expect(parseDurationField('', 'empty').error).toContain('no puede estar vacía');

        // Decimal
        expect(parseDurationField(30.5, 'decimal').error).toContain('debe ser un número entero');
      });
    });

    describe('Payload Verification: Exact User Values Persisted', () => {
      it('verifies that saving edited capacity fields sends exactly the user values in patchWorkshopCapacity payload', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          status: 200,
          ok: true,
          headers: { get: () => 'corr-1' },
          json: async () => ({ receipt: { receiptId: 'rcpt-1' } })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Simulation of user inputs after "8 -> erase -> 6"
        const userInputs = {
          liftCount: '4',              // 2 -> "" -> 4
          nonLiftBayCount: '3',         // 1 -> "" -> 3
          concurrentTechnicians: '5',   // 3 -> "" -> 5
          maxVehiclesOnSite: '6',       // 8 -> "" -> 6 (Aketza scenario)
          maxVehicleIntakesPerHour: '4' // 2 -> "" -> 4
        };

        const parsedLift = parsePositiveCapacityField(userInputs.liftCount, 'Elevadores disponibles');
        const parsedNonLift = parsePositiveCapacityField(userInputs.nonLiftBayCount, 'Otros puestos de trabajo');
        const parsedTechs = parsePositiveCapacityField(userInputs.concurrentTechnicians, 'Técnicos simultáneos');
        const parsedMaxVehicles = parsePositiveCapacityField(userInputs.maxVehiclesOnSite, 'Máximo de vehículos en taller');
        const parsedIntakes = parsePositiveCapacityField(userInputs.maxVehicleIntakesPerHour, 'Máximo de entradas por hora');

        const cleanCapacityPolicy: WorkshopCapacityPolicy = {
          version: 'v1',
          liftCount: parsedLift.value!,
          nonLiftBayCount: parsedNonLift.value!,
          concurrentTechnicians: parsedTechs.value!,
          maxVehiclesOnSite: parsedMaxVehicles.value!,
          maxVehicleIntakesPerHour: parsedIntakes.value!,
          resourceRequirements: null,
        };

        const result = await patchWorkshopCapacity(tenantId, workshopId, {
          capacityPolicy: cleanCapacityPolicy,
          expectedVersion: 1,
          idempotencyKey: 'test-exact-payload'
        });

        expect(result.status).toBe('success');
        const [url, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);

        // Strictly verify payload contains exactly 6 for maxVehiclesOnSite and NEVER 16
        expect(body.capacityPolicy.maxVehiclesOnSite).toBe(6);
        expect(body.capacityPolicy.maxVehiclesOnSite).not.toBe(16);

        // Strictly verify other fields match user input exactly
        expect(body.capacityPolicy.liftCount).toBe(4);
        expect(body.capacityPolicy.nonLiftBayCount).toBe(3);
        expect(body.capacityPolicy.concurrentTechnicians).toBe(5);
        expect(body.capacityPolicy.maxVehicleIntakesPerHour).toBe(4);
      });
    });
  });
});
