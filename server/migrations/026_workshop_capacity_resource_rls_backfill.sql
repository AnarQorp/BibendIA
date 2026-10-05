-- 026: repair the historical resource-requirements backfill while preserving FORCE RLS.
DO $$
DECLARE
  tenant record;
  previous_tenant text := current_setting('app.tenant_id', true);
  placeholder jsonb := '{"rules":{},"fallback":null}'::jsonb;
  canonical_resources jsonb := '{
    "rules": {
      "inspection": {"mechanic":1,"lift":0,"genericBay":1},
      "oil_service": {"mechanic":1,"lift":1,"genericBay":0},
      "brakes_or_noise": {"mechanic":1,"lift":1,"genericBay":0},
      "generic_fault": {"mechanic":1,"lift":0,"genericBay":1}
    },
    "fallback": {"mechanic":1,"lift":0,"genericBay":1}
  }'::jsonb;
BEGIN
  -- bibendia_migrator can discover tenant ids, but workshops remain protected by
  -- FORCE RLS. Select each tenant explicitly and update only inside its context.
  FOR tenant IN SELECT id FROM tenants ORDER BY id LOOP
    PERFORM set_config('app.tenant_id', tenant.id::text, true);
    UPDATE workshops
    SET capacity_policy = jsonb_set(
      capacity_policy,
      '{resourceRequirements}',
      canonical_resources,
      true
    )
    WHERE tenant_id = tenant.id
      AND capacity_policy->'resourceRequirements' = placeholder;
  END LOOP;

  PERFORM set_config('app.tenant_id', coalesce(previous_tenant, ''), true);
END $$;

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql'),('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql'),('019_estimate_draft_editing.sql'),('020_vehicle_catalog_foundation.sql'),
 ('021_vehicle_catalog_vehiclesdb_2026_09_1.sql'),('022_manual_operations_foundation.sql'),
 ('023_reception_case_foundation.sql'),('024_workshop_capacity_scheduling_v1.sql'),
 ('025_workshop_capacity_resource_bootstrap.sql'),('026_workshop_capacity_resource_rls_backfill.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '026_workshop_capacity_resource_rls_backfill.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
