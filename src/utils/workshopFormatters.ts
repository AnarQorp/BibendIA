/**
 * Centralized Workshop Presentation Formatters
 *
 * Translates internal technical and contractual backend codes into natural,
 * professional automotive workshop terminology for mechanics and receptionists.
 *
 * NOTE: These helpers are strictly for UI presentation. They NEVER mutate or alter
 * the underlying data structures or backend payloads.
 */

import type { EstimateAutomationStatus } from '../types';

export interface AutomationStatusPresentation {
  label: string;
  badgeClass: string;
  description: string;
}

/**
 * Translates technical automation states to workshop language.
 * Priority 1:
 * - AUTO_INCLUDED -> "Incluido"
 * - OPTIONAL -> "Opcional"
 * - REVIEW_REQUIRED -> "Revisar"
 * - BLOCKED -> "No incluido automáticamente"
 */
export function formatAutomationStatus(status?: EstimateAutomationStatus | string | null): AutomationStatusPresentation {
  switch (status) {
    case 'AUTO_INCLUDED':
      return {
        label: 'Incluido',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        description: 'Pieza de sustitución recomendada por protocolo técnico'
      };
    case 'OPTIONAL':
      return {
        label: 'Opcional',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        description: 'Componente opcional según estado o kilometraje'
      };
    case 'REVIEW_REQUIRED':
      return {
        label: 'Revisar',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: 'Requiere comprobación visual antes de confirmar'
      };
    case 'BLOCKED':
      return {
        label: 'No incluido automáticamente',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        description: 'No se incluye de inicio para evitar duplicidades'
      };
    default:
      return {
        label: status ? String(status) : 'Estándar',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        description: 'Partida estándar de taller'
      };
  }
}

/**
 * Translates internal quote/estimate statuses to workshop terms.
 */
export function formatQuoteStatus(status?: string | null): string {
  switch (status) {
    case 'technical_draft':
    case 'draft':
      return 'Borrador';
    case 'pending_approval':
      return 'Pendiente de aprobación';
    case 'approved':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    default:
      return status || 'Borrador';
  }
}

/**
 * Standard dictionary mapping known part role codes, edge codes, and English names
 * to standard automotive Spanish.
 */
const PART_DICTIONARY: Record<string, string> = {
  // Timing belt & drive system
  role_timing_belt: 'Correa de distribución',
  timing_belt: 'Correa de distribución',
  'timing 1': 'Correa de distribución',
  role_tensioner_pulley: 'Rodillo tensor',
  tensioner_pulley: 'Rodillo tensor',
  role_idler_pulley: 'Rodillo guía',
  idler_pulley: 'Rodillo guía',
  role_water_pump: 'Bomba de agua',
  water_pump: 'Bomba de agua',
  role_crankshaft_bolt: 'Tornillo de cigüeñal',
  stretch_bolt_crankshaft: 'Tornillo de cigüeñal',
  timing_belt_kit_water_pump: 'Kit de distribución con bomba de agua',

  // Cooling & fluids
  role_coolant: 'Líquido refrigerante',
  coolant: 'Líquido refrigerante',
  engine_oil: 'Aceite de motor',
  brake_fluid: 'Líquido de frenos',

  // Filters
  oil_filter: 'Filtro de aceite',
  air_filter: 'Filtro de aire',
  cabin_filter: 'Filtro de habitáculo',
  fuel_filter: 'Filtro de combustible',

  // Brakes
  brake_pad_front: 'Pastillas de freno delanteras',
  brake_disc_front: 'Discos de freno delanteros',
  brake_pad_rear: 'Pastillas de freno traseras',
  brake_disc_rear: 'Discos de freno traseros',
  wear_sensor: 'Sensor de desgaste de frenos',

  // Clutch & transmission
  clutch_dmf_kit_complete: 'Kit de embrague con volante bimasa',
  flywheel_stretch_bolts: 'Tornillos de volante bimasa',

  // Suspension & steering
  front_shock_absorber: 'Amortiguador delantero',
  rear_shock_absorber: 'Amortiguador trasero',
  stabilizer_link: 'Tirante de barra estabilizadora'
};

/**
 * Formats a part or consumable name for workshop presentation.
 * Uses partRoleCode, edgeCode, or raw description to lookup the Spanish equivalent,
 * falling back gracefully to the canonical description received from backend.
 */
export function formatPartName(
  target: string | {
    partRoleCode?: string | null;
    partRoleName?: string | null;
    description?: string | null;
    edgeCode?: string | null;
  } | null | undefined,
  codeOrRole?: string | null,
  _category?: string | null
): string {
  let partRoleCode: string | null | undefined;
  let partRoleName: string | null | undefined;
  let description: string | null | undefined;
  let edgeCode: string | null | undefined;

  if (typeof target === 'object' && target !== null) {
    partRoleCode = target.partRoleCode;
    partRoleName = target.partRoleName;
    description = target.description;
    edgeCode = target.edgeCode;
  } else {
    description = target;
    partRoleCode = codeOrRole;
    edgeCode = codeOrRole;
  }

  // 1. Try by partRoleCode
  if (partRoleCode) {
    const key = partRoleCode.trim().toLowerCase();
    if (PART_DICTIONARY[key]) return PART_DICTIONARY[key];
  }

  // 2. Try by edgeCode matches
  if (edgeCode) {
    const edge = edgeCode.toLowerCase();
    if (edge.includes('timing_belt') || edge.includes('_tb_001')) return 'Correa de distribución';
    if (edge.includes('tensioner_pulley') || edge.includes('_tb_002')) return 'Rodillo tensor';
    if (edge.includes('idler_pulley') || edge.includes('_tb_003')) return 'Rodillo guía';
    if (edge.includes('water_pump') || edge.includes('_tb_004')) return 'Bomba de agua';
    if (edge.includes('crankshaft_bolt') || edge.includes('stretch_bolt') || edge.includes('_tb_005')) return 'Tornillo de cigüeñal';
    if (edge.includes('coolant') || edge.includes('_tb_006')) return 'Líquido refrigerante';
  }

  // 3. Try by partRoleName
  if (partRoleName) {
    const key = partRoleName.trim().toLowerCase();
    if (PART_DICTIONARY[key]) return PART_DICTIONARY[key];
  }

  // 4. Try by description
  if (description) {
    const key = description.trim().toLowerCase();
    if (PART_DICTIONARY[key]) return PART_DICTIONARY[key];
    // Specific check for raw English strings
    if (key === 'timing 1' || key === 'timing belt') return 'Correa de distribución';
    if (key === 'tensioner pulley') return 'Rodillo tensor';
    if (key === 'idler pulley') return 'Rodillo guía';
    if (key === 'water pump') return 'Bomba de agua';
    if (key === 'stretch bolt crankshaft') return 'Tornillo de cigüeñal';
    if (key === 'coolant') return 'Líquido refrigerante';
  }

  // Fallback to canonical description as authoritative truth
  return description || partRoleName || 'Partida técnica';
}

/**
 * Formats price or displays "Precio pendiente" if null or PENDING.
 * Guarantees that unvalued lines never show "0 €" or "0,00 €".
 */
export function formatUnitPrice(
  price: number | null | undefined,
  pricingStatus?: string | null,
  currency = '€'
): string {
  if (price === null || price === undefined || pricingStatus === 'PENDING') {
    return 'Precio pendiente';
  }
  return `${price.toFixed(2)} ${currency}`;
}

/**
 * Formats total or displays "Pendiente" if null.
 */
export function formatLineTotal(
  total: number | null | undefined,
  currency = '€'
): string {
  if (total === null || total === undefined) {
    return 'Pendiente';
  }
  return `${total.toFixed(2)} ${currency}`;
}

/**
 * Formats appointment source cleanly for workshop UI.
 */
export function formatAppointmentSource(source?: string | null): {
  label: string;
  sourceKey: 'phone' | 'web' | 'workshop';
  tooltip: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (source) {
    case 'phone_ai':
    case 'phone':
      return {
        label: 'Teléfono',
        sourceKey: 'phone',
        tooltip: 'Cita acordada por teléfono',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200'
      };
    case 'web':
      return {
        label: 'Web',
        sourceKey: 'web',
        tooltip: 'Cita reservada desde la web',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
      };
    case 'workshop':
    default:
      return {
        label: 'Taller',
        sourceKey: 'workshop',
        tooltip: 'Cita registrada en el taller',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200'
      };
  }
}
