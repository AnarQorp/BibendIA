# Reception Case Foundation

## Audit and reuse decision

The pre-existing `reception_cases` table is the canonical case aggregate used by Scheduling and
Appointment Lifecycle. It is extended by migration 023; no second case model or parallel inbox is
introduced. Provider request replay continues to use `inbox_events`, while the Case carries a
tenant-scoped idempotency key and request digest for deterministic result replay.

Existing controls reused:

- forced tenant RLS and runtime roles;
- workshop capability authorization and provider binding;
- canonical Customer, Vehicle, Appointment and `estimate_drafts` relations;
- AES-256-GCM PII envelopes and tenant-bound AAD;
- `audit_events` for real create/update state changes.

## Canonical model

A Case has channel, caller type, category, priority, status, optional canonical entity links,
provider conversation reference, minimized provenance and lifecycle timestamps. Public workflow
states are `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `WAITING_WORKSHOP`, `RESOLVED`, and `CLOSED`.
Legacy internal scheduling states remain accepted only for compatibility with existing lifecycle
fixtures and are not accepted by the Case APIs.

Summary, detail and provisional contact context are encrypted. Canonical entity IDs are stored
instead of copied names, phones, email addresses or plates. Provenance must contain operational
references only, never free-form caller PII.

## Workshop API

- `POST /v1/workshop/tenants/:tenantId/reception-cases`
- `GET /v1/workshop/tenants/:tenantId/reception-cases` (bounded to 100; filters: status, category,
  channel, priority, customerId, vehicleId)
- `GET /v1/workshop/tenants/:tenantId/reception-cases/:caseId`
- `PATCH /v1/workshop/tenants/:tenantId/reception-cases/:caseId`

Manual creation always records channel `MANUAL`. Patch supports status, priority and canonical
Customer/Vehicle/Appointment/Estimate links. All linked entities must exist under the authorized
tenant.

## Voice tools

- `create-reception-case`: structured caller type, category, summary, optional encrypted detail or
  contact context, priority, provider conversation/request IDs and optional Reception Context token.
- `request-human-contact`: the same persistence path with category fixed server-side to
  `callback_request`. It never claims call transfer and cannot return success without a committed Case.

When a Reception Context token exists, Customer and Vehicle UUIDs are loaded server-side; the model
cannot submit those IDs. Without canonical resolution, a valid Case is persisted with null entity
links. Provider binding and Inbox authorization run before Case replay is returned. Exact replay
returns the same Case; changed payload under the same provider conversation/request ID fails closed.

## Explicit exclusions

No WhatsApp ingress, live transfer, supplier integration, automated estimates/status, customer
authorization, Appointment Lifecycle change or Worker adapter is included in this foundation.
