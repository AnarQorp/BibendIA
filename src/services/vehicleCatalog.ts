import type {
  VehicleCatalogFacets,
  VehicleCatalogQuery,
  VehicleKind
} from '../types/vehicleCatalog';

/**
 * Isolated development fallback slice of VehiclesDB (dataset 2026.09.1)
 * Used ONLY when local dev environment has no running backend or before migrations 020/021 are applied.
 */
const DEV_VEHICLES_DB_SOURCE = {
  provider: 'VehiclesDB',
  version: '2026.09.1',
  artifactSha256: '5cbed181c933e16e7ffeaf2cb7fcbd831774e2223f35eea60d1bd6b115c7d2ca',
  license: 'CC-BY-4.0',
  attribution: 'Vehicle data by VehiclesDB (https://vehiclesdb.com)',
  attributionUrl: 'https://vehiclesdb.com',
  importedAt: '2026-09-30T10:00:00.000Z'
};

const DEV_MAKES_CAR = [
  { sourceMakeId: 'volkswagen', name: 'Volkswagen', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: true },
  { sourceMakeId: 'peugeot', name: 'Peugeot', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: false },
  { sourceMakeId: 'renault', name: 'Renault', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: true },
  { sourceMakeId: 'seat', name: 'Seat', kinds: ['car'] as VehicleKind[], repairKnowledgeAvailable: true },
  { sourceMakeId: 'audi', name: 'Audi', kinds: ['car'] as VehicleKind[], repairKnowledgeAvailable: false },
  { sourceMakeId: 'bmw', name: 'BMW', kinds: ['car'] as VehicleKind[], repairKnowledgeAvailable: false },
  { sourceMakeId: 'ford', name: 'Ford', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: false },
  { sourceMakeId: 'toyota', name: 'Toyota', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: false }
];

const DEV_MAKES_VAN = [
  { sourceMakeId: 'volkswagen', name: 'Volkswagen', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: true },
  { sourceMakeId: 'peugeot', name: 'Peugeot', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: false },
  { sourceMakeId: 'renault', name: 'Renault', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: true },
  { sourceMakeId: 'ford', name: 'Ford', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: false },
  { sourceMakeId: 'toyota', name: 'Toyota', kinds: ['car', 'van'] as VehicleKind[], repairKnowledgeAvailable: false }
];

const DEV_MODELS: Record<string, Array<{
  sourceModelId: string;
  sourceMakeId: string;
  name: string;
  kind: VehicleKind;
  bodyTypes: string[];
  aliases: string[];
  repairKnowledgeAvailable: boolean;
  repairKnowledgeTargets: Array<{ make: string; model: string }>;
}>> = {
  volkswagen: [
    {
      sourceModelId: 'golf',
      sourceMakeId: 'volkswagen',
      name: 'Golf',
      kind: 'car',
      bodyTypes: ['Hatchback', 'Variant'],
      aliases: ['Golf 7', 'Golf VII'],
      repairKnowledgeAvailable: true,
      repairKnowledgeTargets: [{ make: 'Volkswagen', model: 'Golf VII' }]
    },
    {
      sourceModelId: 'polo',
      sourceMakeId: 'volkswagen',
      name: 'Polo',
      kind: 'car',
      bodyTypes: ['Hatchback'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    },
    {
      sourceModelId: 'passat',
      sourceMakeId: 'volkswagen',
      name: 'Passat',
      kind: 'car',
      bodyTypes: ['Sedan', 'Variant'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    },
    {
      sourceModelId: 'transporter',
      sourceMakeId: 'volkswagen',
      name: 'Transporter',
      kind: 'van',
      bodyTypes: ['Furgón', 'Combi'],
      aliases: ['T6'],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    },
    {
      sourceModelId: 'caddy',
      sourceMakeId: 'volkswagen',
      name: 'Caddy',
      kind: 'van',
      bodyTypes: ['Furgón'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    }
  ],
  peugeot: [
    {
      sourceModelId: '308',
      sourceMakeId: 'peugeot',
      name: '308',
      kind: 'car',
      bodyTypes: ['Hatchback', 'SW'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    },
    {
      sourceModelId: '208',
      sourceMakeId: 'peugeot',
      name: '208',
      kind: 'car',
      bodyTypes: ['Hatchback'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    },
    {
      sourceModelId: 'partner',
      sourceMakeId: 'peugeot',
      name: 'Partner',
      kind: 'van',
      bodyTypes: ['Furgón'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    }
  ],
  renault: [
    {
      sourceModelId: 'megane',
      sourceMakeId: 'renault',
      name: 'Mégane',
      kind: 'car',
      bodyTypes: ['Hatchback', 'Grandtour'],
      aliases: ['Megane IV'],
      repairKnowledgeAvailable: true,
      repairKnowledgeTargets: [{ make: 'Renault', model: 'Mégane IV' }]
    },
    {
      sourceModelId: 'clio',
      sourceMakeId: 'renault',
      name: 'Clio',
      kind: 'car',
      bodyTypes: ['Hatchback'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    },
    {
      sourceModelId: 'kangoo',
      sourceMakeId: 'renault',
      name: 'Kangoo',
      kind: 'van',
      bodyTypes: ['Furgón'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    }
  ],
  seat: [
    {
      sourceModelId: 'leon',
      sourceMakeId: 'seat',
      name: 'León',
      kind: 'car',
      bodyTypes: ['Hatchback', 'ST'],
      aliases: ['Leon 5F'],
      repairKnowledgeAvailable: true,
      repairKnowledgeTargets: [{ make: 'Seat', model: 'León 5F' }]
    },
    {
      sourceModelId: 'ibiza',
      sourceMakeId: 'seat',
      name: 'Ibiza',
      kind: 'car',
      bodyTypes: ['Hatchback'],
      aliases: [],
      repairKnowledgeAvailable: false,
      repairKnowledgeTargets: []
    }
  ]
};

export interface VehicleCatalogResponseState {
  status: 'success' | 'error' | 'unauthorized';
  data?: VehicleCatalogFacets;
  message?: string;
  isFallback?: boolean;
}

/**
 * Fetch vehicle catalog facets from backend (RK06).
 * Supports cancellation via AbortSignal to cleanly handle rapid UI changes.
 */
export async function fetchVehicleCatalogFacets(
  tenantId: string,
  query: VehicleCatalogQuery = {},
  signal?: AbortSignal,
  baseUrl = ''
): Promise<VehicleCatalogResponseState> {
  if (!tenantId) {
    return { status: 'error', message: 'Se requiere tenantId para consultar el catálogo.' };
  }

  const kind = query.kind || 'car';
  const queryParams = new URLSearchParams();
  queryParams.set('kind', kind);
  if (query.make) queryParams.set('make', query.make);
  if (query.model) queryParams.set('model', query.model);

  try {
    const res = await fetch(
      `${baseUrl}/v1/workshop/tenants/${encodeURIComponent(tenantId)}/vehicle-catalog/facets?${queryParams.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        signal
      }
    );

    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized', message: 'No autorizado para consultar el catálogo de vehículos.' };
    }

    if (res.ok) {
      const json = await res.json();
      return {
        status: 'success',
        data: json.data,
        isFallback: false
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    // Network / server unavailable fallback
  }

  // Isolated development fallback
  const makesPool = kind === 'van' ? DEV_MAKES_VAN : DEV_MAKES_CAR;
  const filteredMakes = query.make
    ? makesPool.filter(m => m.sourceMakeId.toLowerCase() === query.make?.toLowerCase() || m.name.toLowerCase() === query.make?.toLowerCase())
    : makesPool;

  let filteredModels: VehicleCatalogFacets['models'] = [];
  if (query.make) {
    const key = query.make.toLowerCase();
    const modelsPool = DEV_MODELS[key] || [];
    filteredModels = modelsPool.filter(m => m.kind === kind);
    if (query.model) {
      filteredModels = filteredModels.filter(m =>
        m.sourceModelId.toLowerCase() === query.model?.toLowerCase() ||
        m.name.toLowerCase() === query.model?.toLowerCase()
      );
    }
  }

  return {
    status: 'success',
    data: {
      source: DEV_VEHICLES_DB_SOURCE,
      makes: filteredMakes,
      models: filteredModels
    },
    isFallback: true
  };
}
