-- VS02.2 gap closure: appointment acquisition may carry a provisional identity claim without
-- granting authority over any existing customer or vehicle record.

ALTER TABLE customer_vehicle_roles
  ADD COLUMN verification_status text NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('verified','provisional'));

ALTER TABLE appointments
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN vehicle_id DROP NOT NULL,
  ADD COLUMN identity_resolution_status text NOT NULL DEFAULT 'verified'
    CHECK (identity_resolution_status IN ('verified','provisional_new','provisional_ambiguous')),
  ADD COLUMN identity_claim_ciphertext bytea,
  ADD COLUMN identity_claim_nonce bytea,
  ADD COLUMN identity_claim_auth_tag bytea,
  ADD COLUMN identity_claim_key_id text,
  ADD CONSTRAINT appointments_identity_resolution_complete CHECK (
    (identity_resolution_status='verified'
      AND customer_id IS NOT NULL AND vehicle_id IS NOT NULL
      AND identity_claim_ciphertext IS NULL AND identity_claim_nonce IS NULL
      AND identity_claim_auth_tag IS NULL AND identity_claim_key_id IS NULL)
    OR
    (identity_resolution_status='provisional_new'
      AND customer_id IS NOT NULL AND vehicle_id IS NOT NULL
      AND identity_claim_ciphertext IS NULL AND identity_claim_nonce IS NULL
      AND identity_claim_auth_tag IS NULL AND identity_claim_key_id IS NULL)
    OR
    (identity_resolution_status='provisional_ambiguous'
      AND customer_id IS NULL AND vehicle_id IS NULL
      AND identity_claim_ciphertext IS NOT NULL AND identity_claim_nonce IS NOT NULL
      AND identity_claim_auth_tag IS NOT NULL AND identity_claim_key_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text, compatible boolean, missing_migrations integer, unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH expected(name) AS (VALUES
    ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),
    ('004_tenant_authorization.sql'),('005_provider_ingress_security.sql'),
    ('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
    ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),
    ('010_real_scheduling_acquisition.sql'),('011_provisional_identity_acquisition.sql')
  ), counts AS (
    SELECT
      (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int AS missing,
      (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int AS unknown
  )
  SELECT '011_provisional_identity_acquisition.sql'::text, missing=0 AND unknown=0, missing, unknown FROM counts
$$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api, bibendia_worker;
