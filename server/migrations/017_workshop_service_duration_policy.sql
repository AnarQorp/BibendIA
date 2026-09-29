-- Workshop-owned duration policy. Migration 014 remains reserved for Suppliers.
ALTER TABLE workshops
  ADD COLUMN service_duration_policy jsonb NOT NULL DEFAULT
    '{"version":"v1","rules":{},"fallbackMinutes":null}'::jsonb;

ALTER TABLE slot_candidates
  ADD COLUMN service_intent text,
  ADD COLUMN duration_policy_source text NOT NULL DEFAULT 'legacy_client_supplied';

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid='slot_candidates'::regclass AND contype='u'
    AND pg_get_constraintdef(oid) LIKE 'UNIQUE (tenant_id, workshop_id, start_at, end_at, duration_minutes)%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE slot_candidates DROP CONSTRAINT %I',constraint_name);
  END IF;
END $$;
ALTER TABLE slot_candidates ADD CONSTRAINT slot_candidates_offer_identity
  UNIQUE NULLS NOT DISTINCT (tenant_id,workshop_id,start_at,end_at,duration_minutes,service_intent);

ALTER TABLE slot_holds
  ADD COLUMN duration_minutes integer,
  ADD COLUMN service_intent text,
  ADD COLUMN duration_policy_source text NOT NULL DEFAULT 'legacy_client_supplied',
  ADD CONSTRAINT slot_holds_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 480);

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('017_workshop_service_duration_policy.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '017_workshop_service_duration_policy.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
