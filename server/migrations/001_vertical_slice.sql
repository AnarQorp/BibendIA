CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  locale text NOT NULL DEFAULT 'es-ES', timezone text NOT NULL DEFAULT 'Europe/Madrid',
  operating_mode text NOT NULL DEFAULT 'pilot_supervised' CHECK (operating_mode IN ('standard','pilot_supervised')),
  policy_version text NOT NULL DEFAULT 'pilot-v1', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Madrid', opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id,id)
);
CREATE TABLE channel_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id), provider text NOT NULL CHECK (provider IN ('vapi','elevenlabs')),
  external_account_id text NOT NULL, called_endpoint text NOT NULL, status text NOT NULL DEFAULT 'active',
  UNIQUE (provider,external_account_id,called_endpoint)
);
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  display_name text NOT NULL, phone_lookup_hash text, UNIQUE (tenant_id,phone_lookup_hash), UNIQUE (tenant_id,id)
);
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  plate_ciphertext text NOT NULL, plate_hash text NOT NULL, make text, model text,
  UNIQUE (tenant_id,plate_hash), UNIQUE (tenant_id,id)
);
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id), status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, UNIQUE (tenant_id,id)
);
CREATE TABLE calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES conversations(id), provider text NOT NULL, provider_call_id text NOT NULL,
  status text NOT NULL, transcript_ref text, recording_ref text, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  UNIQUE (tenant_id,provider,provider_call_id), UNIQUE (tenant_id,id)
);
CREATE TABLE reception_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES conversations(id), customer_id uuid REFERENCES customers(id), vehicle_id uuid REFERENCES vehicles(id),
  intent text, status text NOT NULL DEFAULT 'new', risk_level text NOT NULL DEFAULT 'low', version integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id,id)
);
CREATE TABLE slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), workshop_id uuid NOT NULL REFERENCES workshops(id),
  slot_token text NOT NULL, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  capacity_requirements jsonb NOT NULL, expires_at timestamptz NOT NULL, UNIQUE (tenant_id,slot_token)
);
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), workshop_id uuid NOT NULL REFERENCES workshops(id),
  case_id uuid NOT NULL REFERENCES reception_cases(id), customer_id uuid NOT NULL REFERENCES customers(id), vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  service_request jsonb NOT NULL, symptoms text[] NOT NULL DEFAULT '{}', notes text,
  estimated_duration_minutes integer NOT NULL CHECK (estimated_duration_minutes > 0), capacity_requirements jsonb NOT NULL,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'confirmed',
  confirmation_evidence_ref text NOT NULL, idempotency_key text NOT NULL, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id,idempotency_key), UNIQUE (tenant_id,id)
);
CREATE TABLE action_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), case_id uuid NOT NULL REFERENCES reception_cases(id),
  tool_name text NOT NULL, input_jsonb jsonb NOT NULL, status text NOT NULL, idempotency_key text NOT NULL,
  requested_by_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id,idempotency_key)
);
CREATE TABLE audit_events (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), actor_type text NOT NULL, actor_id text NOT NULL,
  event_type text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, correlation_id text NOT NULL,
  evidence_ref text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outbox_events (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  event_type text NOT NULL, payload_jsonb jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz
);
CREATE TABLE inbox_events (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), provider text NOT NULL,
  external_event_id text NOT NULL, payload_hash text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, status text NOT NULL DEFAULT 'received', UNIQUE (tenant_id,provider,external_event_id)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['workshops','customers','vehicles','conversations','calls','reception_cases','appointments','action_intents','audit_events','outbox_events','inbox_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)', t);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bibendia_runtime') THEN
    CREATE ROLE bibendia_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
GRANT bibendia_runtime TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO bibendia_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO bibendia_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO bibendia_runtime;
