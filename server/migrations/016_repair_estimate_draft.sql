-- RK02 tenant-owned technical estimate drafts derived from global RK01 knowledge.
CREATE TABLE estimate_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vehicle_id uuid NOT NULL,
  repair_job_id uuid NOT NULL REFERENCES repair_jobs(id),
  applicability_id uuid NOT NULL REFERENCES repair_vehicle_applicabilities(id),
  status text NOT NULL DEFAULT 'technical_draft' CHECK(status IN ('technical_draft','superseded')),
  idempotency_key text NOT NULL,
  knowledge_revision text NOT NULL,
  vehicle_snapshot jsonb NOT NULL,
  repair_job_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(tenant_id,vehicle_id) REFERENCES vehicles(tenant_id,id)
);

CREATE TABLE estimate_draft_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  draft_id uuid NOT NULL,
  repair_bom_edge_id uuid NOT NULL REFERENCES repair_bom_edges(id),
  item_type text NOT NULL CHECK(item_type IN ('PART_ROLE','CONSUMABLE')),
  part_role_code text NOT NULL,
  part_role_name text NOT NULL,
  quantity numeric(10,3) CHECK(quantity IS NULL OR quantity>0),
  requirement_type text NOT NULL CHECK(requirement_type IN ('REQUIRED','RECOMMENDED','CONDITIONAL','OPTIONAL')),
  replace_once boolean NOT NULL,
  condition text,
  confidence_state text NOT NULL CHECK(confidence_state IN ('VERIFIED_OEM','VERIFIED_MANUFACTURER','MULTI_SOURCE_VERIFIED','DERIVED_FROM_KIT','COMMUNITY_SUPPORTED','INFERRED','UNKNOWN')),
  automation_status text NOT NULL CHECK(automation_status IN ('AUTO_INCLUDED','REVIEW_REQUIRED','OPTIONAL','BLOCKED')),
  review_required boolean NOT NULL,
  selected boolean NOT NULL,
  confidence_reason text NOT NULL,
  evidence_snapshot jsonb NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,draft_id,repair_bom_edge_id),
  FOREIGN KEY(tenant_id,draft_id) REFERENCES estimate_drafts(tenant_id,id) ON DELETE CASCADE
);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['estimate_drafts','estimate_draft_lines'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON estimate_drafts,estimate_draft_lines TO bibendia_api;

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '016_repair_estimate_draft.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
