# BibendIA Platform P0/P1 backlog

Canonical decision: [ADR 0002](../adr/0002-platform-surfaces-identity-and-admin-v0.md).

Each item is independently verifiable. `OPEN` is not a release claim.

## P0 — pilot security and operability

| ID | Status | Deliverable | Verification |
|---|---|---|---|
| P0.1 | COMPLETE | Separate migrator/API/worker DB roles; complete forced RLS and least-privilege grants | 9/9 integration tests, including privilege and cross-tenant negative cases |
| P0.2 | BOUNDARY COMPLETE | `PrincipalContext`, vendor-neutral auth adapter, audience/session separation and deny-by-default routing. Production OIDC adapter awaits IdP approval | 8 auth/API tests: public declaration, fail-closed, wrong audience/kind and test-adapter production guard |
| P0.3 | COMPLETE | users, external identities, memberships, platform grants, pilot capability matrix and server-derived TenantContext; `x-tenant-id` removed as authority | 8 dedicated integration cases plus capability unit tests and RLS omission test |
| P0.4 | COMPLETE | Twilio request signatures, ElevenLabs webhook HMAC, dedicated tool credential, replay guard, Inbox and server-side endpoint binding | crypto unit tests plus HTTP/integration invalid-signature, replay-conflict, wrong-agent, unknown-DID and RLS tests |
| P0.5 | COMPLETE | enforced tenant lifecycle, audited reversible kill switch, safe provider fallback and final Outbox effect guard | policy/unit tests plus Platform command, scope, audit, RLS, provider-metadata and claimed-before-kill integration cases |
| P0.6 | OPEN | PII classification, minimization, encryption, lookup hashes and log redaction | static/log/round-trip tests |
| P0.7 | OPEN | multi-tenant worker, Outbox publish/retry/dead-letter/reconciliation | restart, lease-expiry and duplicate-delivery tests |
| P0.8 | OPEN | liveness/readiness, graceful shutdown, migration job and immutable artifact | runtime smoke and failure-mode tests |
| P0.9 | OPEN | audited Platform command/query API sufficient to operate Jarrisons without SQL | Platform API E2E and audit/receipt assertions |

## P1 — first commercial operation

| ID | Status | Deliverable |
|---|---|---|
| P1.1 | OPEN | `admin.bibendia.com` Admin v0 UI consuming the approved contracts |
| P1.2 | OPEN | MFA enforcement and critical-operation step-up |
| P1.3 | OPEN | Agent/Policy version activation and rollback |
| P1.4 | OPEN | provider invoice/CDR cost reconciliation |
| P1.5 | OPEN | redacted support views and exceptional PII access audit |
| P1.6 | OPEN | incident/dead-letter operational workflow and alerts |
| P1.7 | OPEN | automated backup plus demonstrated restore/export |
| P1.8 | OPEN | user invitation and account recovery |

## Deferred P2

Billing/plans, self-service onboarding, generalized dual approval, impersonation, enterprise
SSO, advanced BI and multi-region DR. None is required for the first pilot.

## Delivery rules

- Platform UI may proceed against versioned contracts, but sensitive operations remain disabled
  until their P0 security boundary passes.
- Application architecture/backend/security belongs to naQor's workstream. VPS/runtime/Caddy/
  TLS/deploy/backups/infrastructure monitoring remain ZaQ's workstream.
- Private surfaces are not publicly exposed while relevant P0 items are open.
- Every block reports tests, evidence, residual risk and changed files.
