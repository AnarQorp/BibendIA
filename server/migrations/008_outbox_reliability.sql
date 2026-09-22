-- P0.7: durable Outbox state machine, leases, bounded retry and reconciliation evidence.
ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS effect_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_idempotency_key text,
  ADD COLUMN IF NOT EXISTS receipt_ref text,
  ADD COLUMN IF NOT EXISTS evidence_jsonb jsonb,
  ADD COLUMN IF NOT EXISTS reconciliation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciliation_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effect_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS correlation_id text;

UPDATE outbox_events
SET delivery_state = CASE WHEN published_at IS NULL THEN 'not_attempted' ELSE 'succeeded' END,
    completed_at = COALESCE(completed_at, published_at),
    external_idempotency_key = COALESCE(external_idempotency_key, 'outbox:' || id::text),
    effect_valid_until = COALESCE(effect_valid_until, occurred_at + interval '24 hours'),
    correlation_id = COALESCE(correlation_id, 'legacy:outbox:' || id::text)
WHERE delivery_state IS NULL OR external_idempotency_key IS NULL OR effect_valid_until IS NULL OR correlation_id IS NULL;

ALTER TABLE outbox_events
  ALTER COLUMN delivery_state SET DEFAULT 'not_attempted',
  ALTER COLUMN delivery_state SET NOT NULL,
  ALTER COLUMN external_idempotency_key SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN external_idempotency_key SET NOT NULL,
  ALTER COLUMN effect_valid_until SET DEFAULT (now() + interval '24 hours'),
  ALTER COLUMN effect_valid_until SET NOT NULL,
  ALTER COLUMN correlation_id SET DEFAULT 'outbox:unattributed',
  ALTER COLUMN correlation_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE outbox_events ADD CONSTRAINT outbox_delivery_state_check CHECK (delivery_state IN (
    'not_attempted','in_progress','succeeded','failed_safe_to_retry','unknown_outcome','dead_letter'
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE outbox_events ADD CONSTRAINT outbox_attempt_bounds CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 20);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE outbox_events ADD CONSTRAINT outbox_evidence_object CHECK (evidence_jsonb IS NULL OR jsonb_typeof(evidence_jsonb)='object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS outbox_external_idempotency_unique
  ON outbox_events(tenant_id, external_idempotency_key);
CREATE INDEX IF NOT EXISTS outbox_dispatch_candidates
  ON outbox_events(delivery_state, next_attempt_at, lease_until, occurred_at)
  WHERE delivery_state IN ('not_attempted','failed_safe_to_retry','in_progress');
CREATE INDEX IF NOT EXISTS outbox_reconciliation_candidates
  ON outbox_events(occurred_at) WHERE delivery_state='unknown_outcome';

-- The worker needs a PII-free tenant discovery primitive; it never bypasses tenant RLS for events.
CREATE OR REPLACE FUNCTION list_worker_tenant_ids()
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT id FROM public.tenants ORDER BY id $$;
ALTER FUNCTION list_worker_tenant_ids() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION list_worker_tenant_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_worker_tenant_ids() TO bibendia_worker;
DROP POLICY IF EXISTS worker_tenant_discovery ON tenants;
DROP POLICY IF EXISTS worker_tenant_discovery_definer ON tenants;
CREATE POLICY worker_tenant_discovery_definer ON tenants FOR SELECT TO bibendia_migrator USING (true);
