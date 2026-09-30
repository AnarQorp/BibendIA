import { createHash } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { inTenantTransaction } from '../../persistence/pool.js';
import { decideEstimateLine, type EstimateAutomationStatus } from './estimate-draft-policy.js';
import { resolveRepairKnowledgeProgressively, type RepairKnowledgeEdge, type RepairKnowledgeResolution } from './repair-knowledge.js';

const commandSchema = z.object({
  tenantId: z.string().uuid(), vehicleId: z.string().uuid(), idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  vehicle: z.object({ make: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100),
    engineCode: z.string().trim().min(1).max(50).optional(), productionDate: z.string().date().optional(), variant: z.string().trim().min(1).max(100).optional() }).strict(),
  repairJobCode: z.string().trim().min(1).max(100),
}).strict();

export type CreateEstimateDraftCommand = z.infer<typeof commandSchema>;

export const manualEstimateDraftCommandSchema = z.object({
  kind: z.literal('manual').optional(),
  tenantId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  title: z.string().trim().min(1).max(200).optional(),
  customerId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  customerSnapshot: z.object({
    name: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().max(200).optional(),
  }).strict().optional(),
  vehicleSnapshot: z.object({
    plate: z.string().trim().max(20).optional(),
    make: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    vin: z.string().trim().max(50).optional(),
  }).strict().optional(),
  lines: z.array(z.object({
    mutationKey: z.string().min(4).max(200).regex(/^[A-Za-z0-9._:-]+$/),
    description: z.string().trim().min(1).max(500),
    itemType: z.enum(['PART_ROLE', 'CONSUMABLE', 'LABOR']),
    quantity: z.number().positive().max(100000).nullable(),
    unitPrice: z.number().nonnegative().max(9999999999.99).nullable(),
    currency: z.string().length(3).transform((v) => v.toUpperCase()).nullable(),
    selected: z.boolean().default(true),
  })).max(100).optional(),
}).strict();

export type CreateManualEstimateDraftCommand = z.infer<typeof manualEstimateDraftCommandSchema>;

export type EstimateDraftLine = {
  id: string; repairBomEdgeId: string | null; edgeCode: string | null; itemType: 'PART_ROLE' | 'CONSUMABLE' | 'LABOR';
  partRoleCode: string | null; partRoleName: string | null;
  quantity: number | null; requirementType: string; replaceOnce: boolean; condition: string | null; confidenceState: string;
  automationStatus: EstimateAutomationStatus; reviewRequired: boolean; selected: boolean; confidenceReason: string;
  evidence: RepairKnowledgeEdge['evidence']; notes: string | null;
  description: string; lineSource: 'REPAIR_KNOWLEDGE' | 'MANUAL_WORKSHOP'; pricingProvenance: 'MANUAL_WORKSHOP' | null;
  unitPrice: number | null; currency: string | null; pricingStatus: 'PENDING' | 'MANUALLY_PRICED'; editable: true;
  mutationKey?: string | null;
};

export type EstimateDraft = {
  id: string; tenantId: string; draftType: 'REPAIR_KNOWLEDGE' | 'MANUAL_WORKSHOP';
  vehicleId: string | null; customerId: string | null; appointmentId: string | null;
  repairJobCode: string | null; applicabilityCode: string | null; title: string | null;
  status: 'technical_draft' | 'pending_approval' | 'sent' | 'approved' | 'superseded'; version: number;
  idempotencyKey: string; knowledgeRevision: string | null; createdAt: string; updatedAt: string;
  customerSnapshot?: { name?: string; phone?: string; email?: string } | null;
  vehicleSnapshot?: { plate?: string; make?: string; model?: string; year?: number; vin?: string } | null;
  operation: { code: string; name: string; description: string | null; unitPrice: number | null; currency: string | null; pricingStatus: 'PENDING' | 'MANUALLY_PRICED'; editable: true };
  lines: EstimateDraftLine[];
};

export class EstimateDraftError extends Error {
  constructor(readonly code: 'REPAIR_KNOWLEDGE_NOT_APPLICABLE' | 'REPAIR_KNOWLEDGE_DISAMBIGUATION_REQUIRED' | 'VEHICLE_NOT_FOUND' | 'VEHICLE_DESCRIPTOR_MISMATCH' | 'IDEMPOTENCY_CONFLICT') {
    super(code); this.name = 'EstimateDraftError';
  }
}

export async function createEstimateDraftFromRepairKnowledge(pool: pg.Pool, raw: CreateEstimateDraftCommand): Promise<EstimateDraft> {
  const command = commandSchema.parse(raw);
  const resolution = await resolveRepairKnowledgeProgressively(pool, { ...command.vehicle, repairJobCode: command.repairJobCode });
  if (resolution?.status === 'DISAMBIGUATION_REQUIRED') throw new EstimateDraftError('REPAIR_KNOWLEDGE_DISAMBIGUATION_REQUIRED');
  const knowledge = resolution;
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
      INSERT INTO estimate_drafts(tenant_id,draft_type,vehicle_id,repair_job_id,applicability_id,idempotency_key,knowledge_revision,vehicle_snapshot,repair_job_snapshot)
      SELECT $1,'REPAIR_KNOWLEDGE',$2,j.id,a.id,$3,$4,$5,$6 FROM repair_jobs j,repair_vehicle_applicabilities a WHERE j.code=$7 AND a.code=$8
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

export async function createManualEstimateDraft(
  pool: pg.Pool,
  pii: import('../../security/pii-protection.js').PiiProtection,
  raw: CreateManualEstimateDraftCommand,
): Promise<EstimateDraft> {
  const command = manualEstimateDraftCommandSchema.parse(raw);

  return inTenantTransaction(pool, command.tenantId, async (client) => {
    // Idempotency replay
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM estimate_drafts WHERE tenant_id=$1 AND idempotency_key=$2',
      [command.tenantId, command.idempotencyKey],
    );
    if (existing.rowCount) {
      return loadDraft(client, existing.rows[0].id, pii);
    }

    // Protect identifying PII in snapshots using cryptographic AES-GCM envelopes
    let customerClaim: ReturnType<typeof pii.protect> | null = null;
    if (command.customerSnapshot && (command.customerSnapshot.name || command.customerSnapshot.phone || command.customerSnapshot.email)) {
      customerClaim = pii.protect(command.tenantId, 'draft.customer_claim', JSON.stringify({
        name: command.customerSnapshot.name || null,
        phone: command.customerSnapshot.phone || null,
        email: command.customerSnapshot.email || null,
      }));
    }

    let vehicleClaim: ReturnType<typeof pii.protect> | null = null;
    if (command.vehicleSnapshot && (command.vehicleSnapshot.plate || command.vehicleSnapshot.vin)) {
      vehicleClaim = pii.protect(command.tenantId, 'draft.vehicle_claim', JSON.stringify({
        plate: command.vehicleSnapshot.plate || null,
        vin: command.vehicleSnapshot.vin || null,
      }));
    }

    const technicalVehicleSnapshot = {
      make: command.vehicleSnapshot?.make || null,
      model: command.vehicleSnapshot?.model || null,
      year: command.vehicleSnapshot?.year || null,
    };

    const title = command.title?.trim() || 'Presupuesto de taller';

    const inserted = await client.query<{ id: string }>(`
      INSERT INTO estimate_drafts(
        tenant_id, draft_type, vehicle_id, customer_id, appointment_id,
        idempotency_key, title, vehicle_snapshot, repair_job_snapshot,
        customer_claim_ciphertext, customer_claim_nonce, customer_claim_auth_tag, customer_claim_key_id,
        vehicle_claim_ciphertext, vehicle_claim_nonce, vehicle_claim_auth_tag, vehicle_claim_key_id
      ) VALUES (
        $1, 'MANUAL_WORKSHOP', $2, $3, $4,
        $5, $6, $7, '{}'::jsonb,
        $8, $9, $10, $11,
        $12, $13, $14, $15
      )
      ON CONFLICT(tenant_id, idempotency_key) DO NOTHING RETURNING id`,
      [
        command.tenantId,
        command.vehicleId || null,
        command.customerId || null,
        command.appointmentId || null,
        command.idempotencyKey,
        title,
        JSON.stringify(technicalVehicleSnapshot),
        customerClaim?.ciphertext ?? null, customerClaim?.nonce ?? null, customerClaim?.authTag ?? null, customerClaim?.keyId ?? null,
        vehicleClaim?.ciphertext ?? null, vehicleClaim?.nonce ?? null, vehicleClaim?.authTag ?? null, vehicleClaim?.keyId ?? null,
      ],
    );

    if (!inserted.rowCount) {
      const replay = await client.query<{ id: string }>(
        'SELECT id FROM estimate_drafts WHERE tenant_id=$1 AND idempotency_key=$2',
        [command.tenantId, command.idempotencyKey],
      );
      if (!replay.rowCount) throw new EstimateDraftError('IDEMPOTENCY_CONFLICT');
      return loadDraft(client, replay.rows[0].id, pii);
    }

    const draftId = inserted.rows[0].id;

    // Insert any initial manual lines
    for (const line of command.lines ?? []) {
      const pricing = line.unitPrice === null
        ? { currency: null, status: 'PENDING', provenance: null }
        : { currency: line.currency, status: 'MANUALLY_PRICED', provenance: 'MANUAL_WORKSHOP' };

      await client.query(`
        INSERT INTO estimate_draft_lines(
          tenant_id, draft_id, item_type, part_role_code, part_role_name, description,
          quantity, requirement_type, replace_once, confidence_state, automation_status,
          review_required, selected, confidence_reason, evidence_snapshot, line_source,
          unit_price, currency, pricing_status, pricing_provenance, mutation_key
        ) VALUES (
          $1, $2, $3, $4, $5, $5,
          $6, 'OPTIONAL', false, 'UNKNOWN', 'OPTIONAL',
          false, $7, 'Manual workshop line', '[]'::jsonb, 'MANUAL_WORKSHOP',
          $8, $9, $10, $11, $12
        )`,
        [
          command.tenantId, draftId, line.itemType, `MANUAL:${line.mutationKey}`, line.description,
          line.quantity, line.selected, line.unitPrice,
          pricing.currency, pricing.status, pricing.provenance, line.mutationKey,
        ],
      );
    }

    return loadDraft(client, draftId, pii);
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

export async function loadEstimateDraft(
  client: pg.PoolClient,
  id: string,
  pii?: import('../../security/pii-protection.js').PiiProtection,
): Promise<EstimateDraft | null> {
  const header = (await client.query<any>(`
    SELECT d.*, j.code job_code, a.code applicability_code
    FROM estimate_drafts d
    LEFT JOIN repair_jobs j ON j.id=d.repair_job_id
    LEFT JOIN repair_vehicle_applicabilities a ON a.id=d.applicability_id
    WHERE d.id=$1`, [id])).rows[0];
  if (!header) return null;

  const rows = (await client.query<any>(`
    SELECT l.*, e.code edge_code
    FROM estimate_draft_lines l
    LEFT JOIN repair_bom_edges e ON e.id=l.repair_bom_edge_id
    WHERE l.draft_id=$1
    ORDER BY l.created_at ASC, l.id ASC`, [id])).rows;

  let customerSnapshot = null;
  let vehicleSnapshot = header.vehicle_snapshot ?? {};

  if (pii && header.customer_claim_ciphertext) {
    try {
      customerSnapshot = JSON.parse(pii.reveal(header.tenant_id, 'draft.customer_claim', {
        ciphertext: header.customer_claim_ciphertext,
        nonce: header.customer_claim_nonce,
        authTag: header.customer_claim_auth_tag,
        keyId: header.customer_claim_key_id,
      }));
    } catch { /* ignore decrypt error */ }
  }

  if (pii && header.vehicle_claim_ciphertext) {
    try {
      const vClaim = JSON.parse(pii.reveal(header.tenant_id, 'draft.vehicle_claim', {
        ciphertext: header.vehicle_claim_ciphertext,
        nonce: header.vehicle_claim_nonce,
        authTag: header.vehicle_claim_auth_tag,
        keyId: header.vehicle_claim_key_id,
      }));
      vehicleSnapshot = { ...vehicleSnapshot, ...vClaim };
    } catch { /* ignore decrypt error */ }
  }

  const isManual = header.draft_type === 'MANUAL_WORKSHOP';
  const operationName = isManual
    ? (header.title || 'Presupuesto manual de taller')
    : (header.repair_job_snapshot?.name || 'Operación técnica');
  const operationCode = isManual ? 'MANUAL_OPERATION' : (header.job_code || 'OPERATION');

  return {
    id: header.id,
    tenantId: header.tenant_id,
    draftType: header.draft_type ?? (isManual ? 'MANUAL_WORKSHOP' : 'REPAIR_KNOWLEDGE'),
    vehicleId: header.vehicle_id,
    customerId: header.customer_id,
    appointmentId: header.appointment_id,
    repairJobCode: header.job_code ?? null,
    applicabilityCode: header.applicability_code ?? null,
    title: header.title ?? null,
    status: header.status,
    idempotencyKey: header.idempotency_key,
    knowledgeRevision: header.knowledge_revision ?? null,
    version: header.version,
    createdAt: header.created_at.toISOString(),
    updatedAt: header.updated_at.toISOString(),
    customerSnapshot,
    vehicleSnapshot,
    operation: {
      code: operationCode,
      name: operationName,
      description: header.repair_job_snapshot?.description ?? null,
      unitPrice: null,
      currency: null,
      pricingStatus: 'PENDING',
      editable: true,
    },
    lines: rows.map((row: any) => ({
      id: row.id,
      repairBomEdgeId: row.repair_bom_edge_id,
      edgeCode: row.edge_code,
      itemType: row.item_type,
      partRoleCode: row.part_role_code,
      partRoleName: row.part_role_name,
      quantity: row.quantity === null ? null : Number(row.quantity),
      requirementType: row.requirement_type,
      replaceOnce: row.replace_once,
      condition: row.condition,
      confidenceState: row.confidence_state,
      automationStatus: row.automation_status,
      reviewRequired: row.review_required,
      selected: row.selected,
      confidenceReason: row.confidence_reason,
      evidence: row.evidence_snapshot,
      notes: row.notes,
      description: row.description,
      lineSource: row.line_source,
      pricingProvenance: row.pricing_provenance,
      unitPrice: row.unit_price === null ? null : Number(row.unit_price),
      currency: row.currency,
      pricingStatus: row.pricing_status,
      editable: true,
      mutationKey: row.mutation_key,
    })),
  };
}

async function loadDraft(
  client: pg.PoolClient,
  id: string,
  pii?: import('../../security/pii-protection.js').PiiProtection,
): Promise<EstimateDraft> {
  const draft = await loadEstimateDraft(client, id, pii);
  if (!draft) throw new Error('ESTIMATE_DRAFT_NOT_FOUND');
  return draft;
}

function knowledgeRevision(knowledge: RepairKnowledgeResolution): string {
  const canonical = { applicability: knowledge.applicability, repairJob: knowledge.repairJob,
    components: knowledge.components, consumables: knowledge.consumables };
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}
