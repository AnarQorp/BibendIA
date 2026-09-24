\set ON_ERROR_STOP on

-- One-time/restart-safe infrastructure bootstrap. Run as the PostgreSQL database owner
-- (or an equivalent ephemeral bootstrap identity), never as an application runtime login.
-- Login roles and their passwords remain infrastructure-owned and are not created here.

DO $$
DECLARE
  role_name text;
  role_record record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['bibendia_migrator', 'bibendia_api', 'bibendia_worker'] LOOP
    SELECT rolcanlogin, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolbypassrls
      INTO role_record
      FROM pg_roles
      WHERE rolname = role_name;

    IF NOT FOUND THEN
      EXECUTE format(
        'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        role_name
      );
    ELSIF role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolinherit
       OR role_record.rolcreaterole OR role_record.rolcreatedb OR role_record.rolbypassrls THEN
      RAISE EXCEPTION 'existing capability role % has unsafe attributes', role_name;
    END IF;
  END LOOP;
END $$;

-- pgcrypto is a database-level prerequisite. Installing it belongs to bootstrap because the
-- runtime migrator intentionally has neither database CREATE nor superuser privileges.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER SCHEMA public OWNER TO bibendia_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

DO $$
BEGIN
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM bibendia_migrator, bibendia_api, bibendia_worker',
    current_database()
  );
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO bibendia_migrator, bibendia_api, bibendia_worker',
    current_database()
  );
END $$;
