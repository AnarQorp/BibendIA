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
  customerId?: string | null;
  vehicleId?: string | null;
};

export class EstimateDraftEditingError extends Error {
  constructor(readonly code: 'ESTIMATE_DRAFT_NOT_FOUND' | 'ESTIMATE_VERSION_CONFLICT' | 'ESTIMATE_MUTATION_CONFLICT' |
    'ESTIMATE_DRAFT_NOT_EDITABLE' | 'ESTIMATE_STATUS_TRANSITION_INVALID' | 'ESTIMATE_LINE_NOT_FOUND' | 'RK_LINE_DELETE_FORBIDDEN' |
    'CUSTOMER_NOT_FOUND' | 'VEHICLE_NOT_FOUND') {
    super(code); this.name = 'EstimateDraftEditingError';
  }
}

export async function listEstimateDrafts(
  client: pg.PoolClient,
  pii?: import('../../security/pii-protection.js').PiiProtection,
): Promise<Array<any>> {
  const result = await client.query<any>(`
    SELECT d.id, d.tenant_id, d.vehicle_id, d.customer_id, d.title, d.draft_type,
           j.code repair_job_code, d.status, d.version, d.created_at, d.updated_at,
           d.vehicle_snapshot,
           d.customer_claim_ciphertext, d.customer_claim_nonce, d.customer_claim_auth_tag, d.customer_claim_key_id,
           d.vehicle_claim_ciphertext, d.vehicle_claim_nonce, d.vehicle_claim_auth_tag, d.vehicle_claim_key_id
    FROM estimate_drafts d
    LEFT JOIN repair_jobs j ON j.id=d.repair_job_id
    WHERE d.status<>'superseded'
    ORDER BY d.updated_at DESC, d.id
  `);
  return result.rows.map((row: any) => {
    let customerSnapshot: any = null;
    let vehicleSnapshot: any = row.vehicle_snapshot ?? {};
    if (pii && row.customer_claim_ciphertext) {
      try {
        customerSnapshot = JSON.parse(pii.reveal(row.tenant_id, 'draft.customer_claim', {
          ciphertext: row.customer_claim_ciphertext, nonce: row.customer_claim_nonce,
          authTag: row.customer_claim_auth_tag, keyId: row.customer_claim_key_id,
        }));
      } catch { /* ignore */ }
    }
    if (pii && row.vehicle_claim_ciphertext) {
      try {
        const vClaim = JSON.parse(pii.reveal(row.tenant_id, 'draft.vehicle_claim', {
          ciphertext: row.vehicle_claim_ciphertext, nonce: row.vehicle_claim_nonce,
          authTag: row.vehicle_claim_auth_tag, keyId: row.vehicle_claim_key_id,
        }));
        vehicleSnapshot = { ...vehicleSnapshot, ...vClaim };
      } catch { /* ignore */ }
    }
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      customerId: row.customer_id,
      title: row.title,
      draftType: row.draft_type,
      repairJobCode: row.repair_job_code,
      status: row.status,
      version: row.version,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      customerSnapshot,
      vehicleSnapshot,
    };
  });
}

export async function getEstimateDraft(
  client: pg.PoolClient,
  id: string,
  pii?: import('../../security/pii-protection.js').PiiProtection,
): Promise<EstimateDraft> {
  const draft = await loadEstimateDraft(client, id, pii);
  if (!draft) throw new EstimateDraftEditingError('ESTIMATE_DRAFT_NOT_FOUND');
  return draft;
}

export async function editEstimateDraft(
  client: pg.PoolClient,
  tenantId: string,
  id: string,
  command: EditEstimateDraftCommand,
  pii?: import('../../security/pii-protection.js').PiiProtection,
): Promise<EstimateDraft> {
  const hash = requestHash(command);
  const replay = await client.query<{ request_hash: string }>(
    'SELECT request_hash FROM estimate_draft_mutations WHERE draft_id=$1 AND idempotency_key=$2', [id, command.idempotencyKey]);
  if (replay.rowCount) {
    if (replay.rows[0].request_hash !== hash) throw new EstimateDraftEditingError('ESTIMATE_MUTATION_CONFLICT');
    return getEstimateDraft(client, id, pii);
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

  if (command.customerId !== undefined && command.customerId !== null) {
    const cCheck = await client.query('SELECT 1 FROM customers WHERE id = $1 AND tenant_id = $2', [command.customerId, tenantId]);
    if (!cCheck.rowCount) throw new EstimateDraftEditingError('CUSTOMER_NOT_FOUND');
  }

  if (command.vehicleId !== undefined && command.vehicleId !== null) {
    const vCheck = await client.query('SELECT 1 FROM vehicles WHERE id = $1 AND tenant_id = $2', [command.vehicleId, tenantId]);
    if (!vCheck.rowCount) throw new EstimateDraftEditingError('VEHICLE_NOT_FOUND');
  }

  const effectiveCustomerId = command.customerId !== undefined ? command.customerId : null;
  const effectiveVehicleId = command.vehicleId !== undefined ? command.vehicleId : null;

  if (effectiveCustomerId && effectiveVehicleId) {
    await client.query(`
      INSERT INTO customer_vehicle_roles (tenant_id, customer_id, vehicle_id, verification_status)
      VALUES ($1, $2, $3, 'verified')
      ON CONFLICT DO NOTHING
    `, [tenantId, effectiveCustomerId, effectiveVehicleId]);
  } else if (effectiveCustomerId) {
    const draftRow = await client.query<{ vehicle_id: string | null }>('SELECT vehicle_id FROM estimate_drafts WHERE id = $1', [id]);
    const vId = draftRow.rows[0]?.vehicle_id;
    if (vId) {
      await client.query(`
        INSERT INTO customer_vehicle_roles (tenant_id, customer_id, vehicle_id, verification_status)
        VALUES ($1, $2, $3, 'verified')
        ON CONFLICT DO NOTHING
      `, [tenantId, effectiveCustomerId, vId]);
    }
  } else if (effectiveVehicleId) {
    const draftRow = await client.query<{ customer_id: string | null }>('SELECT customer_id FROM estimate_drafts WHERE id = $1', [id]);
    const cId = draftRow.rows[0]?.customer_id;
    if (cId) {
      await client.query(`
        INSERT INTO customer_vehicle_roles (tenant_id, customer_id, vehicle_id, verification_status)
        VALUES ($1, $2, $3, 'verified')
        ON CONFLICT DO NOTHING
      `, [tenantId, cId, effectiveVehicleId]);
    }
  }

  const nextVersion = current.version + 1;
  await client.query(`
    UPDATE estimate_drafts
    SET status = COALESCE($2, status),
        customer_id = CASE WHEN $4::boolean THEN $5 ELSE customer_id END,
        vehicle_id = CASE WHEN $6::boolean THEN $7 ELSE vehicle_id END,
        version = $3,
        updated_at = now()
    WHERE id = $1
  `, [
    id,
    command.status ?? null,
    nextVersion,
    command.customerId !== undefined,
    command.customerId ?? null,
    command.vehicleId !== undefined,
    command.vehicleId ?? null,
  ]);
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
