-- P0.5: operational tenant lifecycle and one independent kill switch.

ALTER TABLE tenants
  ADD COLUMN lifecycle_status text,
  ADD COLUMN lifecycle_updated_at timestamptz,
  ADD COLUMN lifecycle_updated_by_type text,
  ADD COLUMN lifecycle_updated_by_id text,
  ADD COLUMN lifecycle_reason text,
  ADD COLUMN kill_switch_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN kill_switch_updated_at timestamptz,
  ADD COLUMN kill_switch_updated_by_type text,
  ADD COLUMN kill_switch_updated_by_id text,
  ADD COLUMN kill_switch_reason text,
  ADD COLUMN control_version integer NOT NULL DEFAULT 1;

-- Existing development/pilot tenants were operational before lifecycle existed. New tenants start
-- in provisioning and must be deliberately promoted.
UPDATE tenants SET lifecycle_status='pilot', lifecycle_updated_at=now(),
  lifecycle_updated_by_type='system', lifecycle_updated_by_id='migration-006',
  lifecycle_reason='Existing tenant migrated into pilot state';
ALTER TABLE tenants ALTER COLUMN lifecycle_status SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN lifecycle_status SET DEFAULT 'provisioning';
ALTER TABLE tenants ADD CONSTRAINT tenants_lifecycle_status_check
  CHECK (lifecycle_status IN ('provisioning','pilot','active','suspended','deactivated'));
ALTER TABLE tenants ADD CONSTRAINT tenants_control_version_positive CHECK (control_version > 0);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY selected_tenant ON tenants
  USING (
    id = COALESCE(
      nullif(current_setting('app.tenant_id',true),'')::uuid,
      nullif(current_setting('app.requested_tenant_id',true),'')::uuid
    )
  )
  WITH CHECK (
    id = COALESCE(
      nullif(current_setting('app.tenant_id',true),'')::uuid,
      nullif(current_setting('app.requested_tenant_id',true),'')::uuid
    )
  );

CREATE TABLE tenant_control_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  event_type text NOT NULL CHECK (event_type IN ('lifecycle_changed','kill_switch_changed')),
  lifecycle_from text,
  lifecycle_to text,
  kill_switch_from boolean,
  kill_switch_to boolean,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  control_version integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,idempotency_key),
  CHECK (
    (event_type='lifecycle_changed' AND lifecycle_from IS NOT NULL AND lifecycle_to IS NOT NULL AND kill_switch_from IS NULL AND kill_switch_to IS NULL)
    OR
    (event_type='kill_switch_changed' AND lifecycle_from IS NULL AND lifecycle_to IS NULL AND kill_switch_from IS NOT NULL AND kill_switch_to IS NOT NULL AND kill_switch_from <> kill_switch_to)
  )
);

ALTER TABLE tenant_control_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_control_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_control_events
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

GRANT SELECT ON tenant_control_events TO bibendia_api;
GRANT INSERT ON tenant_control_events TO bibendia_api;
GRANT USAGE,SELECT ON SEQUENCE tenant_control_events_id_seq TO bibendia_api;
GRANT UPDATE (
  lifecycle_status,lifecycle_updated_at,lifecycle_updated_by_type,lifecycle_updated_by_id,lifecycle_reason,
  kill_switch_enabled,kill_switch_updated_at,kill_switch_updated_by_type,kill_switch_updated_by_id,
  kill_switch_reason,control_version
) ON tenants TO bibendia_api;
