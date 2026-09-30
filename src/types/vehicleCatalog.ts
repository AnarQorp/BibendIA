/**
 * Vehicle Catalog & Progressive Repair Knowledge Types
 * Conforms to VehiclesDB pinned catalog (RK06) and progressive discovery (RK05) contracts.
 */

export type VehicleKind = 'car' | 'van';

export interface VehicleCatalogSource {
  provider: string;
  version: string;
  artifactSha256: string;
  license: string;
  attribution: string;
  attributionUrl: string;
  importedAt: string;
}

export interface VehicleCatalogMake {
  sourceMakeId: string;
  name: string;
  kinds: VehicleKind[];
  repairKnowledgeAvailable: boolean;
}

export interface RepairKnowledgeTarget {
  make: string;
  model: string;
}

export interface VehicleCatalogModel {
  sourceModelId: string;
  sourceMakeId: string;
  name: string;
  kind: VehicleKind;
  bodyTypes: string[];
  aliases: string[];
  repairKnowledgeAvailable: boolean;
  repairKnowledgeTargets: RepairKnowledgeTarget[];
}

export interface VehicleCatalogFacets {
  source: VehicleCatalogSource;
  makes: VehicleCatalogMake[];
  models: VehicleCatalogModel[];
}

export interface VehicleCatalogQuery {
  kind?: VehicleKind;
  make?: string;
  model?: string;
}

export interface RepairKnowledgeEngineOption {
  engineCode: string;
  variant: string | null;
  generation: string | null;
  label: string;
}

export interface RepairKnowledgeJob {
  code: string;
  name: string;
  system: string;
  subsystem: string;
}

export interface RepairKnowledgeFacets {
  makes: string[];
  models: string[];
  variants: string[];
  engines: RepairKnowledgeEngineOption[];
  repairJobs: RepairKnowledgeJob[];
}

export interface RepairKnowledgeDisambiguation {
  status: 'DISAMBIGUATION_REQUIRED';
  reason: 'ENGINE_REQUIRED' | 'VARIANT_REQUIRED';
  options: RepairKnowledgeEngineOption[];
}

export type ProgressiveRepairKnowledgeResult =
  | {
      status: 'RESOLVED';
      applicability: {
        code: string;
        make: string;
        model: string;
        generation: string | null;
        variant: string | null;
        engineCode: string;
        productionFrom: string | null;
        productionTo: string | null;
        restrictions: string | null;
      };
      repairJob: {
        code: string;
        system: string;
        subsystem: string;
        name: string;
        description: string | null;
      };
      components: any[];
      consumables: any[];
      validForMultipleVariants: boolean;
      matchedApplicabilities: string[];
    }
  | RepairKnowledgeDisambiguation;
