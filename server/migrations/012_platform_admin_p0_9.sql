-- P0.9: narrow, capability-authorized platform administration without privileged SQL access.

ALTER TABLE tenants ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE workshops ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE channel_endpoints ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE tenant_memberships ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE platform_access_grants ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE provider_bindings ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN version integer NOT NULL DEFAULT 1;

CREATE TABLE platform_command_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  operation text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  before_jsonb jsonb,
  after_jsonb jsonb NOT NULL,
  correlation_id text NOT NULL,
  evidence_ref text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_id,idempotency_key),
  CHECK (before_jsonb IS NULL OR jsonb_typeof(before_jsonb)='object'),
  CHECK (jsonb_typeof(after_jsonb)='object')
);

ALTER TABLE platform_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_command_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform_command_receipts
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY platform_create_receipt_replay ON platform_command_receipts FOR SELECT
  USING (actor_id=current_setting('app.principal_id',true)
    AND current_setting('app.authorized_capability',true)='platform:tenant:create');

CREATE POLICY platform_admin_tenants ON tenants
  USING (current_setting('app.authorized_capability',true) IN ('platform:tenant:read','platform:tenant:create')
    AND (current_setting('app.platform_global',true)='true'
      OR id=ANY(string_to_array(nullif(current_setting('app.platform_tenant_ids',true),''),',')::uuid[])))
  WITH CHECK (current_setting('app.authorized_capability',true)='platform:tenant:create'
    AND current_setting('app.platform_global',true)='true');

-- Authorization code sets this transaction-local value only after resolving an active DB grant.
CREATE POLICY platform_admin_memberships ON tenant_memberships
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND current_setting('app.authorized_capability',true)='platform:memberships:manage')
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND current_setting('app.authorized_capability',true)='platform:memberships:manage');
CREATE POLICY platform_admin_grants ON platform_access_grants
  USING ((scope_type='global' OR tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
    AND current_setting('app.authorized_capability',true)='platform:memberships:manage')
  WITH CHECK ((scope_type='global' OR tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
    AND current_setting('app.authorized_capability',true)='platform:memberships:manage');
CREATE POLICY platform_admin_integrations ON service_principals
  USING (current_setting('app.authorized_capability',true) IN ('platform:configuration:read','platform:configuration:update'))
  WITH CHECK (current_setting('app.authorized_capability',true)='platform:configuration:update');
CREATE POLICY platform_admin_bindings ON provider_bindings
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND current_setting('app.authorized_capability',true) IN ('platform:configuration:read','platform:configuration:update'))
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND current_setting('app.authorized_capability',true)='platform:configuration:update');

GRANT SELECT,INSERT,UPDATE ON tenant_memberships,platform_access_grants,service_principals,provider_bindings TO bibendia_api;
GRANT SELECT,INSERT ON platform_command_receipts TO bibendia_api;
GRANT USAGE,SELECT ON SEQUENCE audit_events_id_seq,outbox_events_id_seq TO bibendia_api;
GRANT INSERT,UPDATE ON workshops,channel_endpoints TO bibendia_api;
GRANT INSERT ON audit_events,outbox_events TO bibendia_api;
GRANT INSERT,UPDATE ON tenants TO bibendia_api;

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text, compatible boolean, missing_migrations integer, unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  WITH expected(name) AS (VALUES
    ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),
    ('004_tenant_authorization.sql'),('005_provider_ingress_security.sql'),
    ('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
    ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),
    ('010_real_scheduling_acquisition.sql'),('011_provisional_identity_acquisition.sql'),
    ('012_platform_admin_p0_9.sql')
  ), counts AS (
    SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
      (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
  ) SELECT '012_platform_admin_p0_9.sql',missing=0 AND unknown=0,missing,unknown FROM counts
$$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
