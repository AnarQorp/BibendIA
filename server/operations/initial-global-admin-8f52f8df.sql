\set ON_ERROR_STOP on
-- Operator-only, schema 041. Run with psql -X as an existing non-superuser
-- migration login authorized to SET ROLE bibendia_migrator. Never an API login.
-- No dynamic target, no runtime function/endpoint, no disabled/bypassed RLS.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL ROLE bibendia_migrator;
SET LOCAL row_security = on;
SET LOCAL search_path = pg_catalog, public;
SELECT set_config('bootstrap.owner_authorization_ref', :'owner_authorization_ref', true);

DO $operation$
DECLARE
  target CONSTANT uuid := '8f52f8df-4934-4614-ac19-7f73bdd6204e';
  operation CONSTANT text := 'initial-global-admin:8f52f8df-4934-4614-ac19-7f73bdd6204e:v1';
  authorization_ref text := btrim(current_setting('bootstrap.owner_authorization_ref'));
  grant_row public.platform_access_grants;
  receipt jsonb;
  outcome text;
BEGIN
  IF current_user <> 'bibendia_migrator'
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (session_user,current_user) AND (rolsuper OR rolbypassrls))
     OR pg_has_role('bibendia_api','bibendia_migrator','member')
     OR pg_has_role('bibendia_worker','bibendia_migrator','member')
     OR pg_has_role(session_user,'bibendia_api','member')
     OR pg_has_role(session_user,'bibendia_worker','member') THEN
    RAISE EXCEPTION 'OPERATOR_MIGRATION_IDENTITY_REQUIRED';
  END IF;
  IF length(authorization_ref) NOT BETWEEN 8 AND 512 THEN
    RAISE EXCEPTION 'OWNER_AUTHORIZATION_REFERENCE_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.runtime_schema_status()
    WHERE compatible AND schema_version='041_workshop_invitations.sql') THEN
    RAISE EXCEPTION 'COMPATIBLE_SCHEMA_041_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE oid IN
      ('public.users'::regclass,'public.external_identities'::regclass,'public.platform_access_grants'::regclass)
      AND relrowsecurity AND relforcerowsecurity AND relowner='bibendia_migrator'::regrole) <> 3 THEN
    RAISE EXCEPTION 'EXPECTED_OWNERSHIP_AND_FORCE_RLS_REQUIRED';
  END IF;

  -- Serialize retries, including first creation of the private global audit ledger.
  PERFORM pg_advisory_xact_lock(hashtextextended(operation,0));
  PERFORM 1 FROM public.users WHERE id=target AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_ACTIVE_USER_REQUIRED'; END IF;
  PERFORM 1 FROM public.external_identities WHERE user_id=target FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_CANONICAL_IDENTITY_REQUIRED'; END IF;

  -- Existing audit_events require a tenant; a global grant must not invent one.
  -- This one-row operational receipt is itself the durable atomic global audit.
  IF to_regclass('public.initial_global_admin_receipt_8f52f8df') IS NULL THEN
    CREATE TABLE public.initial_global_admin_receipt_8f52f8df (
      operation_id text PRIMARY KEY CHECK (operation_id='initial-global-admin:8f52f8df-4934-4614-ac19-7f73bdd6204e:v1'),
      user_id uuid NOT NULL CHECK (user_id='8f52f8df-4934-4614-ac19-7f73bdd6204e'),
      grant_id uuid NOT NULL,
      grant_snapshot jsonb NOT NULL,
      outcome text NOT NULL CHECK (outcome IN ('created','already_present')),
      owner_authorization_ref text NOT NULL CHECK (length(owner_authorization_ref) BETWEEN 8 AND 512),
      executed_by name NOT NULL,
      database_name name NOT NULL,
      transaction_id xid8 NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    REVOKE ALL ON public.initial_global_admin_receipt_8f52f8df FROM PUBLIC,bibendia_api,bibendia_worker;
    ALTER TABLE public.initial_global_admin_receipt_8f52f8df ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.initial_global_admin_receipt_8f52f8df FORCE ROW LEVEL SECURITY;
    CREATE POLICY operator_receipt_read ON public.initial_global_admin_receipt_8f52f8df
      FOR SELECT TO bibendia_migrator USING (true);
    CREATE POLICY operator_receipt_insert ON public.initial_global_admin_receipt_8f52f8df
      FOR INSERT TO bibendia_migrator WITH CHECK (
        user_id='8f52f8df-4934-4614-ac19-7f73bdd6204e'
        AND operation_id='initial-global-admin:8f52f8df-4934-4614-ac19-7f73bdd6204e:v1');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.initial_global_admin_receipt_8f52f8df'::regclass
      AND relowner='bibendia_migrator'::regrole AND relrowsecurity AND relforcerowsecurity)
     OR has_table_privilege('bibendia_api','public.initial_global_admin_receipt_8f52f8df','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('bibendia_worker','public.initial_global_admin_receipt_8f52f8df','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'PRIVATE_FORCE_RLS_RECEIPT_REQUIRED';
  END IF;

  -- These narrow permissions belong ONLY to the legitimate migration authority.
  -- DDL/table lock is held to commit; policies are dropped below, not published
  -- to other sessions. No app.* capability is forged and FORCE RLS stays on.
  LOCK TABLE public.platform_access_grants IN SHARE ROW EXCLUSIVE MODE;
  CREATE POLICY initial_admin_8f52f8df_read ON public.platform_access_grants
    FOR SELECT TO bibendia_migrator USING (
      user_id='8f52f8df-4934-4614-ac19-7f73bdd6204e'
      AND role='PLATFORM_ADMIN' AND scope_type='global' AND tenant_id IS NULL);
  CREATE POLICY initial_admin_8f52f8df_insert ON public.platform_access_grants
    FOR INSERT TO bibendia_migrator WITH CHECK (
      user_id='8f52f8df-4934-4614-ac19-7f73bdd6204e'
      AND role='PLATFORM_ADMIN' AND scope_type='global' AND tenant_id IS NULL
      AND status='active' AND valid_from<=now() AND valid_until IS NULL);

  SELECT * INTO grant_row FROM public.platform_access_grants
    WHERE user_id=target AND role='PLATFORM_ADMIN' AND scope_type='global' AND tenant_id IS NULL;
  SELECT to_jsonb(r) INTO receipt FROM public.initial_global_admin_receipt_8f52f8df r WHERE operation_id=operation;
  IF receipt IS NOT NULL THEN
    -- A revoked/deleted/modified grant must never be restored by replaying bootstrap.
    IF grant_row.id IS NULL OR receipt->'grant_snapshot' IS DISTINCT FROM to_jsonb(grant_row) THEN
      RAISE EXCEPTION 'RECORDED_GRANT_CHANGED_REQUIRES_SEPARATE_AUTHORIZATION';
    END IF;
  ELSE
    IF grant_row.id IS NULL THEN
      INSERT INTO public.platform_access_grants(user_id,role,scope_type,tenant_id,status)
        VALUES(target,'PLATFORM_ADMIN','global',NULL,'active') RETURNING * INTO grant_row;
      outcome := 'created';
    ELSE
      -- Never update, reactivate, extend or replace any existing grant.
      outcome := 'already_present';
    END IF;
    IF grant_row.status<>'active' OR grant_row.valid_from>now()
       OR (grant_row.valid_until IS NOT NULL AND grant_row.valid_until<=now()) THEN
      RAISE EXCEPTION 'EXISTING_GRANT_NOT_CURRENTLY_ACTIVE';
    END IF;
    INSERT INTO public.initial_global_admin_receipt_8f52f8df
      (operation_id,user_id,grant_id,grant_snapshot,outcome,owner_authorization_ref,executed_by,database_name,transaction_id)
      VALUES(operation,target,grant_row.id,to_jsonb(grant_row),outcome,authorization_ref,session_user,current_database(),pg_current_xact_id());
  END IF;
  IF grant_row.status<>'active' OR grant_row.valid_from>now()
     OR (grant_row.valid_until IS NOT NULL AND grant_row.valid_until<=now()) THEN
    RAISE EXCEPTION 'RECORDED_GRANT_NOT_CURRENTLY_ACTIVE';
  END IF;
  DROP POLICY initial_admin_8f52f8df_insert ON public.platform_access_grants;
  DROP POLICY initial_admin_8f52f8df_read ON public.platform_access_grants;
END
$operation$;

SELECT operation_id,user_id,grant_id,outcome,owner_authorization_ref,executed_by,database_name,transaction_id,occurred_at
  FROM public.initial_global_admin_receipt_8f52f8df;
COMMIT;
