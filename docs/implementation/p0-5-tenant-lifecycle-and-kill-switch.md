# P0.5 Tenant Lifecycle and Kill Switch

Status: complete in the isolated branch; stopped before P0.6.

## Operational semantics

| State | Platform read/control | Workshop reads | New conversation | Appointment/other mutation | Autonomous/external effect | Pending Outbox |
|---|---|---|---|---|---|---|
| `provisioning` | allowed when granted | denied | fallback/no automation | denied | denied | not claimable |
| `pilot` | allowed when granted | allowed | allowed | allowed | allowed | claimable |
| `active` | allowed when granted | allowed | allowed | allowed | allowed | claimable |
| `suspended` | allowed when granted | allowed for retained operational visibility | fallback/no automation | denied | denied | not claimable |
| `deactivated` | allowed when granted for retention/audit | denied | capture + safe fallback only | denied | denied | not claimable |

Provider ingress remains authenticated, replay-protected and captured in Inbox for traceability.
Lifecycle then decides whether autonomous handling may begin. A denied ingress returns an explicit
fallback signal and never treats provider metadata as control-plane authority.

Allowed transitions are deliberately hard-coded:

- `provisioning -> pilot | deactivated`
- `pilot -> active | suspended | deactivated`
- `active -> suspended | deactivated`
- `suspended -> pilot | active | deactivated`
- `deactivated` is terminal

There is no workflow engine and no dynamic lifecycle policy.

## One independent kill switch

The single tenant kill switch does not change lifecycle, configuration, users, memberships or
history. While enabled it preserves authorized reads and authenticated ingress capture but blocks
new conversations, domain mutations, autonomous actions and external effects. Disabling it restores
only what the current lifecycle permits. Every change requires a Platform capability, reason,
idempotency key and optimistic `expectedVersion`.

## Enforcement and audit

Control state is read from PostgreSQL under the already-authorized `TenantContext`; client headers,
body fields, URL metadata and provider fields cannot assert it. Domain mutations take a shared,
transaction-scoped tenant advisory lock. Lifecycle/kill commands take the matching exclusive lock
plus a tenant-row update lock and atomically update control state,
append `tenant_control_events` with before/after, actor, reason, correlation and version, and append
an `audit_events` Action Ledger pointer. No secret or raw provider payload enters this audit.

The API exposes only:

- `GET /v1/platform/tenants/:tenantId/control`
- `POST /v1/platform/tenants/:tenantId/lifecycle`
- `POST /v1/platform/tenants/:tenantId/kill-switch/enable`
- `POST /v1/platform/tenants/:tenantId/kill-switch/disable`

All use P0.2 authentication, P0.3 Platform grant/capability authorization and forced RLS.

## Outbox invariant and P0.7 boundary

Claiming filters out non-operational or killed tenants. More importantly, a claimed event is not an
authorization to execute: `publishClaimedOutboxEvent` re-locks the event and tenant immediately at
the external-effect boundary. If control was stopped after claim, no callback is invoked. Holding a
shared tenant lock through the effect linearizes it against lifecycle/kill commands.

P0.7 still owns dispatcher orchestration, lease recovery, bounded retry classification, dead-letter,
reconciliation, shutdown and duplicate-provider-effect handling. The present final gate must be used
by that dispatcher; bypassing it is forbidden. A remote effect can succeed while the following DB
commit fails, so provider idempotency/reconciliation remains necessary in P0.7.

## Deployment coordination

Migration `006_tenant_lifecycle_and_kill_switch.sql` follows `003`-`005` and must ship with the
compatible API/worker artifact. It adds no secret. Existing tenants are migrated to `pilot`; tenants
created afterwards default to `provisioning`. It has not been applied to the live database.
