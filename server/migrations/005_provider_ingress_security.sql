-- P0.4: authenticated provider identities and server-side tenant bindings.

ALTER TABLE channel_endpoints DROP CONSTRAINT channel_endpoints_provider_check;
ALTER TABLE channel_endpoints ADD CONSTRAINT channel_endpoints_provider_check
  CHECK (provider IN ('twilio','vapi','elevenlabs'));
ALTER TABLE channel_endpoints ADD CONSTRAINT channel_endpoints_tenant_id_id_key UNIQUE (tenant_id,id);
ALTER TABLE channel_endpoints ADD CONSTRAINT channel_endpoints_tenant_workshop_fk
  FOREIGN KEY (tenant_id,workshop_id) REFERENCES workshops(tenant_id,id);

CREATE TABLE service_principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('twilio','elevenlabs')),
  service_type text NOT NULL CHECK (service_type IN ('telephony_provider','voice_provider')),
  external_account_id text NOT NULL,
  credential_ref text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_account_id)
);

CREATE TABLE provider_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_principal_id uuid NOT NULL REFERENCES service_principals(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  channel_endpoint_id uuid NOT NULL REFERENCES channel_endpoints(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_principal_id, channel_endpoint_id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id,workshop_id) REFERENCES workshops(tenant_id,id),
  FOREIGN KEY (tenant_id,channel_endpoint_id) REFERENCES channel_endpoints(tenant_id,id)
);

ALTER TABLE inbox_events
  ADD COLUMN service_principal_id uuid REFERENCES service_principals(id),
  ADD COLUMN correlation_id text,
  ADD COLUMN event_occurred_at timestamptz,
  ADD COLUMN signature_verified_at timestamptz;

ALTER TABLE service_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_principals FORCE ROW LEVEL SECURITY;
CREATE POLICY authenticated_service_self ON service_principals
  USING (
    current_setting('app.principal_type', true) = 'service'
    AND id = nullif(current_setting('app.principal_id', true), '')::uuid
  );

ALTER TABLE provider_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY authenticated_service_bindings ON provider_bindings
  USING (
    current_setting('app.principal_type', true) = 'service'
    AND service_principal_id = nullif(current_setting('app.principal_id', true), '')::uuid
  );

GRANT SELECT ON service_principals, provider_bindings TO bibendia_api;
GRANT INSERT, UPDATE ON inbox_events TO bibendia_api;
