-- 022: Manual Operations Foundation
-- Enables manual workshop workflows without requiring pre-existing entities or RK dependencies,
-- while preserving strict cryptographic PII protection, tenant RLS, and RK provenance integrity.

-- 1. Flexibilize estimate_drafts for manual workshop operation
ALTER TABLE estimate_drafts
  ALTER COLUMN vehicle_id DROP NOT NULL,
  ALTER COLUMN repair_job_id DROP NOT NULL,
  ALTER COLUMN applicability_id DROP NOT NULL,
  ALTER COLUMN knowledge_revision DROP NOT NULL,
  ALTER COLUMN vehicle_snapshot SET DEFAULT '{}'::jsonb,
  ALTER COLUMN repair_job_snapshot SET DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS draft_type text NOT NULL DEFAULT 'REPAIR_KNOWLEDGE'
    CHECK (draft_type IN ('REPAIR_KNOWLEDGE', 'MANUAL_WORKSHOP')),
  ADD COLUMN IF NOT EXISTS customer_claim_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS customer_claim_nonce bytea,
  ADD COLUMN IF NOT EXISTS customer_claim_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS customer_claim_key_id text,
  ADD COLUMN IF NOT EXISTS vehicle_claim_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS vehicle_claim_nonce bytea,
  ADD COLUMN IF NOT EXISTS vehicle_claim_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS vehicle_claim_key_id text;

ALTER TABLE estimate_drafts ADD CONSTRAINT estimate_drafts_customer_claim_check CHECK (
  (customer_claim_ciphertext IS NULL AND customer_claim_nonce IS NULL AND customer_claim_auth_tag IS NULL AND customer_claim_key_id IS NULL)
  OR
  (customer_claim_ciphertext IS NOT NULL AND customer_claim_nonce IS NOT NULL AND customer_claim_auth_tag IS NOT NULL AND customer_claim_key_id IS NOT NULL)
);

ALTER TABLE estimate_drafts ADD CONSTRAINT estimate_drafts_vehicle_claim_check CHECK (
  (vehicle_claim_ciphertext IS NULL AND vehicle_claim_nonce IS NULL AND vehicle_claim_auth_tag IS NULL AND vehicle_claim_key_id IS NULL)
  OR
  (vehicle_claim_ciphertext IS NOT NULL AND vehicle_claim_nonce IS NOT NULL AND vehicle_claim_auth_tag IS NOT NULL AND vehicle_claim_key_id IS NOT NULL)
);

ALTER TABLE estimate_drafts ADD CONSTRAINT estimate_drafts_type_integrity CHECK (
  (draft_type = 'REPAIR_KNOWLEDGE' AND repair_job_id IS NOT NULL AND applicability_id IS NOT NULL)
  OR
  (draft_type = 'MANUAL_WORKSHOP')
);

-- 2. Flexibilize vehicles for manual workshop registration (optional plate, protected VIN, year)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS year integer CHECK (year BETWEEN 1900 AND 2100),
  ADD COLUMN IF NOT EXISTS vin_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS vin_nonce bytea,
  ADD COLUMN IF NOT EXISTS vin_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS vin_key_id text,
  ADD COLUMN IF NOT EXISTS vin_lookup_digest text,
  ADD COLUMN IF NOT EXISTS vin_lookup_key_id text;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_protected_plate_complete;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_protected_plate_complete CHECK (
  (pii_migration_state='legacy_review_required' AND plate_legacy_value IS NOT NULL)
  OR
  (pii_migration_state='protected' AND plate_legacy_value IS NULL AND plate_legacy_hash IS NULL
    AND (
      (plate_ciphertext IS NOT NULL AND plate_nonce IS NOT NULL AND plate_auth_tag IS NOT NULL
        AND plate_key_id IS NOT NULL AND plate_lookup_digest IS NOT NULL AND plate_lookup_key_id IS NOT NULL)
      OR
      (plate_ciphertext IS NULL AND plate_nonce IS NULL AND plate_auth_tag IS NULL
        AND plate_key_id IS NULL AND plate_lookup_digest IS NULL AND plate_lookup_key_id IS NULL)
    ))
);

ALTER TABLE vehicles ADD CONSTRAINT vehicles_protected_vin_complete CHECK (
  (vin_ciphertext IS NULL AND vin_nonce IS NULL AND vin_auth_tag IS NULL AND vin_key_id IS NULL AND vin_lookup_digest IS NULL AND vin_lookup_key_id IS NULL)
  OR
  (vin_ciphertext IS NOT NULL AND vin_nonce IS NOT NULL AND vin_auth_tag IS NOT NULL AND vin_key_id IS NOT NULL AND vin_lookup_digest IS NOT NULL AND vin_lookup_key_id IS NOT NULL)
);

ALTER TABLE vehicles ADD CONSTRAINT vehicles_min_identity_check CHECK (
  (pii_migration_state = 'legacy_review_required' AND plate_legacy_value IS NOT NULL)
  OR
  (pii_migration_state = 'protected' AND (
    plate_ciphertext IS NOT NULL OR vin_ciphertext IS NOT NULL OR (make IS NOT NULL AND model IS NOT NULL)
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_tenant_vin_lookup_unique
  ON vehicles(tenant_id, vin_lookup_key_id, vin_lookup_digest)
  WHERE pii_migration_state='protected' AND vin_lookup_digest IS NOT NULL;

-- 3. Extend customers with protected email and notes
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS email_nonce bytea,
  ADD COLUMN IF NOT EXISTS email_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS email_key_id text,
  ADD COLUMN IF NOT EXISTS email_lookup_digest text,
  ADD COLUMN IF NOT EXISTS email_lookup_key_id text,
  ADD COLUMN IF NOT EXISTS notes_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS notes_nonce bytea,
  ADD COLUMN IF NOT EXISTS notes_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS notes_key_id text;

ALTER TABLE customers ADD CONSTRAINT customers_protected_email_complete CHECK (
  (email_ciphertext IS NULL AND email_nonce IS NULL AND email_auth_tag IS NULL AND email_key_id IS NULL)
  OR
  (email_ciphertext IS NOT NULL AND email_nonce IS NOT NULL AND email_auth_tag IS NOT NULL AND email_key_id IS NOT NULL)
);

ALTER TABLE customers ADD CONSTRAINT customers_protected_notes_complete CHECK (
  (notes_ciphertext IS NULL AND notes_nonce IS NULL AND notes_auth_tag IS NULL AND notes_key_id IS NULL)
  OR
  (notes_ciphertext IS NOT NULL AND notes_nonce IS NOT NULL AND notes_auth_tag IS NOT NULL AND notes_key_id IS NOT NULL)
);

-- 4. Extend appointments with true provenance origin and workshop_manual resolution status
ALTER TABLE appointments
  ALTER COLUMN case_id DROP NOT NULL,
  ALTER COLUMN confirmation_evidence_ref DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'voice_phone'
    CHECK (origin IN ('voice_phone', 'workshop_manual', 'web_lead', 'dms_import'));

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_identity_resolution_status_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_identity_resolution_complete;

ALTER TABLE appointments ADD CONSTRAINT appointments_identity_resolution_status_check
  CHECK (identity_resolution_status IN ('verified','provisional_new','provisional_ambiguous','workshop_manual'));

ALTER TABLE appointments ADD CONSTRAINT appointments_identity_resolution_complete CHECK (
  (identity_resolution_status IN ('verified','provisional_new')
    AND customer_id IS NOT NULL AND vehicle_id IS NOT NULL
    AND identity_claim_ciphertext IS NULL AND identity_claim_nonce IS NULL
    AND identity_claim_auth_tag IS NULL AND identity_claim_key_id IS NULL)
  OR
  (identity_resolution_status = 'provisional_ambiguous'
    AND customer_id IS NULL AND vehicle_id IS NULL
    AND identity_claim_ciphertext IS NOT NULL AND identity_claim_nonce IS NOT NULL
    AND identity_claim_auth_tag IS NOT NULL AND identity_claim_key_id IS NOT NULL)
  OR
  (identity_resolution_status = 'workshop_manual'
    AND (
      (identity_claim_ciphertext IS NULL AND identity_claim_nonce IS NULL AND identity_claim_auth_tag IS NULL AND identity_claim_key_id IS NULL)
      OR
      (identity_claim_ciphertext IS NOT NULL AND identity_claim_nonce IS NOT NULL AND identity_claim_auth_tag IS NOT NULL AND identity_claim_key_id IS NOT NULL)
    ))
);

-- 5. API permissions
GRANT SELECT,INSERT,UPDATE,DELETE ON estimate_drafts, estimate_draft_lines, customers, vehicles, appointments, customer_vehicle_roles TO bibendia_api;

-- 6. Update runtime schema status to 022
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
 ('021_vehicle_catalog_vehiclesdb_2026_09_1.sql'),('022_manual_operations_foundation.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '022_manual_operations_foundation.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
