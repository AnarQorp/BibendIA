# ZaQ handoff: minimal invitation functional corrections

Base: `28602f56645e484e605c8b351a1a676ea9e8db42`.
Branch: `fix/admin-invitations-minimal-20261112`.

## Bounded change

- Platform Admin's new-workshop activation requests `provisioning -> pilot` through the existing endpoint. Backend transition rules are untouched; no automatic promotion to `active`.
- Workshop App honors the session's `activeTenantId` when present in authorized memberships. Legacy first-membership fallback remains for absent/invalid active tenant; empty membership selects none.
- Platform authentication/grants, workshop role enforcement, tenant isolation, migration 041 and the CLHA historical-reference hotfix are unchanged. No backend production source or migration changes relative to base.

## Verification completed on 2026-11-13

- `npm run typecheck:server`: PASS.
- `npm run build`: PASS (TypeScript + workshop/admin artifacts).
- `npm run test:server`: 95/95 tests, 27 files, PASS.
- `bash server/test/manual/run-minimal-release-gate.sh`: PASS.
  - Disposable loopback PostgreSQL, synthetic data, cleanup completed.
  - 040 -> 041 preservation: all 41 existing business tables retain exact rows.
  - 22/22 directed integration tests, including CLHA preservation.
  - Signed local-OIDC regression covers create tenant/workshop, promote to pilot, issue invitation, accept with an existing multi-membership identity, select invited tenant, read workshop API, verify VIEWER role, deny an unjoined tenant and platform API, and verify zero platform grants.
  - Browser checks exercise the actual Activar Taller button and assert both request target `pilot` and persisted lifecycle; application navigation with another membership listed first reads the active invited workshop and is denied platform access.
  - Browser sessions are controlled fixtures, NOT a real external IdP. The integration callback uses signed JWTs from a local test issuer. SMTP uses the existing controlled test transport; browser mail delivery stays disabled. No real invitations sent.
- `git diff --check`: PASS.

## Coordination and release boundary

This repository handoff is addressed to ZaQ. Publication is not acknowledgement, merge, deployment or live-OIDC acceptance. Existing deployment/schema/backup prerequisites in the invitation contract still apply. Production, preserved databases and real tenant business data were not modified.

Frontend fallback was used after raQel HTTP accepted the task but its consumer was found inactive/absent. The queued task was marked blocked before local implementation to prevent later duplicate edits. No raQel review is claimed.
