-- VS02.1: PostgreSQL is the authority for basic single-lane workshop availability.
CREATE TABLE slot_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  candidate_token text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  capacity_requirements jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  held_at timestamptz,
  hold_id uuid,
  CHECK (end_at > start_at),
  UNIQUE (tenant_id,candidate_token),
  UNIQUE (tenant_id,workshop_id,start_at,end_at,duration_minutes)
);

ALTER TABLE slot_holds
  ADD COLUMN consumed_at timestamptz,
  ADD COLUMN consumed_by_appointment_id uuid,
  ADD CONSTRAINT slot_holds_tenant_id_id_key UNIQUE (tenant_id,id),
  ADD CONSTRAINT slot_holds_consumed_appointment_fk
    FOREIGN KEY (tenant_id,consumed_by_appointment_id) REFERENCES appointments(tenant_id,id),
  ADD CONSTRAINT slot_holds_valid_interval CHECK (end_at > start_at),
  ADD CONSTRAINT slot_holds_consumption_complete CHECK (
    (consumed_at IS NULL AND consumed_by_appointment_id IS NULL) OR
    (consumed_at IS NOT NULL AND consumed_by_appointment_id IS NOT NULL)
  );

ALTER TABLE slot_candidates
  ADD CONSTRAINT slot_candidates_hold_fk
    FOREIGN KEY (tenant_id,hold_id) REFERENCES slot_holds(tenant_id,id);

CREATE INDEX slot_candidates_expiry ON slot_candidates(tenant_id,workshop_id,expires_at);
CREATE INDEX slot_holds_availability ON slot_holds(tenant_id,workshop_id,start_at,end_at,expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX appointments_availability ON appointments(tenant_id,workshop_id,start_at,end_at)
  WHERE status <> 'cancelled';

ALTER TABLE slot_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_candidates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON slot_candidates
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE slot_candidates OWNER TO bibendia_migrator;
GRANT SELECT,INSERT,UPDATE,DELETE ON slot_candidates TO bibendia_api;

-- Keep P0.8 readiness exact: artifact and schema must move together.
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
    ('010_real_scheduling_acquisition.sql')
  ), counts AS (
    SELECT
      (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int AS missing,
      (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int AS unknown
  )
  SELECT '010_real_scheduling_acquisition.sql'::text, missing=0 AND unknown=0, missing, unknown FROM counts
$$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api, bibendia_worker;
