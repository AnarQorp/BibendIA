import { createHash } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { inTenantTransaction } from '../../persistence/pool.js';
import { decideEstimateLine, type EstimateAutomationStatus } from './estimate-draft-policy.js';
import { resolveRepairKnowledge, type RepairKnowledgeEdge, type RepairKnowledgeResolution } from './repair-knowledge.js';

const commandSchema = z.object({
  tenantId: z.string().uuid(), vehicleId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  vehicle: z.object({ make: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100),
    engineCode: z.string().trim().min(1).max(50), productionDate: z.string().date().optional(), variant: z.string().trim().min(1).max(100).optional() }).strict(),
  repairJobCode: z.string().trim().min(1).max(100),
}).strict();

export type CreateEstimateDraftCommand = z.infer<typeof commandSchema>;
export type EstimateDraftLine = {
  id: string; repairBomEdgeId: string; edgeCode: string; itemType: 'PART_ROLE' | 'CONSUMABLE'; partRoleCode: string; partRoleName: string;
  quantity: number | null; requirementType: string; replaceOnce: boolean; condition: string | null; confidenceState: string;
  automationStatus: EstimateAutomationStatus; reviewRequired: boolean; selected: boolean; confidenceReason: string;
  evidence: RepairKnowledgeEdge['evidence']; notes: string | null;
  description: string; lineSource: 'REPAIR_KNOWLEDGE' | 'MANUAL_WORKSHOP'; pricingProvenance: 'MANUAL_WORKSHOP' | null;
  unitPrice: number | null; currency: string | null; pricingStatus: 'PENDING' | 'MANUALLY_PRICED'; editable: true;
};
export type EstimateDraft = {
  id: string; tenantId: string; vehicleId: string; repairJobCode: string; applicabilityCode: string;
  status: 'technical_draft' | 'pending_approval' | 'sent' | 'approved' | 'superseded'; version: number;
  idempotencyKey: string; knowledgeRevision: string; createdAt: string; updatedAt: string;
  operation: { code: string; name: string; description: string | null; unitPrice: null; currency: null; pricingStatus: 'PENDING'; editable: true };
  lines: EstimateDraftLine[];
};

export class EstimateDraftError extends Error {
  constructor(readonly code: 'REPAIR_KNOWLEDGE_NOT_APPLICABLE' | 'VEHICLE_NOT_FOUND' | 'VEHICLE_DESCRIPTOR_MISMATCH' | 'IDEMPOTENCY_CONFLICT') {
    super(code); this.name = 'EstimateDraftError';
  }
}

export async function createEstimateDraftFromRepairKnowledge(pool: pg.Pool, raw: CreateEstimateDraftCommand): Promise<EstimateDraft> {
  const command = commandSchema.parse(raw);
  const knowledge = await resolveRepairKnowledge(pool, { ...command.vehicle, repairJobCode: command.repairJobCode });
  if (!knowledge) throw new EstimateDraftError('REPAIR_KNOWLEDGE_NOT_APPLICABLE');
  const revision = knowledgeRevision(knowledge);

  return inTenantTransaction(pool, command.tenantId, async (client) => {
    const vehicle = await client.query<{ make: string | null; model: string | null }>('SELECT make,model FROM vehicles WHERE id=$1', [command.vehicleId]);
    if (vehicle.rowCount !== 1) throw new EstimateDraftError('VEHICLE_NOT_FOUND');
    const stored = vehicle.rows[0];
    if ((stored.make && stored.make.toLowerCase() !== command.vehicle.make.toLowerCase()) ||
        (stored.model && stored.model.toLowerCase() !== command.vehicle.model.toLowerCase())) throw new EstimateDraftError('VEHICLE_DESCRIPTOR_MISMATCH');

    const existing = await client.query<{ id: string; vehicle_id: string; job_code: string; knowledge_revision: string }>(`
      SELECT d.id,d.vehicle_id,j.code job_code,d.knowledge_revision FROM estimate_drafts d
      JOIN repair_jobs j ON j.id=d.repair_job_id WHERE d.idempotency_key=$1`, [command.idempotencyKey]);
    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.vehicle_id !== command.vehicleId || row.job_code !== command.repairJobCode || row.knowledge_revision !== revision) {
        throw new EstimateDraftError('IDEMPOTENCY_CONFLICT');
      }
      return loadDraft(client, row.id);
    }

    const inserted = await client.query<{ id: string }>(`
      INSERT INTO estimate_drafts(tenant_id,vehicle_id,repair_job_id,applicability_id,idempotency_key,knowledge_revision,vehicle_snapshot,repair_job_snapshot)
      SELECT $1,$2,j.id,a.id,$3,$4,$5,$6 FROM repair_jobs j,repair_vehicle_applicabilities a WHERE j.code=$7 AND a.code=$8
      ON CONFLICT(tenant_id,idempotency_key) DO NOTHING RETURNING id`,
      [command.tenantId, command.vehicleId, command.idempotencyKey, revision, command.vehicle, knowledge.repairJob,
        command.repairJobCode, knowledge.applicability.code]);
    if (!inserted.rowCount) {
      const replay = await client.query<{ id: string; vehicle_id: string; job_code: string; knowledge_revision: string }>(`
        SELECT d.id,d.vehicle_id,j.code job_code,d.knowledge_revision FROM estimate_drafts d
        JOIN repair_jobs j ON j.id=d.repair_job_id WHERE d.idempotency_key=$1`, [command.idempotencyKey]);
      if (!replay.rowCount) throw new EstimateDraftError('IDEMPOTENCY_CONFLICT');
      const row = replay.rows[0];
      if (row.vehicle_id !== command.vehicleId || row.job_code !== command.repairJobCode || row.knowledge_revision !== revision) {
        throw new EstimateDraftError('IDEMPOTENCY_CONFLICT');
      }
      return loadDraft(client, row.id);
    }
    const draftId = inserted.rows[0].id;
    for (const edge of [...knowledge.components, ...knowledge.consumables]) await insertLine(client, command.tenantId, draftId, edge);
    return loadDraft(client, draftId);
  });
}

async function insertLine(client: pg.PoolClient, tenantId: string, draftId: string, edge: RepairKnowledgeEdge) {
  const decision = decideEstimateLine(edge);
  await client.query(`INSERT INTO estimate_draft_lines(tenant_id,draft_id,repair_bom_edge_id,item_type,part_role_code,part_role_name,quantity,
    requirement_type,replace_once,condition,confidence_state,automation_status,review_required,selected,confidence_reason,evidence_snapshot,notes,description)
    SELECT $1,$2,e.id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$5 FROM repair_bom_edges e WHERE e.code=$17`,
    [tenantId,draftId,edge.itemKind,edge.partRole.code,edge.partRole.name,edge.quantity,edge.requirementType,edge.replaceOnce,edge.condition,
      edge.confidenceState,decision.automationStatus,decision.reviewRequired,decision.selected,edge.confidenceReason,JSON.stringify(edge.evidence),edge.notes,edge.code]);
}

export async function loadEstimateDraft(client: pg.PoolClient, id: string): Promise<EstimateDraft | null> {
  const header = (await client.query<any>(`SELECT d.*,j.code job_code,a.code applicability_code FROM estimate_drafts d
    JOIN repair_jobs j ON j.id=d.repair_job_id JOIN repair_vehicle_applicabilities a ON a.id=d.applicability_id WHERE d.id=$1`, [id])).rows[0];
  if (!header) return null;
  const rows = (await client.query<any>(`SELECT l.*,e.code edge_code FROM estimate_draft_lines l LEFT JOIN repair_bom_edges e ON e.id=l.repair_bom_edge_id
    WHERE l.draft_id=$1 ORDER BY e.code`, [id])).rows;
  return { id: header.id, tenantId: header.tenant_id, vehicleId: header.vehicle_id, repairJobCode: header.job_code,
    applicabilityCode: header.applicability_code, status: header.status, idempotencyKey: header.idempotency_key,
    knowledgeRevision: header.knowledge_revision, version: header.version, createdAt: header.created_at.toISOString(), updatedAt: header.updated_at.toISOString(),
    operation: { code: header.job_code, name: header.repair_job_snapshot.name, description: header.repair_job_snapshot.description ?? null,
      unitPrice: null, currency: null, pricingStatus: 'PENDING', editable: true },
    lines: rows.map((row: any) => ({
      id: row.id, repairBomEdgeId: row.repair_bom_edge_id, edgeCode: row.edge_code, itemType: row.item_type,
      partRoleCode: row.part_role_code, partRoleName: row.part_role_name, quantity: row.quantity === null ? null : Number(row.quantity),
      requirementType: row.requirement_type, replaceOnce: row.replace_once, condition: row.condition, confidenceState: row.confidence_state,
      automationStatus: row.automation_status, reviewRequired: row.review_required, selected: row.selected,
      confidenceReason: row.confidence_reason, evidence: row.evidence_snapshot, notes: row.notes,
      description: row.description, lineSource: row.line_source, pricingProvenance: row.pricing_provenance,
      unitPrice: row.unit_price === null ? null : Number(row.unit_price), currency: row.currency,
      pricingStatus: row.pricing_status, editable: true,
    })) };
}

async function loadDraft(client: pg.PoolClient, id: string): Promise<EstimateDraft> {
  const draft = await loadEstimateDraft(client, id);
  if (!draft) throw new Error('ESTIMATE_DRAFT_NOT_FOUND');
  return draft;
}

function knowledgeRevision(knowledge: RepairKnowledgeResolution): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(knowledge)).digest('hex')}`;
}
