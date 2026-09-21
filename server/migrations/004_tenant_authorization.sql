-- P0.3: minimal internal identities, tenant memberships and scoped platform grants.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','disabled')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_identities (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  last_login_at timestamptz,
  PRIMARY KEY (issuer, subject),
  UNIQUE (user_id, issuer)
);

CREATE TABLE tenant_memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role text NOT NULL CHECK (role IN ('OWNER','MANAGER','RECEPTION','VIEWER')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE platform_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('PLATFORM_ADMIN','PLATFORM_OPERATOR','SUPPORT_READONLY','SECURITY_AUDITOR')),
  scope_type text NOT NULL CHECK (scope_type IN ('global','tenant')),
  tenant_id uuid REFERENCES tenants(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type='global' AND tenant_id IS NULL) OR (scope_type='tenant' AND tenant_id IS NOT NULL)),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE UNIQUE INDEX platform_access_grants_unique_scope
  ON platform_access_grants (user_id, role, scope_type, tenant_id) NULLS NOT DISTINCT;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY principal_self ON users
  USING (id = nullif(current_setting('app.principal_id', true), '')::uuid);

ALTER TABLE external_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY principal_self ON external_identities
  USING (user_id = nullif(current_setting('app.principal_id', true), '')::uuid);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_membership_resolution ON tenant_memberships
  USING (
    current_setting('app.principal_type', true) = 'workshop_user'
    AND user_id = nullif(current_setting('app.principal_id', true), '')::uuid
    AND tenant_id = nullif(current_setting('app.requested_tenant_id', true), '')::uuid
  );

ALTER TABLE platform_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_access_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_grant_resolution ON platform_access_grants
  USING (
    current_setting('app.principal_type', true) = 'platform_user'
    AND user_id = nullif(current_setting('app.principal_id', true), '')::uuid
    AND (
      scope_type = 'global'
      OR tenant_id = nullif(current_setting('app.requested_tenant_id', true), '')::uuid
    )
  );

GRANT SELECT ON users, external_identities, tenant_memberships, platform_access_grants TO bibendia_api;
