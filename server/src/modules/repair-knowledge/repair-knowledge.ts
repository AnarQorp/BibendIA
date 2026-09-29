import type pg from 'pg';
import { z } from 'zod';
import { evaluateRepairKnowledgeConfidence, type BomClassification, type ConfidenceState, type RequirementType } from './confidence-policy.js';

const querySchema = z.object({
  make: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100),
  engineCode: z.string().trim().min(1).max(50), repairJobCode: z.string().trim().min(1).max(100),
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

type Row = {
  applicability_code: string; make: string; model: string; generation: string | null; variant: string | null; engine_code: string;
  production_from: Date | string | null; production_to: Date | string | null; restrictions: string | null;
  job_code: string; system: string; subsystem: string; job_name: string; job_description: string | null;
  edge_code: string; item_kind: 'PART_ROLE' | 'CONSUMABLE'; role_code: string; role_name: string; category: string;
  quantity: string | null; requirement_type: RequirementType; bom_classification: BomClassification; confidence_state: ConfidenceState;
  condition: string | null; replace_once: boolean; side: string | null; axle: string | null; position: string | null; notes: string | null;
  evidence: RepairEvidence[];
};

export async function resolveRepairKnowledge(pool: pg.Pool, input: ResolveRepairKnowledgeQuery): Promise<RepairKnowledgeResolution | null> {
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
      WHERE lower(a.make)=lower($1) AND lower(a.model)=lower($2) AND upper(a.engine_code)=upper($3) AND j.code=$4
        AND ($5::date IS NULL OR (($5::date >= COALESCE(a.production_from,'-infinity'::date)) AND ($5::date <= COALESCE(a.production_to,'infinity'::date))))
        AND ($6::text IS NULL OR lower(COALESCE(a.variant,''))=lower($6))
      GROUP BY a.id,j.id,e.id,r.id ORDER BY e.code`,
      [query.make, query.model, query.engineCode, query.repairJobCode, query.productionDate ?? null, query.variant ?? null]);
    await client.query('COMMIT');
    if (!result.rowCount) return null;
    const first = result.rows[0];
    const edges = result.rows.map(toEdge);
    return {
      applicability: { code: first.applicability_code, make: first.make, model: first.model, generation: first.generation,
        variant: first.variant, engineCode: first.engine_code, productionFrom: date(first.production_from), productionTo: date(first.production_to), restrictions: first.restrictions },
      repairJob: { code: first.job_code, system: first.system, subsystem: first.subsystem, name: first.job_name, description: first.job_description },
      components: edges.filter((edge) => edge.itemKind === 'PART_ROLE'), consumables: edges.filter((edge) => edge.itemKind === 'CONSUMABLE'),
    };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

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
