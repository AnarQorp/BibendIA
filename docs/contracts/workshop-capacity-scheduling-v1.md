# Workshop Capacity & Scheduling v1

Scheduling remains the single authority for reservable time. Both Workshop Agenda and voice must use the existing `find-slots` → `hold-slot` → `create-appointment` flow; clients must not calculate capacity locally.

## Capacity policy

The canonical policy is `workshops.capacity_policy`. All counts are non-negative integers and the policy is valid only when every required field and either an exact service-intent rule or the explicit fallback are present.

```json
{
  "version": "v1",
  "liftCount": 2,
  "nonLiftBayCount": 1,
  "concurrentTechnicians": 3,
  "maxVehiclesOnSite": 8,
  "maxVehicleIntakesPerHour": 2,
  "resourceRequirements": {
    "rules": {
      "inspection": { "mechanic": 1, "lift": 0, "genericBay": 1 },
      "oil_service": { "mechanic": 1, "lift": 1, "genericBay": 0 },
      "brakes_or_noise": { "mechanic": 1, "lift": 1, "genericBay": 0 },
      "generic_fault": { "mechanic": 1, "lift": 0, "genericBay": 1 }
    },
    "fallback": { "mechanic": 1, "lift": 0, "genericBay": 1 }
  }
}
```

This baseline is owned by backend migration 025 and is the default for new Workshops. The contract is intentionally extensible without coupling Scheduling to Repair Knowledge. Missing or invalid configuration fails closed; the API never invents zero-cost work or capacity.

Opening hours remain in `workshops.opening_hours`, and durations remain in `workshops.service_duration_policy`. The server resolves duration and resource requirements from `serviceIntent`; frontend values are not authoritative.

## Workshop configuration API

- `GET /v1/workshop/tenants/:tenantId/workshops/:workshopId/capacity`
- `PATCH /v1/workshop/tenants/:tenantId/workshops/:workshopId/capacity`
- `GET /v1/workshop/tenants/:tenantId/workshops`

Capacity read/write uses one stable transport shape: `opening_hours`, `service_duration_policy`, `capacity_policy`, `vehiclesCurrentlyOnSite`, and `version`. `vehiclesCurrentlyOnSite` is derived from canonical appointments in `on_site`, `in_progress`, `waiting`, or `completed`; it is never writable configuration. Request bodies use `openingHours`, `serviceDurationPolicy`, and `capacityPolicy`.

The Workshop list is an appointment-read discovery endpoint for Agenda, including Reception. It returns only `id`, `tenant_id`, `name`, `timezone`, and `version`; policy details remain on the capacity endpoint.

The patch accepts `idempotencyKey`, `expectedVersion`, and any changed canonical policies. It is restricted to Workshop `OWNER`/`MANAGER`, is tenant scoped, uses optimistic concurrency, deterministic replay, payload-conflict rejection, and audit receipts. `RECEPTION` is not authorized.

## Appointment contract

Appointment creation accepts optional `customerWaitMode`: `DROP_OFF` (default) or `WAIT_ON_SITE`. It is stored once on the Appointment, not copied to ReceptionCase or Estimate.

Operational state changes use:

- `PATCH /v1/workshop/tenants/:tenantId/appointments/:appointmentId/status`
- Body: `expectedVersion`, `idempotencyKey`, `status`

Supported lifecycle: `tentative`, `held`, `confirmed`, `awaiting_arrival`, `on_site`, `in_progress`, `waiting`, `completed`, `delivered`, `cancelled`. Capacity occupancy is derived from these states.

## Availability behavior

For each candidate interval, Scheduling validates opening hours, server-resolved duration, technicians, lift/non-lift bay, vehicles on site, intakes in the workshop-local clock hour, active holds, and appointments. Hold and appointment confirmation repeat the checks under a workshop-scoped PostgreSQL advisory lock, so concurrent requests cannot both consume the final resource.

Capacity failures are contractual 422 errors (for example invalid/incomplete policy, unresolved resources, resource exhausted). Tenant access remains fail-closed. Google Calendar is not consulted in v1.
