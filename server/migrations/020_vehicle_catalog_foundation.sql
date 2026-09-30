-- RK06: versioned global vehicle catalog. Technical applicability remains authoritative in Repair Knowledge.
CREATE TABLE vehicle_catalog_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  dataset_version text NOT NULL,
  schema_version text,
  artifact_name text NOT NULL,
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_url text NOT NULL,
  source_url text NOT NULL,
  license_spdx text NOT NULL,
  attribution text NOT NULL,
  attribution_url text NOT NULL,
  attribution_sha256 text NOT NULL CHECK (attribution_sha256 ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT false,
  UNIQUE(provider,dataset_version),
  UNIQUE(provider,dataset_version,artifact_sha256)
);
CREATE UNIQUE INDEX vehicle_catalog_one_active_source ON vehicle_catalog_sources(provider) WHERE active;

CREATE TABLE vehicle_catalog_makes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES vehicle_catalog_sources(id) ON DELETE CASCADE,
  source_make_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('car','van')),
  name text NOT NULL,
  slug text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  UNIQUE(source_id,kind,source_make_id),
  UNIQUE(source_id,kind,slug)
);

CREATE TABLE vehicle_catalog_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES vehicle_catalog_sources(id) ON DELETE CASCADE,
  make_id uuid NOT NULL REFERENCES vehicle_catalog_makes(id) ON DELETE CASCADE,
  source_model_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('car','van')),
  name text NOT NULL,
  slug text NOT NULL,
  body_types text[] NOT NULL DEFAULT '{}',
  aliases text[] NOT NULL DEFAULT '{}',
  former_source_ids text[] NOT NULL DEFAULT '{}',
  global_popularity_decile integer CHECK (global_popularity_decile BETWEEN 1 AND 10),
  UNIQUE(source_id,kind,source_model_id),
  UNIQUE(source_id,kind,make_id,slug)
);

CREATE TABLE vehicle_catalog_availability (
  source_id uuid NOT NULL REFERENCES vehicle_catalog_sources(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES vehicle_catalog_models(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  evidence_type text NOT NULL,
  source_ref text NOT NULL,
  PRIMARY KEY(source_id,model_id,country_code,source_ref)
);

CREATE TABLE vehicle_catalog_rk_model_links (
  source_id uuid NOT NULL REFERENCES vehicle_catalog_sources(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES vehicle_catalog_models(id) ON DELETE CASCADE,
  rk_make text NOT NULL,
  rk_model text NOT NULL,
  link_method text NOT NULL CHECK (link_method IN ('EXPLICIT_REVIEWED')),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id,model_id,rk_make,rk_model)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['vehicle_catalog_sources','vehicle_catalog_makes','vehicle_catalog_models',
    'vehicle_catalog_availability','vehicle_catalog_rk_model_links'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY global_vehicle_catalog_read ON %I FOR SELECT TO bibendia_api USING (true)',t);
    EXECUTE format('CREATE POLICY vehicle_catalog_migrator_write ON %I FOR ALL TO bibendia_migrator USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;
GRANT SELECT ON vehicle_catalog_sources,vehicle_catalog_makes,vehicle_catalog_models,
  vehicle_catalog_availability,vehicle_catalog_rk_model_links TO bibendia_api;

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql'),('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql'),('019_estimate_draft_editing.sql'),('020_vehicle_catalog_foundation.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '020_vehicle_catalog_foundation.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
