# P0.7 Worker / Outbox Reliability

Status: complete for the pilot boundary. No production external appointment publisher exists yet;
the runtime records `EFFECT_ADAPTER_NOT_CONFIGURED` as a permanent dead letter instead of claiming
delivery. Calendar and other speculative integrations are out of scope.

## State machine

`not_attempted -> in_progress -> succeeded`

From `in_progress` an explicit adapter result may become `failed_safe_to_retry`,
`unknown_outcome`, or `dead_letter`. Retry is bounded by `max_attempts` and exponential backoff
(2, 4, 8... seconds, capped at 300). Permanent errors and exhausted retries become dead letters.
Unknown outcomes are never claimed by the normal dispatcher.

An expired lease with no current `effect_started_at` means the worker died before crossing the
external-effect boundary and is safely reclaimable, even when an earlier retry attempt exists. An
expired lease after `effect_started_at` becomes
`unknown_outcome`, because the external side may have observed the request.

## Claim, lifecycle and shutdown

Claims use `FOR UPDATE SKIP LOCKED`, a lease owner/token and a 30-second lease. Worker tenant
discovery is a locked-down `SECURITY DEFINER` function exposing tenant IDs only; it does not grant
global direct table visibility. Each event operation still sets `app.tenant_id` and remains under
forced RLS. A session-level shared tenant advisory lock spans final policy validation, the external
call and durable finalization. Lifecycle/kill commands use the corresponding exclusive lock, giving
one committed ordering without treating an earlier claim as authorization.

On SIGTERM/SIGINT no new tenant/event is started. An unstarted claim expires and is safely
reclaimed. If shutdown interrupts an adapter after the effect boundary, the result is unknown and
requires reconciliation. Availability is deliberately secondary to duplicate prevention.

Events blocked by lifecycle/kill remain visible and unexecuted. `effect_valid_until` is a pilot
safety horizon (24 hours for current `appointment.created` events). When service resumes, expired
intent is dead-lettered as `EVENT_OBSOLETE`; it is not fired blindly.

## External guarantees for current effects

| Event | Local guarantee | External guarantee | Key / evidence | Timeout or crash |
|---|---|---|---|---|
| `appointment.created` | one durable event per appointment; concurrent claim exclusion; bounded attempts | none: no production adapter exists | stable `appointment.created:<appointment_id>`; receipt required before success | unavailable adapter is permanent dead letter; a future adapter must return receipt or unknown |

The port passes the stable key to future adapters. It does not assert exactly-once. A successful
HTTP status alone is insufficient: adapters must return a receipt reference/evidence. Evidence is a
small object of opaque IDs/statuses, never provider payloads or PII.

## Reconciliation

Only `unknown_outcome` is reconciled. An adapter may prove success with a receipt, prove failure and
classify retry safety, or leave the event unknown. Without a query/receipt mechanism the event
remains uncertain for explicit operator intervention. It never falls back into automatic dispatch.

## Operations

`GET /v1/platform/tenants/:tenantId/outbox` requires `platform:incidents:read` and returns counts,
oldest age, attempts and up to 100 attention items. It excludes payloads and PII. Tenant scope and
RLS remain mandatory. The endpoint supports future Admin v0; no frontend is added.

## Deferred / residual

- A real outbound provider adapter, its receipt semantics and query API require a separately
  approved product integration.
- P0.8 owns continuous supervision/readiness and production service packaging. P0.7 implements a
  safe single dispatcher pass and graceful stop behavior.
- Alert delivery and an operator command to resolve/manual-retry dead letters remain P1 incident
  workflow; state is visible now and cannot loop.
- P0.6 retention proposals remain decisions; this block adds no purge behavior.
