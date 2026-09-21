# ADR 0002: Platform surfaces, identity boundaries and Admin v0

- Status: Accepted
- Date: 2026-09-21
- Owners: BibendIA application architecture/security
- Infrastructure boundary: ZaQ owns VPS, runtime, Caddy, TLS, deploy, backups and infrastructure monitoring.

## Context

BibendIA is one platform with three web surfaces:

- `bibendia.com`: isolated public/commercial web;
- `app.bibendia.com`: tenant-scoped Workshop App;
- `admin.bibendia.com`: internal Platform Admin.

The current vertical slice is not safe for public exposure. It accepts a client-provided
`x-tenant-id`, has no human authentication boundary, does not authenticate the voice tool
caller, uses insufficiently separated PostgreSQL roles, and has a single-tenant worker.

## Decision

Keep one modular monolith (`api + worker`) and one authoritative PostgreSQL database.
The surfaces are separate frontend artifacts and security perimeters, not separate backends.

API namespaces are:

- `/public/*`: explicitly public, non-tenant operations only;
- `/v1/workshop/*`: authenticated workshop operations;
- `/v1/platform/*`: authenticated platform operations;
- `/v1/providers/:provider/*`: authenticated provider callbacks/tools;
- `/internal/*`: non-public readiness, metrics and runtime operations.

### Principals

The Core recognizes `workshop_user`, `platform_user` and `service` principals. Human users
have a stable internal identity linked to an OIDC `issuer + subject`. Workshop authority
comes from an active tenant membership. Platform authority comes from an active platform
grant and its scope. Service authority comes from a provider or machine credential and an
explicit capability set.

A requested `tenant_id` is a selector, never proof of authority. The API authenticates a
principal, verifies membership/grant/capability, then creates a trusted tenant context. Voice
traffic derives the tenant from an active DID/channel binding. Workers derive it from the
claimed event. Client-controlled `x-tenant-id` is not an authorization boundary.

### Sessions

Workshop and Platform use separate OIDC clients/audiences and host-only HttpOnly Secure
cookies. Platform requires MFA. The design supports step-up authentication, but pilot scope
uses it only for critical operations. A Workshop session is not valid on Platform Admin.

### Authorization and RLS

Authorization is capability based, with a small pilot role matrix. PostgreSQL RLS remains
defence in depth. Trusted server code sets transaction-local principal, tenant and correlation
context only after authorization. Runtime roles cannot own application objects or bypass RLS.
Migration, API and worker identities are separated.

### Tenant lifecycle and kill switch

Tenant lifecycle is `provisioning -> pilot -> active -> suspended -> deactivated`. Suspension
blocks new automated actions and enables the configured fallback. A kill switch is immediate,
reversible and independent of lifecycle. Both require reason, actor, audit record and receipt.
Domain commands re-check the state immediately before an external effect.

### Admin v0

Admin v0 is a minimal operational UI, not a CRM. It supports tenant lifecycle, basic users and
memberships, channels/DID, integrations, active Agent/Policy versions, recent activity,
usage/cost, incidents and kill switch. Every mutation goes through Core command handlers,
Action Ledger, audit and Outbox. SQL access, impersonation, billing, self-service onboarding,
BI and unrestricted JSON/prompt editing are excluded.

### Provider ingress

Provider ingress verifies the provider's signature against the raw request, validates freshness
and replay, persists an idempotent Inbox receipt, resolves the channel binding, creates a service
principal and invokes normal Policy/ActionIntent/domain paths. An unverified callback cannot
create or mutate domain state.

## Consequences

- Public Web may ship independently but grants no private Core access.
- Private exposure remains blocked until the corresponding P0 controls pass.
- Existing domain aggregates remain; Tenant gains lifecycle/control-plane responsibility and
  ActionIntent/Audit/Inbox/Outbox gain actor, security and retry metadata.
- No microservices, Kubernetes or Redis are introduced.

## Pilot role matrix

Workshop: `OWNER`, `MANAGER`, `RECEPTION`, `VIEWER`.

Platform: `PLATFORM_ADMIN`, `PLATFORM_OPERATOR`, `SUPPORT_READONLY`, `SECURITY_AUDITOR`.

The initial capability matrix lives in reviewed application code. Database tables for a fully
dynamic enterprise IAM system are deferred.

## Acceptance boundary

No private surface is production-exposable until cross-tenant negative tests, runtime-role
tests, provider signature/replay tests, PII/logging controls, worker recovery tests and tenant
suspension/kill-switch tests pass.
