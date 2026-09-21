-- P0.1: separate schema ownership from API and worker capabilities.
-- Login identities and passwords are provisioned by infrastructure and receive exactly one
-- of these NOLOGIN group roles. Application processes never receive the migrator role.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibendia_runtime')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibendia_api') THEN
    ALTER ROLE bibendia_runtime RENAME TO bibendia_api;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibendia_migrator') THEN
    CREATE ROLE bibendia_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibendia_api') THEN
    CREATE ROLE bibendia_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibendia_worker') THEN
    CREATE ROLE bibendia_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

-- The bootstrap/migration identity may assume the owner role. Runtime identities must not.
GRANT bibendia_migrator TO CURRENT_USER;

ALTER SCHEMA public OWNER TO bibendia_migrator;
DO $$ DECLARE object_record record; BEGIN
  FOR object_record IN
    SELECT c.relkind, quote_ident(n.nspname) AS schema_name, quote_ident(c.relname) AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S')
      AND (c.relkind <> 'S' OR NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype IN ('a','i')
      ))
  LOOP
    IF object_record.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE %s.%s OWNER TO bibendia_migrator', object_record.schema_name, object_record.object_name);
    ELSE
      EXECUTE format('ALTER TABLE %s.%s OWNER TO bibendia_migrator', object_record.schema_name, object_record.object_name);
    END IF;
  END LOOP;
END $$;

ALTER TABLE channel_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_endpoints FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON channel_endpoints;
CREATE POLICY tenant_isolation ON channel_endpoints
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_holds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON slot_holds;
CREATE POLICY tenant_isolation ON slot_holds
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Remove the broad legacy runtime grant before defining process-specific capabilities.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bibendia_api;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM bibendia_api;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bibendia_worker;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM bibendia_worker;

GRANT USAGE ON SCHEMA public TO bibendia_api, bibendia_worker;

GRANT SELECT ON tenants TO bibendia_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  workshops, channel_endpoints, customers, vehicles, conversations, calls,
  reception_cases, slot_holds, appointments, action_intents, audit_events,
  outbox_events, inbox_events, customer_vehicle_roles, messages
TO bibendia_api;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq, outbox_events_id_seq, inbox_events_id_seq TO bibendia_api;

-- P0.1 worker scope: claim and complete outbox work only. Later worker capabilities must be
-- added explicitly with the P0.7 command handlers, never through ALL TABLES grants.
GRANT SELECT ON tenants TO bibendia_worker;
GRANT SELECT, UPDATE ON outbox_events TO bibendia_worker;

REVOKE ALL ON schema_migrations FROM bibendia_api, bibendia_worker;

-- Future objects created by the canonical migrator remain private unless explicitly granted.
ALTER DEFAULT PRIVILEGES FOR ROLE bibendia_migrator IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE bibendia_migrator IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
