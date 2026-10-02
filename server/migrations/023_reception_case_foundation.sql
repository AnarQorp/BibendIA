-- 023: Reception Case Foundation. Extend the canonical table; do not create a parallel inbox.
ALTER TABLE reception_cases
  ALTER COLUMN conversation_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS workshop_id uuid REFERENCES workshops(id),
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'PHONE'
    CHECK (channel IN ('PHONE','WHATSAPP','WEB','MANUAL')),
  ADD COLUMN IF NOT EXISTS caller_type text NOT NULL DEFAULT 'OTHER'
    CHECK (caller_type IN ('CUSTOMER','SUPPLIER','INSURER_ASSESSOR','RENTING_FLEET','TOW_TRANSPORT','OTHER_WORKSHOP','COMMERCIAL','OTHER')),
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('callback_request','appointment_issue','late_arrival','vehicle_status_question','estimate_question',
      'additional_vehicle_issue','supplier_message','parts_delivery','tow_delivery','insurance_assessor',
      'administration_invoice','missed_call_return','commercial','other')),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  ADD COLUMN IF NOT EXISTS provider_conversation_id text,
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id),
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES estimate_drafts(id),
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS summary_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS summary_nonce bytea,
  ADD COLUMN IF NOT EXISTS summary_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS summary_key_id text,
  ADD COLUMN IF NOT EXISTS detail_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS detail_nonce bytea,
  ADD COLUMN IF NOT EXISTS detail_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS detail_key_id text,
  ADD COLUMN IF NOT EXISTS contact_context_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS contact_context_nonce bytea,
  ADD COLUMN IF NOT EXISTS contact_context_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS contact_context_key_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

UPDATE reception_cases rc SET workshop_id=c.workshop_id
FROM conversations c WHERE rc.conversation_id=c.id AND rc.tenant_id=c.tenant_id AND rc.workshop_id IS NULL;

ALTER TABLE reception_cases DROP CONSTRAINT IF EXISTS reception_cases_status_check;
UPDATE reception_cases SET status=CASE
  WHEN status IN ('new','ready_to_decide','executing') THEN 'OPEN'
  ELSE 'OPEN' END
WHERE status NOT IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','WAITING_WORKSHOP','RESOLVED','CLOSED');
ALTER TABLE reception_cases ADD CONSTRAINT reception_cases_status_check
  CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','WAITING_WORKSHOP','RESOLVED','CLOSED',
    'new','ready_to_decide','executing'));

ALTER TABLE reception_cases ADD CONSTRAINT reception_cases_summary_protected CHECK (
  (summary_ciphertext IS NULL AND summary_nonce IS NULL AND summary_auth_tag IS NULL AND summary_key_id IS NULL) OR
  (summary_ciphertext IS NOT NULL AND summary_nonce IS NOT NULL AND summary_auth_tag IS NOT NULL AND summary_key_id IS NOT NULL));
ALTER TABLE reception_cases ADD CONSTRAINT reception_cases_detail_protected CHECK (
  (detail_ciphertext IS NULL AND detail_nonce IS NULL AND detail_auth_tag IS NULL AND detail_key_id IS NULL) OR
  (detail_ciphertext IS NOT NULL AND detail_nonce IS NOT NULL AND detail_auth_tag IS NOT NULL AND detail_key_id IS NOT NULL));
ALTER TABLE reception_cases ADD CONSTRAINT reception_cases_contact_protected CHECK (
  (contact_context_ciphertext IS NULL AND contact_context_nonce IS NULL AND contact_context_auth_tag IS NULL AND contact_context_key_id IS NULL) OR
  (contact_context_ciphertext IS NOT NULL AND contact_context_nonce IS NOT NULL AND contact_context_auth_tag IS NOT NULL AND contact_context_key_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS reception_cases_idempotency_unique
  ON reception_cases(tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS reception_cases_work_queue
  ON reception_cases(tenant_id,status,priority,updated_at DESC);
GRANT SELECT,INSERT,UPDATE ON reception_cases TO bibendia_api;

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
 ('023_reception_case_foundation.sql')
),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
 (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)
SELECT '023_reception_case_foundation.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
