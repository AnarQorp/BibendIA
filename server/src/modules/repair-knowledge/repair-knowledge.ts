import type pg from 'pg';
import { z } from 'zod';
import { evaluateRepairKnowledgeConfidence, type BomClassification, type ConfidenceState, type RequirementType } from './confidence-policy.js';

const querySchema = z.object({
  make: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100),
  engineCode: z.string().trim().min(1).max(50).optional(), repairJobCode: z.string().trim().min(1).max(100),
  productionDate: z.string().date().optional(), variant: z.string().trim().min(1).max(100).optional(),
}).strict();

export type ResolveRepairKnowledgeQuery = z.infer<typeof querySchema>;
export type RepairEvidence = {
  source: string; reference: string; sourceType: string; checkedAt: string;
  confidenceState: ConfidenceState; reuseStatus: string; notes: string | null; sourceVersion: string | null;
};
export type RepairKnowledgeEdge = {
  code: string; itemKind: 'PART_ROLE' | 'CONSUMABLE'; partRole: { code: string; name: string; category: string };
  quantity: number | null; requirementType: RequirementType; bomClassification: BomClassification;
  confidenceState: ConfidenceState; condition: string | null; replaceOnce: boolean;
  side: string | null; axle: string | null; position: string | null; notes: string | null;
  automationEligible: boolean; manualReviewRequired: boolean; confidenceReason: string; evidence: RepairEvidence[];
};

export type RepairKnowledgeResolution = {
  applicability: { code: string; make: string; model: string; generation: string | null; variant: string | null; engineCode: string; productionFrom: string | null; productionTo: string | null; restrictions: string | null };
  repairJob: { code: string; system: string; subsystem: string; name: string; description: string | null };
  components: RepairKnowledgeEdge[]; consumables: RepairKnowledgeEdge[];
};

export type RepairKnowledgeDisambiguation = {
  status: 'DISAMBIGUATION_REQUIRED'; reason: 'ENGINE_REQUIRED' | 'VARIANT_REQUIRED';
  options: Array<{ engineCode: string; variant: string | null; generation: string | null; label: string }>;
};
export type ProgressiveRepairKnowledgeResult =
  | (RepairKnowledgeResolution & { status: 'RESOLVED'; validForMultipleVariants: boolean; matchedApplicabilities: string[] })
  | RepairKnowledgeDisambiguation;

const facetsSchema = z.object({
  make: z.string().trim().min(1).max(100).optional(), model: z.string().trim().min(1).max(100).optional(),
  variant: z.string().trim().min(1).max(100).optional(), engineCode: z.string().trim().min(1).max(50).optional(),
  repairJobCode: z.string().trim().min(1).max(100).optional(),
}).strict();
export type RepairKnowledgeFacetQuery = z.infer<typeof facetsSchema>;
export type RepairKnowledgeFacets = {
  makes: string[]; models: string[]; variants: string[]; engines: Array<{ engineCode: string; variant: string | null; generation: string | null; label: string }>;
  repairJobs: Array<{ code: string; name: string; system: string; subsystem: string }>;
};

type Row = {
  applicability_code: string; make: string; model: string; generation: string | null; variant: string | null; engine_code: string;
  production_from: Date | string | null; production_to: Date | string | null; restrictions: string | null;
  job_code: string; system: string; subsystem: string; job_name: string; job_description: string | null;
  edge_code: string; item_kind: 'PART_ROLE' | 'CONSUMABLE'; role_code: string; role_name: string; category: string;
  quantity: string | null; requirement_type: RequirementType; bom_classification: BomClassification; confidence_state: ConfidenceState;
  condition: string | null; replace_once: boolean; side: string | null; axle: string | null; position: string | null; notes: string | null;
  evidence: RepairEvidence[];
};

export async function resolveRepairKnowledge(pool: pg.Pool, input: ResolveRepairKnowledgeQuery & { engineCode: string }): Promise<RepairKnowledgeResolution | null> {
  const result = await resolveRepairKnowledgeProgressively(pool, input);
  return result?.status === 'RESOLVED' ? stripProgressiveMetadata(result) : null;
}

export async function resolveRepairKnowledgeProgressively(pool: pg.Pool, input: ResolveRepairKnowledgeQuery): Promise<ProgressiveRepairKnowledgeResult | null> {
  const query = querySchema.parse(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE bibendia_api');
    const result = await client.query<Row>(`
      SELECT a.code applicability_code,a.make,a.model,a.generation,a.variant,a.engine_code,a.production_from,a.production_to,a.restrictions,
        j.code job_code,j.system,j.subsystem,j.name job_name,j.description job_description,
        e.code edge_code,e.item_kind,r.code role_code,r.name role_name,r.category,e.quantity,e.requirement_type,
        e.bom_classification,e.confidence_state,e.condition,e.replace_once,e.side,e.axle,e.position,e.notes,
        COALESCE(jsonb_agg(jsonb_build_object('source',v.source,'reference',v.evidence_reference,'sourceType',v.source_type,
          'checkedAt',v.checked_at,'confidenceState',v.confidence_state,'reuseStatus',v.reuse_status,'notes',v.notes,
          'sourceVersion',v.source_version) ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL),'[]'::jsonb) evidence
      FROM repair_vehicle_applicabilities a
      JOIN repair_bom_edges e ON e.applicability_id=a.id
      JOIN repair_jobs j ON j.id=e.repair_job_id AND j.active
      JOIN repair_part_roles r ON r.id=e.part_role_id AND r.active
      LEFT JOIN repair_bom_evidence v ON v.edge_id=e.id
      WHERE lower(a.make)=lower($1) AND lower(a.model)=lower($2) AND ($3::text IS NULL OR upper(a.engine_code)=upper($3)) AND j.code=$4
        AND ($5::date IS NULL OR (($5::date >= COALESCE(a.production_from,'-infinity'::date)) AND ($5::date <= COALESCE(a.production_to,'infinity'::date))))
        AND ($6::text IS NULL OR lower(COALESCE(a.variant,''))=lower($6))
      GROUP BY a.id,j.id,e.id,r.id ORDER BY e.code`,
      [query.make, query.model, query.engineCode, query.repairJobCode, query.productionDate ?? null, query.variant ?? null]);
    await client.query('COMMIT');
    if (!result.rowCount) return null;
    const resolutions = [...new Set(result.rows.map((row) => row.applicability_code))].map((code) =>
      toResolution(result.rows.filter((row) => row.applicability_code === code)));
    if (resolutions.length === 1) return withProgressiveMetadata(resolutions[0], false, [resolutions[0].applicability.code]);
    const signatures = new Set(resolutions.map(technicalSignature));
    if (signatures.size === 1) return withProgressiveMetadata(resolutions[0], true, resolutions.map((item) => item.applicability.code));
    const distinctVariants = new Set(resolutions.map((item) => item.applicability.variant ?? ''));
    return {
      status: 'DISAMBIGUATION_REQUIRED', reason: !query.variant && distinctVariants.size > 1 ? 'VARIANT_REQUIRED' : 'ENGINE_REQUIRED',
      options: resolutions.map((item) => ({ engineCode: item.applicability.engineCode, variant: item.applicability.variant,
        generation: item.applicability.generation, label: [item.applicability.variant, item.applicability.engineCode].filter(Boolean).join(' — ') })),
    };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function listRepairKnowledgeVehicleFacets(pool: pg.Pool, input: RepairKnowledgeFacetQuery): Promise<RepairKnowledgeFacets> {
  const query = facetsSchema.parse(input); const client = await pool.connect();
  try {
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE bibendia_api');
    const rows = (await client.query<{ make: string; model: string; generation: string | null; variant: string | null; engine_code: string;
      job_code: string; job_name: string; system: string; subsystem: string }>(`
      SELECT DISTINCT a.make,a.model,a.generation,a.variant,a.engine_code,j.code job_code,j.name job_name,j.system,j.subsystem
      FROM repair_vehicle_applicabilities a JOIN repair_bom_edges e ON e.applicability_id=a.id
      JOIN repair_jobs j ON j.id=e.repair_job_id AND j.active
      WHERE ($1::text IS NULL OR lower(a.make)=lower($1)) AND ($2::text IS NULL OR lower(a.model)=lower($2))
        AND ($3::text IS NULL OR lower(COALESCE(a.variant,''))=lower($3)) AND ($4::text IS NULL OR upper(a.engine_code)=upper($4))
        AND ($5::text IS NULL OR j.code=$5)
      ORDER BY a.make,a.model,a.variant,a.engine_code,j.code`,
      [query.make ?? null, query.model ?? null, query.variant ?? null, query.engineCode ?? null, query.repairJobCode ?? null])).rows;
    await client.query('COMMIT');
    return {
      makes: unique(rows.map((row) => row.make)), models: unique(rows.map((row) => row.model)),
      variants: unique(rows.map((row) => row.variant).filter((value): value is string => value !== null)),
      engines: uniqueBy(rows.map((row) => ({ engineCode: row.engine_code, variant: row.variant, generation: row.generation,
        label: [row.variant, row.engine_code].filter(Boolean).join(' — ') })), (item) => `${item.engineCode}\0${item.variant ?? ''}\0${item.generation ?? ''}`),
      repairJobs: uniqueBy(rows.map((row) => ({ code: row.job_code, name: row.job_name, system: row.system, subsystem: row.subsystem })), (item) => item.code),
    };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

function toResolution(rows: Row[]): RepairKnowledgeResolution {
  const first = rows[0]; const edges = rows.map(toEdge);
  return { applicability: { code: first.applicability_code, make: first.make, model: first.model, generation: first.generation,
    variant: first.variant, engineCode: first.engine_code, productionFrom: date(first.production_from), productionTo: date(first.production_to), restrictions: first.restrictions },
  repairJob: { code: first.job_code, system: first.system, subsystem: first.subsystem, name: first.job_name, description: first.job_description },
  components: edges.filter((edge) => edge.itemKind === 'PART_ROLE'), consumables: edges.filter((edge) => edge.itemKind === 'CONSUMABLE') };
}

function technicalSignature(value: RepairKnowledgeResolution): string {
  const edge = (item: RepairKnowledgeEdge) => ({ itemKind: item.itemKind, partRole: item.partRole, quantity: item.quantity,
    requirementType: item.requirementType, bomClassification: item.bomClassification, confidenceState: item.confidenceState,
    condition: item.condition, replaceOnce: item.replaceOnce, side: item.side, axle: item.axle, position: item.position,
    notes: item.notes, automationEligible: item.automationEligible, manualReviewRequired: item.manualReviewRequired });
  const sorted = (items: RepairKnowledgeEdge[]) => items.map(edge).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify({ repairJob: value.repairJob, components: sorted(value.components), consumables: sorted(value.consumables) });
}
function withProgressiveMetadata(value: RepairKnowledgeResolution, multiple: boolean, codes: string[]): ProgressiveRepairKnowledgeResult {
  return { status: 'RESOLVED', validForMultipleVariants: multiple, matchedApplicabilities: codes, ...value };
}
function stripProgressiveMetadata(value: ProgressiveRepairKnowledgeResult & { status: 'RESOLVED' }): RepairKnowledgeResolution {
  const { status: _status, validForMultipleVariants: _multiple, matchedApplicabilities: _matched, ...resolution } = value; return resolution;
}
function unique(values: string[]): string[] { return [...new Set(values)]; }
function uniqueBy<T>(values: T[], key: (value: T) => string): T[] { return [...new Map(values.map((value) => [key(value), value])).values()]; }

function toEdge(row: Row): RepairKnowledgeEdge {
  const evidence = row.evidence ?? [];
  const hasValidEvidence = evidence.some((item) => Boolean(item.source && item.reference && item.sourceType && item.checkedAt && item.confidenceState === row.confidence_state));
  const decision = evaluateRepairKnowledgeConfidence({ confidenceState: row.confidence_state, bomClassification: row.bom_classification,
    requirementType: row.requirement_type, hasValidEvidence });
  return { code: row.edge_code, itemKind: row.item_kind, partRole: { code: row.role_code, name: row.role_name, category: row.category },
    quantity: row.quantity === null ? null : Number(row.quantity), requirementType: row.requirement_type, bomClassification: row.bom_classification,
    confidenceState: row.confidence_state, condition: row.condition, replaceOnce: row.replace_once, side: row.side, axle: row.axle,
    position: row.position, notes: row.notes, ...decision, confidenceReason: decision.reason, evidence };
}

function date(value: Date | string | null): string | null { return value === null ? null : new Date(value).toISOString().slice(0, 10); }
