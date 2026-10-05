-- 024: extend the canonical Workshop and Appointment authorities for capacity-aware scheduling.
ALTER TABLE workshops
  ADD COLUMN capacity_policy jsonb NOT NULL DEFAULT
    '{"version":"v1","liftCount":null,"nonLiftBayCount":null,"concurrentTechnicians":null,"maxVehiclesOnSite":null,"maxVehicleIntakesPerHour":null,"resourceRequirements":{"rules":{},"fallback":null}}'::jsonb,
  ADD CONSTRAINT workshops_capacity_policy_object CHECK (jsonb_typeof(capacity_policy)='object');

ALTER TABLE appointments
  ADD COLUMN customer_wait_mode text NOT NULL DEFAULT 'DROP_OFF'
    CHECK (customer_wait_mode IN ('DROP_OFF','WAIT_ON_SITE'));

ALTER TABLE appointments ADD CONSTRAINT appointments_status_lifecycle_check CHECK (
  status IN ('tentative','held','confirmed','awaiting_arrival','on_site','in_progress','waiting','completed','delivered','cancelled')
);

CREATE INDEX appointments_currently_on_site
  ON appointments(tenant_id,workshop_id,status,vehicle_id)
  WHERE status IN ('on_site','in_progress','waiting','completed');

CREATE TABLE workshop_command_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  operation text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  before_jsonb jsonb,
  after_jsonb jsonb NOT NULL,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,actor_id,idempotency_key)
);
ALTER TABLE workshop_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_command_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workshop_command_receipts
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workshop_command_receipts OWNER TO bibendia_migrator;
GRANT SELECT,INSERT ON workshop_command_receipts TO bibendia_api;

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
 ('023_reception_case_foundation.sql'),('024_workshop_capacity_scheduling_v1.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '024_workshop_capacity_scheduling_v1.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
