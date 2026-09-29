-- Product API contract for RK01/RK02. Migration 014 remains reserved for Suppliers.
-- Pricing columns deliberately start NULL: Repair Knowledge is not pricing authority.
ALTER TABLE estimate_draft_lines
  ADD COLUMN unit_price numeric(12,2),
  ADD COLUMN currency char(3),
  ADD COLUMN pricing_status text NOT NULL DEFAULT 'PENDING'
    CHECK (pricing_status IN ('PENDING','MANUALLY_PRICED')),
  ADD CONSTRAINT estimate_draft_lines_price_pair CHECK (
    (unit_price IS NULL AND currency IS NULL AND pricing_status='PENDING') OR
    (unit_price IS NOT NULL AND unit_price>=0 AND currency IS NOT NULL AND pricing_status='MANUALLY_PRICED')
  );

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql'),('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '018_repair_knowledge_api.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
