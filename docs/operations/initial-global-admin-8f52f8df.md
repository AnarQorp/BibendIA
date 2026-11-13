# ZaQ: initial global PLATFORM_ADMIN, one specific internal user

Target: `8f52f8df-4934-4614-ac19-7f73bdd6204e` only.
Product baseline: `6395a48897d42506fc73d4de449c5f0a388d4902`, compatible schema 041.
The platform owner's authorization has been granted; record its durable reference when executing.

## What this operation does

`server/operations/initial-global-admin-8f52f8df.sql` is an explicit operator action, **not** an automatically applied migration, startup hook or application endpoint. It adds at most one active `PLATFORM_ADMIN`, global scope, `tenant_id=NULL`, for this fixed UUID. It does not create/reactivate users, bind identities, change memberships or update/delete existing grants. An already-active matching grant is retained exactly and audited as `already_present`; an inactive/future/expired grant causes failure.

Authority is the existing infrastructure migration login authorized to `SET ROLE bibendia_migrator`, not an insufficient application principal. Both login and effective role must be non-superuser and `NOBYPASSRLS`; API/worker identities and unsafe membership configurations are rejected. No login/password/role is created by this production operation.

The migrator owns the tables but still obeys FORCE RLS. Within the transaction it creates SELECT/INSERT policies limited to the fixed user + global admin tuple and the migrator role. The policies are dropped before commit; neither intermediate policies nor a callable elevation function are published. FORCE RLS stays enabled throughout. Backend/application authorization policies and lifecycle rules are unchanged; no fake `app.*` authorization setting is used.

Existing `audit_events` requires a tenant. Rather than invent tenant provenance or loosen that contract, the operation creates `public.initial_global_admin_receipt_8f52f8df`, a private, FORCE-RLS operational audit ledger constrained to one operation and one user. It stores the grant's full snapshot, original migration login (`session_user`), database, owner-authorization reference, transaction ID, outcome and timestamp. Runtime roles have no table privileges. It has only migrator SELECT/INSERT policies, no UPDATE/DELETE policy; its grant ID is deliberately not a cascading FK so later grant removal cannot erase the audit.

Advisory locking serializes retries. New grant and audit receipt commit atomically; any failure rolls back the entire operation, including temporary policies/new ledger DDL. Replay preserves the original receipt and grant exactly. If the grant was later altered, revoked or removed, replay fails and does not restore it. It is not a recurring reconciliation command.

## Minimal execution instructions (ZaQ only; not run by naQor)

1. Obtain the published successor commit and inspect this script. Use the intended schema-041 database and its existing **migration operator credential**, not API/worker credentials or a superuser. Normal server change controls remain ZaQ's responsibility. No artifact redeploy or schema-042 migration is required for this standalone operation.
2. Set `BIBENDIA_OPERATOR_DSN` explicitly using the server's existing credential mechanism (do not paste credentials into GitHub or logs). Run from the checked-out repository root:

   ```bash
   : "${BIBENDIA_OPERATOR_DSN:?Explicit intended database and existing migration credential required}"
   psql -X --no-password --dbname="$BIBENDIA_OPERATOR_DSN" \
     --set=owner_authorization_ref='REPLACE_WITH_DURABLE_OWNER_APPROVAL_REFERENCE' \
     --file=server/operations/initial-global-admin-8f52f8df.sql
   ```

   libpq password files or the existing secret mechanism may supply authentication; do not put a plaintext password in a command argument. The reference is audit provenance, not an access credential. Do not use the example reference unchanged. The SQL rejects missing/short references, inactive/missing/unbound users, incompatible schema, unsafe roles and missing FORCE RLS. Locks time out after 5 seconds and each statement after 30 seconds; contention fails safely, allowing a later explicit retry.
3. Require psql exit status 0 and `COMMIT`. Retain the returned receipt: UUID, grant ID, outcome, operator, database and authorization reference. On failure, stop and use the error; do not disable RLS, substitute a superuser, reactivate a conflicting grant, change the target or invoke the multi-user pilot bootstrap. The user can then use the normal internal Admin OIDC/MFA flow; existing authorization recognizes the global grant for tenant creation. Workshop invitation authentication remains separate and unchanged.

This script cannot grant database authority to the operator: if the existing migration credential is unavailable or cannot assume the expected role, ZaQ must supply the legitimate infrastructure authority; application permissions are not a substitute.

## Isolated validation

```bash
bash server/test/bootstrap/initial-global-admin-gate.sh
npm run typecheck:server
```

The gate creates and removes its own loopback PostgreSQL 17 container, installs schema 041, creates non-superuser/NOBYPASSRLS fixture logins, and executes the **exact psql script** using the container's existing psql binary. No new host/npm dependency is installed. All database URLs are explicitly overridden and checked by the isolation guard; no production credentials are loaded.

Checks cover unauthorized runtime/superuser rejection, missing/inactive/unbound target, absent authorization reference, schema incompatibility, concurrency and replay, unchanged other users/business rows/grants/RLS policies, immutable receipt, atomic rollback on injected audit failure, refusal to restore a revoked grant, an unchanged existing active grant, and acceptance by the existing global `platform:tenant:create` authorization path. The existing platform/invitation/CLHA integration suites also run. Fixture administrator SQL is used only to prepare/adversarially mutate the disposable tests, never as the operation's authority.

Validation on 2026-11-13: **16/16 operator checks and 22/22 existing integration tests PASS** against disposable PostgreSQL 17, including the unchanged CLHA tests. Server compilation and server typecheck PASS. The disposable container was removed after completion. No production execution is implied by these results.

## Scope boundary

No production execution, live invitations or deployment in this implementation run. No changes to product RBAC, endpoints, OIDC, lifecycle rules, migration history, CLHA or other existing grants. Publication is a handoff, not proof of server execution or ZaQ acknowledgement.
