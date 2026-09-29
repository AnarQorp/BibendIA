-- RK04: minimal tenant-owned quote editing. Migration 014 remains reserved.
ALTER TABLE estimate_drafts
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE estimate_drafts DROP CONSTRAINT estimate_drafts_status_check;
ALTER TABLE estimate_drafts ADD CONSTRAINT estimate_drafts_status_check
  CHECK (status IN ('technical_draft','pending_approval','sent','approved','superseded'));

ALTER TABLE estimate_draft_lines
  ALTER COLUMN repair_bom_edge_id DROP NOT NULL,
  ADD COLUMN description text,
  ADD COLUMN line_source text NOT NULL DEFAULT 'REPAIR_KNOWLEDGE'
    CHECK (line_source IN ('REPAIR_KNOWLEDGE','MANUAL_WORKSHOP')),
  ADD COLUMN pricing_provenance text,
  ADD COLUMN mutation_key text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT estimate_draft_lines_source_integrity CHECK (
    (line_source='REPAIR_KNOWLEDGE' AND repair_bom_edge_id IS NOT NULL) OR
    (line_source='MANUAL_WORKSHOP' AND repair_bom_edge_id IS NULL)
  ),
  ADD CONSTRAINT estimate_draft_lines_pricing_provenance CHECK (
    (pricing_status='PENDING' AND unit_price IS NULL AND pricing_provenance IS NULL) OR
    (pricing_status='MANUALLY_PRICED' AND unit_price IS NOT NULL AND pricing_provenance='MANUAL_WORKSHOP')
  ),
  ADD CONSTRAINT estimate_draft_lines_manual_mutation UNIQUE(tenant_id,draft_id,mutation_key);

ALTER TABLE estimate_draft_lines DROP CONSTRAINT estimate_draft_lines_item_type_check;
ALTER TABLE estimate_draft_lines ADD CONSTRAINT estimate_draft_lines_item_type_check
  CHECK(item_type IN ('PART_ROLE','CONSUMABLE','LABOR'));

UPDATE estimate_draft_lines SET description=part_role_name WHERE description IS NULL;
ALTER TABLE estimate_draft_lines ALTER COLUMN description SET NOT NULL;
GRANT DELETE ON estimate_draft_lines TO bibendia_api;

CREATE TABLE estimate_draft_mutations (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  draft_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,draft_id,idempotency_key),
  FOREIGN KEY(tenant_id,draft_id) REFERENCES estimate_drafts(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE estimate_draft_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_draft_mutations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON estimate_draft_mutations
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON estimate_draft_mutations TO bibendia_api;

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql'),('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql'),('019_estimate_draft_editing.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '019_estimate_draft_editing.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
