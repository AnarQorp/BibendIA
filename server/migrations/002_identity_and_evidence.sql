CREATE TABLE customer_vehicle_roles (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  role text NOT NULL DEFAULT 'owner',
  PRIMARY KEY (tenant_id,customer_id,vehicle_id)
);
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES conversations(id), direction text NOT NULL,
  role text NOT NULL, content_jsonb jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_vehicle_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vehicle_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_vehicle_roles USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON customer_vehicle_roles,messages TO bibendia_runtime;
