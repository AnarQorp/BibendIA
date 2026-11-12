-- Invitations are tenant scoped. Only the OIDC callback may call the narrow redemption function.
CREATE TABLE workshop_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 email_encrypted jsonb NOT NULL, email_digest text NOT NULL, email_digest_key_id text NOT NULL,
 role text NOT NULL CHECK (role IN ('OWNER','MANAGER','RECEPTION','VIEWER')),
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','expired')),
 delivery_event_id bigint REFERENCES outbox_events(id),
 expires_at timestamptz NOT NULL, accepted_at timestamptz, accepted_by uuid REFERENCES users(id),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX invitation_pending_recipient ON workshop_invitations(tenant_id,email_digest_key_id,email_digest) WHERE status='pending';
ALTER TABLE workshop_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_admin ON workshop_invitations TO bibendia_api
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND current_setting('app.authorized_capability',true)='platform:memberships:manage')
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND current_setting('app.authorized_capability',true)='platform:memberships:manage');
GRANT SELECT,INSERT,UPDATE ON workshop_invitations TO bibendia_api;
-- Function owner access is not inherited by either runtime role; FORCE RLS remains in place.
CREATE POLICY invitation_owner ON workshop_invitations TO bibendia_migrator USING(true) WITH CHECK(true);
CREATE POLICY identity_owner ON external_identities TO bibendia_migrator USING(true) WITH CHECK(true);
CREATE POLICY user_owner ON users TO bibendia_migrator USING(true) WITH CHECK(true);
CREATE POLICY membership_owner ON tenant_memberships TO bibendia_migrator USING(true) WITH CHECK(true);
CREATE POLICY auth_tenant_owner ON tenants FOR SELECT TO bibendia_migrator USING(true);
CREATE POLICY invitation_audit_owner ON audit_events TO bibendia_migrator WITH CHECK(true);

CREATE FUNCTION resolve_oidc_user(p_issuer text,p_subject text) RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT e.user_id FROM public.external_identities e JOIN public.users u ON u.id=e.user_id
 WHERE e.issuer=p_issuer AND e.subject=p_subject AND u.status='active'
$$;
ALTER FUNCTION resolve_oidc_user(text,text) OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION resolve_oidc_user(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_oidc_user(text,text) TO bibendia_api;

CREATE FUNCTION redeem_workshop_invitation(p_hash text,p_recipient_digests text[],p_verified boolean,p_issuer text,p_subject text,p_claim uuid,p_correlation text)
 RETURNS TABLE(user_id uuid,tenant_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 DECLARE inv public.workshop_invitations; uid uuid; existing public.tenant_memberships; user_status text;
 BEGIN
 IF p_verified IS DISTINCT FROM true OR p_recipient_digests IS NULL OR p_issuer IS NULL OR p_issuer='' OR p_subject IS NULL OR p_subject='' THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
 SELECT * INTO inv FROM public.workshop_invitations i WHERE i.token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR inv.status<>'pending' OR inv.expires_at<=now() OR NOT ((inv.email_digest_key_id||':'||inv.email_digest)=ANY(p_recipient_digests)) THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
 -- Serialize tenant lifecycle changes and identity onboarding across invitations/tenants.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(inv.tenant_id::text,271828));
 IF NOT EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=inv.tenant_id AND t.lifecycle_status IN('pilot','active') AND NOT t.kill_switch_enabled) THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_issuer || chr(10) || p_subject,314159));
 SELECT e.user_id INTO uid FROM public.external_identities e WHERE e.issuer=p_issuer AND e.subject=p_subject;
 IF uid IS NULL THEN
   -- An unbound UUID claim must never link an existing canonical account.
   IF p_claim IS NOT NULL THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
   INSERT INTO public.users(status) VALUES('active') RETURNING id INTO uid;
   INSERT INTO public.external_identities(user_id,issuer,subject,last_login_at) VALUES(uid,p_issuer,p_subject,now());
 ELSIF p_claim IS NOT NULL AND p_claim<>uid THEN RAISE EXCEPTION 'INVITATION_INVALID';
 END IF;
 SELECT status INTO user_status FROM public.users WHERE id=uid FOR UPDATE;
 IF user_status<>'active' THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
 SELECT * INTO existing FROM public.tenant_memberships m WHERE m.user_id=uid AND m.tenant_id=inv.tenant_id FOR UPDATE;
 IF FOUND THEN
   -- Never reactivate or elevate existing memberships through an invitation.
   IF existing.status<>'active' OR existing.role<>inv.role OR existing.valid_from>now() OR existing.valid_until<=now() THEN RAISE EXCEPTION 'INVITATION_INVALID'; END IF;
 ELSE
   INSERT INTO public.tenant_memberships(user_id,tenant_id,role) VALUES(uid,inv.tenant_id,inv.role);
 END IF;
 UPDATE public.workshop_invitations SET status='accepted',accepted_at=now(),accepted_by=uid,version=version+1,updated_at=now() WHERE id=inv.id;
 INSERT INTO public.audit_events(tenant_id,actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,evidence_ref)
 VALUES(inv.tenant_id,'workshop_user',uid::text,'invitation.accepted','invitation',inv.id::text,p_correlation,'postgres:invitation:'||inv.id::text);
 RETURN QUERY SELECT uid,inv.tenant_id;
 END
$$;
ALTER FUNCTION redeem_workshop_invitation(text,text[],boolean,text,text,uuid,text) OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION redeem_workshop_invitation(text,text[],boolean,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_workshop_invitation(text,text[],boolean,text,text,uuid,text) TO bibendia_api;

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
 ('023_reception_case_foundation.sql'),('024_workshop_capacity_scheduling_v1.sql'),
 ('025_workshop_capacity_resource_bootstrap.sql'),('026_workshop_capacity_resource_rls_backfill.sql'),
 ('027_repair_knowledge_coverage_01.sql'),('028_repair_knowledge_coverage_02_clha.sql'),
 ('029_repair_knowledge_coverage_03_crmb.sql'),('030_repair_knowledge_coverage_04_cayc.sql'),
 ('031_repair_knowledge_coverage_05_dv6c.sql'),('032_repair_knowledge_coverage_06_vag19tdi.sql'),
 ('033_repair_knowledge_coverage_07_k9k636_646.sql'),('034_repair_knowledge_coverage_08_opel17.sql'),
 ('035_repair_knowledge_coverage_09_dv6_legacy.sql'),('036_repair_knowledge_maintenance_01_vag_opel.sql'),
 ('037_repair_knowledge_maintenance_02_psa_ford.sql'),('038_repair_knowledge_maintenance_03_k9k.sql'),
 ('039_repair_knowledge_brakes_01_priority.sql'),('040_repair_knowledge_clutch_01_priority.sql'),('041_workshop_invitations.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '041_workshop_invitations.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
CREATE FUNCTION oidc_workshop_tenants(p_user uuid,p_issuer text,p_subject text) RETURNS SETOF uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT m.tenant_id FROM public.tenant_memberships m JOIN public.users u ON u.id=m.user_id
 JOIN public.external_identities e ON e.user_id=u.id JOIN public.tenants t ON t.id=m.tenant_id
 WHERE u.id=p_user AND u.status='active' AND e.issuer=p_issuer AND e.subject=p_subject
 AND m.status='active' AND m.valid_from<=now() AND (m.valid_until IS NULL OR m.valid_until>now())
 AND t.lifecycle_status IN ('pilot','active') ORDER BY m.tenant_id
$$;
ALTER FUNCTION oidc_workshop_tenants(uuid,text,text) OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION oidc_workshop_tenants(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION oidc_workshop_tenants(uuid,text,text) TO bibendia_api;
DROP POLICY platform_grant_resolution ON platform_access_grants;
CREATE POLICY platform_grant_resolution ON platform_access_grants FOR SELECT USING (
 current_setting('app.principal_type',true)='platform_user' AND user_id=nullif(current_setting('app.principal_id',true),'')::uuid
);
CREATE POLICY invitation_worker ON workshop_invitations FOR SELECT TO bibendia_worker USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT ON workshop_invitations TO bibendia_worker;

CREATE FUNCTION invitation_tenant(p_hash text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT tenant_id FROM public.workshop_invitations WHERE token_hash=p_hash AND status='pending' AND expires_at>now()
$$;
ALTER FUNCTION invitation_tenant(text) OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION invitation_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invitation_tenant(text) TO bibendia_api;
CREATE POLICY receipt_owner ON platform_command_receipts FOR SELECT TO bibendia_migrator USING(true);
-- Return only a conflict bit, never another tenant's receipt, for globally unique actor keys.
CREATE FUNCTION platform_key_conflicts(p_key text,p_operation text,p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.platform_command_receipts r
 WHERE r.actor_id=current_setting('app.principal_id',true) AND r.idempotency_key=p_key
 AND (r.operation<>p_operation OR (p_operation<>'tenant.create' AND r.tenant_id IS DISTINCT FROM p_tenant)))
$$;
ALTER FUNCTION platform_key_conflicts(text,text,uuid) OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION platform_key_conflicts(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_key_conflicts(text,text,uuid) TO bibendia_api;
