-- Public lead acquisition: authoritative encrypted persistence and asynchronous notification intent.
CREATE TABLE public_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workshop_ciphertext bytea NOT NULL, workshop_nonce bytea NOT NULL, workshop_auth_tag bytea NOT NULL, workshop_key_id text NOT NULL,
  contact_name_ciphertext bytea NOT NULL, contact_name_nonce bytea NOT NULL, contact_name_auth_tag bytea NOT NULL, contact_name_key_id text NOT NULL,
  phone_ciphertext bytea NOT NULL, phone_nonce bytea NOT NULL, phone_auth_tag bytea NOT NULL, phone_key_id text NOT NULL,
  email_ciphertext bytea, email_nonce bytea, email_auth_tag bytea, email_key_id text,
  message_ciphertext bytea, message_nonce bytea, message_auth_tag bytea, message_key_id text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed','discarded')),
  correlation_id text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  request_key_hash text,
  dedup_fingerprint text NOT NULL,
  dedupe_window_start timestamptz NOT NULL,
  client_fingerprint text NOT NULL,
  retention_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,request_key_hash), UNIQUE(tenant_id,dedup_fingerprint,dedupe_window_start),
  CHECK ((email_ciphertext IS NULL)=(email_nonce IS NULL) AND (email_nonce IS NULL)=(email_auth_tag IS NULL) AND (email_auth_tag IS NULL)=(email_key_id IS NULL)),
  CHECK ((message_ciphertext IS NULL)=(message_nonce IS NULL) AND (message_nonce IS NULL)=(message_auth_tag IS NULL) AND (message_auth_tag IS NULL)=(message_key_id IS NULL))
);
CREATE TABLE public_lead_rate_limits (
  tenant_id uuid NOT NULL REFERENCES tenants(id), client_fingerprint text NOT NULL,
  window_start timestamptz NOT NULL, accepted_count integer NOT NULL DEFAULT 0 CHECK(accepted_count>=0),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,client_fingerprint,window_start)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['public_leads','public_lead_rate_limits'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON public_leads,public_lead_rate_limits TO bibendia_api;
GRANT SELECT ON public_leads TO bibendia_worker;

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '013_public_lead_acquisition.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
