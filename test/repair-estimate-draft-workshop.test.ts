import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstimateDraft } from '../src/types';
import {
  buildEstimateDraftEditCommand,
  convertEstimateDraftToQuote,
  createEstimateDraft,
  fetchEstimateDraftById,
  resolveWorkshopVehicleId
} from '../src/services/repairKnowledge';

const UUID_PATTERN_FOR_TEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const draft: EstimateDraft = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  vehicleId: '33333333-3333-4333-8333-333333333333',
  repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
  applicabilityCode: 'APP_VAG_GOLF7_16TDI_CLHA_JOB_TIMING_BELT_WATER_PUMP',
  status: 'technical_draft',
  version: 1,
  idempotencyKey: 'rk-workshop-regression-create',
  knowledgeRevision: 'sha256:fixture',
  createdAt: '2026-09-30T00:00:00.000Z',
  operation: {
    code: 'JOB_TIMING_BELT_WATER_PUMP',
    name: 'Sustitución de distribución',
    description: null,
    unitPrice: null,
    currency: null,
    pricingStatus: 'PENDING',
    editable: true
  },
  lines: [{
    id: '44444444-4444-4444-8444-444444444444',
    repairBomEdgeId: '55555555-5555-4555-8555-555555555555',
    edgeCode: 'EDGE_GOLF7_CLHA_TB_001',
    itemType: 'PART_ROLE',
    partRoleCode: 'timing_belt',
    partRoleName: 'Correa de distribución',
    description: 'Correa de distribución',
    quantity: 1,
    requirementType: 'REQUIRED',
    replaceOnce: false,
    condition: null,
    confidenceState: 'MULTI_SOURCE_VERIFIED',
    automationStatus: 'AUTO_INCLUDED',
    reviewRequired: false,
    selected: true,
    confidenceReason: 'ELIGIBLE_VERIFIED',
    evidence: [],
    notes: null,
    lineSource: 'REPAIR_KNOWLEDGE',
    pricingProvenance: null,
    unitPrice: null,
    currency: null,
    pricingStatus: 'PENDING',
    editable: true
  }]
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Workshop RK draft persistence contract', () => {
  it('preserves the real Agenda vehicle UUID when local demo vehicles do not contain it', async () => {
    const agendaVehicleId = draft.vehicleId;
    const vehicleId = resolveWorkshopVehicleId(agendaVehicleId, [{
      id: 'v1', plate: '0000 DEM', brand: 'Volkswagen', model: 'Golf VII',
      year: 2015, kilometers: 100_000, motorization: '1.6 TDI', vin: 'DEMO'
    }]);
    expect(vehicleId).toBe(agendaVehicleId);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: draft, correlationId: 'post-correlation' }), {
        status: 201, headers: { 'Content-Type': 'application/json' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: draft, correlationId: 'get-correlation' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', fetchMock);

    const command = {
      vehicleId: vehicleId!,
      idempotencyKey: 'rk-draft-workshop-command',
      vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' },
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP'
    };
    const created = await createEstimateDraft(draft.tenantId, command);
    expect(created).toMatchObject({ status: 'success', data: { id: draft.id } });
    expect(created.data?.id).toMatch(UUID_PATTERN_FOR_TEST);
    const sentBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sentBody).toEqual(command);

    const reloaded = await fetchEstimateDraftById(draft.tenantId, created.data!.id);
    expect(reloaded).toMatchObject({ status: 'success', data: { id: draft.id } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a local demo vehicle id before issuing the production POST', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await createEstimateDraft(draft.tenantId, {
      vehicleId: 'v1',
      idempotencyKey: 'rk-draft-invalid-vehicle',
      vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' },
      repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP'
    });
    expect(result.status).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed instead of fabricating a persisted draft when the production POST fails', async () => {
    vi.stubGlobal('window', { location: new URL('https://app.bibendia.com/presupuestos') });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'SERVER_FAILURE' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })));

    const result = await createEstimateDraft(draft.tenantId, {
      vehicleId: draft.vehicleId,
      idempotencyKey: draft.idempotencyKey,
      vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' },
      repairJobCode: draft.repairJobCode
    });

    expect(result).toMatchObject({ status: 'error', message: 'SERVER_FAILURE' });
    expect(result.data).toBeUndefined();
  });

  it('serializes labor and part prices and renders the reloaded persisted lines once', () => {
    const quote = convertEstimateDraftToQuote(draft);
    const labor = quote.items.find((item) => item.category === 'labor')!;
    const part = quote.items.find((item) => item.category === 'part')!;
    labor.unitPrice = 55;
    labor.currency = 'EUR';
    labor.pricingStatus = 'MANUALLY_PRICED';
    part.unitPrice = 123.45;
    part.currency = 'EUR';
    part.pricingStatus = 'MANUALLY_PRICED';

    const command = buildEstimateDraftEditCommand(quote, 'rk-workshop-regression-edit');
    expect(command.lines).toContainEqual(expect.objectContaining({
      mutationKey: `operation-labor-${draft.id}`,
      itemType: 'LABOR',
      unitPrice: 55,
      currency: 'EUR'
    }));
    expect(command.lines).toContainEqual(expect.objectContaining({
      id: draft.lines[0].id,
      itemType: 'PART_ROLE',
      unitPrice: 123.45,
      currency: 'EUR'
    }));

    const reloaded = convertEstimateDraftToQuote({
      ...draft,
      version: 2,
      lines: [
        { ...draft.lines[0], unitPrice: 123.45, currency: 'EUR', pricingStatus: 'MANUALLY_PRICED' },
        { ...draft.lines[0], id: '66666666-6666-4666-8666-666666666666', repairBomEdgeId: null, edgeCode: null,
          itemType: 'LABOR', partRoleCode: 'MANUAL:operation-labor', partRoleName: draft.operation.name,
          description: draft.operation.name, quantity: 3.5, lineSource: 'MANUAL_WORKSHOP', pricingProvenance: 'MANUAL_WORKSHOP',
          unitPrice: 55, currency: 'EUR', pricingStatus: 'MANUALLY_PRICED' }
      ]
    });

    expect(reloaded.items.filter((item) => item.category === 'labor')).toHaveLength(1);
    expect(reloaded.items.find((item) => item.category === 'labor')?.unitPrice).toBe(55);
    expect(reloaded.items.find((item) => item.category === 'part')?.unitPrice).toBe(123.45);
  });
});
