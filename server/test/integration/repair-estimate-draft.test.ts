import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EstimateDraftError, createEstimateDraftFromRepairKnowledge } from '../../src/modules/repair-knowledge/estimate-draft.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

const fixture = createPool('migrator');
const apiPool = createPool('api');
const pii = testPiiProtection();
const ids = { tenantA: randomUUID(), tenantB: randomUUID(), vehicleA: randomUUID(), vehicleB: randomUUID() };
const command = (key: string, engineCode = 'CLHA') => ({ tenantId: ids.tenantA, vehicleId: ids.vehicleA, idempotencyKey: key,
  vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode }, repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP' });

beforeAll(async () => {
  await fixture.query("INSERT INTO tenants(id,name) VALUES($1,'RK02 A'),($2,'RK02 B')", [ids.tenantA, ids.tenantB]);
  await inTenantTransaction(fixture, ids.tenantA, (client) => insertProtectedVehicle(client, pii,
    { id: ids.vehicleA, tenantId: ids.tenantA, plate: '1111 RKA', make: 'Volkswagen', model: 'Golf VII' }));
  await inTenantTransaction(fixture, ids.tenantB, (client) => insertProtectedVehicle(client, pii,
    { id: ids.vehicleB, tenantId: ids.tenantB, plate: '2222 RKB', make: 'Volkswagen', model: 'Golf VII' }));
});

afterAll(async () => {
  await fixture.query('DELETE FROM estimate_draft_lines WHERE tenant_id=ANY($1)', [[ids.tenantA, ids.tenantB]]);
  await fixture.query('DELETE FROM estimate_drafts WHERE tenant_id=ANY($1)', [[ids.tenantA, ids.tenantB]]);
  await fixture.query('DELETE FROM vehicles WHERE tenant_id=ANY($1)', [[ids.tenantA, ids.tenantB]]);
  await fixture.query('DELETE FROM tenants WHERE id=ANY($1)', [[ids.tenantA, ids.tenantB]]);
  await apiPool.end(); await fixture.end();
});

describe('RK02 PostgreSQL estimate draft', () => {
  it('persists the CLHA timing draft with correctly classified, traceable lines', async () => {
    const draft = await createEstimateDraftFromRepairKnowledge(apiPool, command('rk02-clha-timing-001'));
    expect(draft.lines).toHaveLength(6);
    expect(draft.knowledgeRevision).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(draft.lines.find((line) => line.edgeCode === 'EDGE_GOLF7_CLHA_TB_001')).toMatchObject({
      requirementType: 'REQUIRED', confidenceState: 'MULTI_SOURCE_VERIFIED', automationStatus: 'AUTO_INCLUDED', selected: true, reviewRequired: false,
    });
    expect(draft.lines.find((line) => line.edgeCode === 'EDGE_GOLF7_CLHA_TB_004')).toMatchObject({
      requirementType: 'RECOMMENDED', automationStatus: 'OPTIONAL', selected: false,
    });
    expect(draft.lines.find((line) => line.edgeCode === 'EDGE_GOLF7_CLHA_TB_006')).toMatchObject({
      requirementType: 'CONDITIONAL', automationStatus: 'REVIEW_REQUIRED', reviewRequired: true,
    });
    expect(draft.lines.find((line) => line.edgeCode === 'EDGE_GOLF7_CLHA_TB_003')).toMatchObject({
      confidenceState: 'DERIVED_FROM_KIT', automationStatus: 'BLOCKED', selected: false,
    });
    const oem = draft.lines.find((line) => line.edgeCode === 'EDGE_GOLF7_CLHA_TB_005')!;
    expect(oem).toMatchObject({ replaceOnce: true, confidenceState: 'VERIFIED_OEM', automationStatus: 'AUTO_INCLUDED' });
    expect(oem.repairBomEdgeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(oem.evidence[0]).toMatchObject({ confidenceState: 'VERIFIED_OEM', reference: 'https://www.elring.com/tech-data' });
  });

  it('replays the same idempotency key without duplicating draft or lines', async () => {
    const first = await createEstimateDraftFromRepairKnowledge(apiPool, command('rk02-clha-retry-001'));
    const replay = await createEstimateDraftFromRepairKnowledge(apiPool, command('rk02-clha-retry-001'));
    expect(replay.id).toBe(first.id);
    const counts = await fixture.query(`SELECT (SELECT count(*)::int FROM estimate_drafts WHERE tenant_id=$1 AND idempotency_key=$2) drafts,
      (SELECT count(*)::int FROM estimate_draft_lines WHERE tenant_id=$1 AND draft_id=$3) lines`, [ids.tenantA, 'rk02-clha-retry-001', first.id]);
    expect(counts.rows[0]).toEqual({ drafts: 1, lines: 6 });
  });

  it('rejects reuse of an idempotency key for a different operation', async () => {
    const key = 'rk02-conflict-001';
    await createEstimateDraftFromRepairKnowledge(apiPool, command(key));
    await expect(createEstimateDraftFromRepairKnowledge(apiPool, { ...command(key), repairJobCode: 'JOB_BRAKE_DISCS_PADS_FRONT' }))
      .rejects.toEqual(expect.objectContaining<Partial<EstimateDraftError>>({ code: 'IDEMPOTENCY_CONFLICT' }));
  });

  it('keeps drafts tenant-isolated under RLS', async () => {
    const draft = await createEstimateDraftFromRepairKnowledge(apiPool, command('rk02-clha-rls-001'));
    const visible = await inTenantTransaction(apiPool, ids.tenantB, (client) => client.query('SELECT id FROM estimate_drafts WHERE id=$1', [draft.id]));
    expect(visible.rowCount).toBe(0);
  });

  it('does not create a draft for an incompatible engine', async () => {
    await expect(createEstimateDraftFromRepairKnowledge(apiPool, command('rk02-incompatible-001', 'CRMB')))
      .rejects.toEqual(expect.objectContaining<Partial<EstimateDraftError>>({ code: 'REPAIR_KNOWLEDGE_NOT_APPLICABLE' }));
    expect((await fixture.query('SELECT count(*)::int n FROM estimate_drafts WHERE idempotency_key=$1', ['rk02-incompatible-001'])).rows[0].n).toBe(0);
  });

  it('blocks a verified edge when its evidence is missing', async () => {
    await fixture.query("DELETE FROM repair_bom_evidence WHERE edge_id=(SELECT id FROM repair_bom_edges WHERE code='EDGE_GOLF7_CLHA_TB_005')");
    const draft = await createEstimateDraftFromRepairKnowledge(apiPool, command('rk02-no-evidence-001'));
    expect(draft.lines.find((line) => line.edgeCode === 'EDGE_GOLF7_CLHA_TB_005')).toMatchObject({
      automationStatus: 'BLOCKED', selected: false, reviewRequired: true, confidenceReason: 'EVIDENCE_REQUIRED',
    });
    await fixture.query('SET ROLE bibendia_migrator'); await fixture.query('SELECT seed_repair_knowledge_poc_v1()'); await fixture.query('RESET ROLE');
  });
});
