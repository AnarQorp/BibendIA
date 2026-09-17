# Vertical Slice 01 — Appointment by Voice

Status: PostgreSQL gate and initial 5+5 web voice gate completed.

## Current evidence

- Existing frontend production build passes without frontend feature changes.
- Server contracts type-check independently.
- The progressive plan produces five initial-gate calls and twenty post-gate calls per eligible provider.
- Automated tests cover critical provider discard conditions, truthful external receipts, supervised policy behavior and the scheduling model invariant.
- Provider credentials are now available from the external, non-repository file `/home/anarqorp/BibendIA/.env`; both control-plane APIs returned HTTP 200.
- PostgreSQL migration, RLS/runtime role, transactional appointment command, API read endpoint and outbox worker are implemented.
- The eight-way replay/concurrency test and cross-tenant RLS test pass against PostgreSQL.
- Five Vapi and five ElevenLabs browser voice sessions completed. The evidence and provisional provider decision are in `voice-provider-initial-gate.md`.

## Frozen scope

The critical path is:

`real call → tenant → conversation → customer/vehicle → service request → availability → explicit confirmation → one idempotent appointment → PostgreSQL → BibendIA read model`

P1: Google Calendar projection, telemetry/cost, transcript/artifacts and human transfer.

P2 and out of the critical path: WhatsApp, Lara, parts, real quotes, advanced scheduling, n8n and mobile.

## Implementation gates

1. Progressive voice bake-off: five initial calls per provider, early discard on a critical failure, then twenty comparable calls only for eligible providers.
2. Tenant isolation and idempotency integration tests pass against PostgreSQL.
3. The same provider event delivered repeatedly or concurrently creates exactly one appointment.
4. A real phone call creates a correct appointment with explicit confirmation evidence.
5. BibendIA reads the persisted call, case, appointment and action/audit records.
6. External effects are displayed as completed only when a verifiable provider receipt exists.

## Critical bake-off failures

- tenant mismatch;
- appointment created without explicit confirmation;
- more than one appointment for one confirmed command;
- provider artifacts/webhooks cannot be verified.

## Tenant supervised mode

`pilot_supervised` is a tenant policy setting. It tightens autonomy using the standard Policy/Approvals result and ledger. It must never branch into a separate execution engine.

## Scheduling invariant

Every appointment retains the complete `service_request`: intent, symptoms, notes, estimated duration and capacity requirements. Calendar events are projections and cannot replace this model.
