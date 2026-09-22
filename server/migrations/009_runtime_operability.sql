-- P0.8: least-privilege schema compatibility probe for API and Worker readiness.
CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text, compatible boolean, missing_migrations integer, unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH expected(name) AS (VALUES
    ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),
    ('004_tenant_authorization.sql'),('005_provider_ingress_security.sql'),
    ('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
    ('008_outbox_reliability.sql'),('009_runtime_operability.sql')
  ), counts AS (
    SELECT
      (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int AS missing,
      (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int AS unknown
  )
  SELECT '009_runtime_operability.sql'::text, missing=0 AND unknown=0, missing, unknown FROM counts
$$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api, bibendia_worker;
