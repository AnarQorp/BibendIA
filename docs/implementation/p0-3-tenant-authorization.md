# P0.3 Tenant Authorization Report

Status: complete; stopped before P0.4 provider authentication.

## Delivered

- `users` and `external_identities` for stable internal users and future OIDC mapping.
- `tenant_memberships` with pilot Workshop roles, active/suspended/revoked state and validity.
- `platform_access_grants` with pilot Platform roles and global/tenant scope.
- Forced RLS on all four control-plane tables.
- A capability matrix versioned in application code; no dynamic IAM editor.
- A transactional Authorization Service that authenticates internal user state, resolves active
  membership/grant, checks capability, then sets `app.tenant_id` and executes the domain query.
- Migration of the appointments endpoint to the Workshop tenant URL contract.
- Complete removal of `x-tenant-id` from tenant resolution. Contradictory header/body values do
  not influence authorization or RLS context.

## Authorization sequence

```text
PrincipalContext
  -> validate internal user UUID and session expiry
  -> BEGIN + SET LOCAL ROLE bibendia_api
  -> set principal/requested-tenant/correlation GUCs
  -> active user
  -> active membership or scoped platform grant
  -> capability matrix
  -> existing tenant
  -> set trusted app.tenant_id
  -> domain query under forced RLS
  -> COMMIT
```

Authorization and the domain query share one transaction/connection. No trusted TenantContext
exists before membership/grant and capability checks pass.

## Pilot capability model

Workshop roles: `OWNER`, `MANAGER`, `RECEPTION`, `VIEWER`.

Platform roles: `PLATFORM_ADMIN`, `PLATFORM_OPERATOR`, `SUPPORT_READONLY`,
`SECURITY_AUDITOR`.

Capabilities cover only current Workshop reads and the approved Admin v0 areas. Workshop and
Platform capability namespaces are separate. `SUPPORT_READONLY` has no mutation or kill-switch
capability.

## RLS

- `users` and `external_identities`: current internal principal only.
- `tenant_memberships`: current Workshop principal + requested tenant only.
- `platform_access_grants`: current Platform principal + global or requested-tenant grant only.
- Business tables continue to require trusted `app.tenant_id` and forced RLS.

An integration test intentionally executes `SELECT tenant_id FROM workshops` without a tenant
predicate after authorization. PostgreSQL returns only the authorized tenant.

## API change

Removed: `GET /v1/appointments` with `x-tenant-id`.

Added: `GET /v1/workshop/tenants/:tenantId/appointments`.

The URL UUID is a selector, not authority. Authentication principal kind/audience is enforced by
P0.2; P0.3 resolves membership/capability and constructs TenantContext.

## Required test cases

Covered:

- Workshop A -> A allowed; A -> B denied;
- A+B membership -> each allowed independently;
- suspended membership denied;
- suspended user denied;
- Workshop role denied Platform capability;
- Platform scoped A -> B denied;
- Platform readonly read allowed, mutation denied;
- contradictory body/header cannot alter URL-derived context;
- direct URL manipulation denied;
- Platform principal rejected by Workshop route;
- RLS contains an intentionally unfiltered query.

## Deferred boundaries

- IdP-specific OIDC mapping/login remains pending approval. The future adapter resolves
  `issuer + subject` to the internal `users.id` represented in PrincipalContext.
- Provider signatures/service tenant derivation remain P0.4.
- Tenant lifecycle/kill switch remains P0.5.
- Membership and grant mutation APIs for Admin v0 remain P0.9; P0.3 supplies their authority model.

## ZaQ coordination

No new secret or infrastructure change is introduced. Migration `004_tenant_authorization.sql`
must eventually deploy after `003` with the coordinated application artifact; neither migration
has been applied to the live database.
