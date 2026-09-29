import { createHash } from 'node:crypto';
import type pg from 'pg';
import { loadEstimateDraft, type EstimateDraft } from './estimate-draft.js';

export type EstimateDraftStatus = 'technical_draft' | 'pending_approval' | 'sent' | 'approved';
export type EstimateLineChange = {
  id?: string;
  mutationKey?: string;
  description: string;
  itemType: 'PART_ROLE' | 'CONSUMABLE' | 'LABOR';
  quantity: number | null;
  unitPrice: number | null;
  currency: string | null;
  selected: boolean;
};
export type EditEstimateDraftCommand = {
  expectedVersion: number;
  idempotencyKey: string;
  status?: EstimateDraftStatus;
  lines?: EstimateLineChange[];
  deleteLineIds?: string[];
};

export class EstimateDraftEditingError extends Error {
  constructor(readonly code: 'ESTIMATE_DRAFT_NOT_FOUND' | 'ESTIMATE_VERSION_CONFLICT' | 'ESTIMATE_MUTATION_CONFLICT' |
    'ESTIMATE_DRAFT_NOT_EDITABLE' | 'ESTIMATE_STATUS_TRANSITION_INVALID' | 'ESTIMATE_LINE_NOT_FOUND' | 'RK_LINE_DELETE_FORBIDDEN') {
    super(code); this.name = 'EstimateDraftEditingError';
  }
}

export async function listEstimateDrafts(client: pg.PoolClient): Promise<Array<Pick<EstimateDraft,
  'id' | 'vehicleId' | 'repairJobCode' | 'status' | 'version' | 'createdAt' | 'updatedAt'>>> {
  const result = await client.query<any>(`SELECT d.id,d.vehicle_id,j.code repair_job_code,d.status,d.version,d.created_at,d.updated_at
    FROM estimate_drafts d JOIN repair_jobs j ON j.id=d.repair_job_id
    WHERE d.status<>'superseded' ORDER BY d.updated_at DESC,d.id`);
  return result.rows.map((row: any) => ({ id: row.id, vehicleId: row.vehicle_id, repairJobCode: row.repair_job_code,
    status: row.status, version: row.version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }));
}

export async function getEstimateDraft(client: pg.PoolClient, id: string): Promise<EstimateDraft> {
  const draft = await loadEstimateDraft(client, id);
  if (!draft) throw new EstimateDraftEditingError('ESTIMATE_DRAFT_NOT_FOUND');
  return draft;
}

export async function editEstimateDraft(client: pg.PoolClient, tenantId: string, id: string,
  command: EditEstimateDraftCommand): Promise<EstimateDraft> {
  const hash = requestHash(command);
  const replay = await client.query<{ request_hash: string }>(
    'SELECT request_hash FROM estimate_draft_mutations WHERE draft_id=$1 AND idempotency_key=$2', [id, command.idempotencyKey]);
  if (replay.rowCount) {
    if (replay.rows[0].request_hash !== hash) throw new EstimateDraftEditingError('ESTIMATE_MUTATION_CONFLICT');
    return getEstimateDraft(client, id);
  }

  const locked = await client.query<{ version: number; status: EstimateDraftStatus }>(
    'SELECT version,status FROM estimate_drafts WHERE id=$1 FOR UPDATE', [id]);
  if (!locked.rowCount) throw new EstimateDraftEditingError('ESTIMATE_DRAFT_NOT_FOUND');
  const current = locked.rows[0];
  if (current.version !== command.expectedVersion) throw new EstimateDraftEditingError('ESTIMATE_VERSION_CONFLICT');
  const changesLines = (command.lines?.length ?? 0) > 0 || (command.deleteLineIds?.length ?? 0) > 0;
  if ((current.status === 'sent' || current.status === 'approved') && changesLines) {
    throw new EstimateDraftEditingError('ESTIMATE_DRAFT_NOT_EDITABLE');
  }
  if (command.status && !validTransition(current.status, command.status)) throw new EstimateDraftEditingError('ESTIMATE_STATUS_TRANSITION_INVALID');

  for (const line of command.lines ?? []) {
    const pricing = line.unitPrice === null
      ? { currency: null, status: 'PENDING', provenance: null }
      : { currency: line.currency, status: 'MANUALLY_PRICED', provenance: 'MANUAL_WORKSHOP' };
    if (line.id) {
      const updated = await client.query(`UPDATE estimate_draft_lines SET description=$2,item_type=$3,quantity=$4,unit_price=$5,
        currency=$6,pricing_status=$7,pricing_provenance=$8,selected=$9,updated_at=now() WHERE draft_id=$1 AND id=$10`,
      [id,line.description,line.itemType,line.quantity,line.unitPrice,pricing.currency,pricing.status,pricing.provenance,line.selected,line.id]);
      if (updated.rowCount !== 1) throw new EstimateDraftEditingError('ESTIMATE_LINE_NOT_FOUND');
    } else {
      await client.query(`INSERT INTO estimate_draft_lines(tenant_id,draft_id,item_type,part_role_code,part_role_name,description,quantity,
        requirement_type,replace_once,confidence_state,automation_status,review_required,selected,confidence_reason,evidence_snapshot,
        line_source,unit_price,currency,pricing_status,pricing_provenance,mutation_key)
        VALUES($1,$2,$3,$4,$5,$5,$6,'OPTIONAL',false,'UNKNOWN','OPTIONAL',false,$7,'Manual workshop line','[]'::jsonb,
          'MANUAL_WORKSHOP',$8,$9,$10,$11,$12)
        ON CONFLICT(tenant_id,draft_id,mutation_key) DO NOTHING`,
      [tenantId,id,line.itemType,`MANUAL:${line.mutationKey}`,line.description,line.quantity,line.selected,line.unitPrice,
        pricing.currency,pricing.status,pricing.provenance,line.mutationKey]);
    }
  }

  for (const lineId of command.deleteLineIds ?? []) {
    const removed = await client.query(`DELETE FROM estimate_draft_lines
      WHERE draft_id=$1 AND id=$2 AND line_source='MANUAL_WORKSHOP'`, [id,lineId]);
    if (removed.rowCount !== 1) throw new EstimateDraftEditingError('RK_LINE_DELETE_FORBIDDEN');
  }

  const nextVersion = current.version + 1;
  await client.query('UPDATE estimate_drafts SET status=COALESCE($2,status),version=$3,updated_at=now() WHERE id=$1',
    [id,command.status ?? null,nextVersion]);
  await client.query(`INSERT INTO estimate_draft_mutations(tenant_id,draft_id,idempotency_key,request_hash,result_version)
    VALUES($1,$2,$3,$4,$5)`, [tenantId,id,command.idempotencyKey,hash,nextVersion]);
  return getEstimateDraft(client, id);
}

function validTransition(from: EstimateDraftStatus, to: EstimateDraftStatus): boolean {
  if (from === to) return true;
  return (from === 'technical_draft' && to === 'pending_approval') ||
    (from === 'pending_approval' && (to === 'technical_draft' || to === 'sent')) ||
    (from === 'sent' && to === 'approved');
}

function requestHash(command: EditEstimateDraftCommand): string {
  return createHash('sha256').update(JSON.stringify(command)).digest('hex');
}
