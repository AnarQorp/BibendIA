# VS02.1 real scheduling acquisition

The pilot scheduler models one temporal capacity lane per workshop. It deliberately does not
model mechanics, lifts, skills, shifts, parts, priority or optimization. PostgreSQL is the
availability authority.

## Workshop fixture

`workshops.timezone` must be an IANA timezone. `opening_hours` is keyed by ISO weekday (`1` is
Monday, `7` is Sunday), with local half-open operating intervals:

```json
{"1":[{"start":"09:00","end":"17:00"}],"2":[{"start":"09:00","end":"17:00"}]}
```

An empty schedule produces no slots. The query window is an explicit UTC interval, cannot begin
in the past, and is capped at 31 days. Results are deterministic 15-minute candidates, ordered by
start time and capped at 20.

## Token sequence

1. `findSlots` returns a random opaque candidate token backed by a short-lived database row.
2. `holdSlot` revalidates that candidate under a PostgreSQL workshop advisory transaction lock.
3. A successful hold returns a different random opaque hold token, valid for 30–900 seconds.
4. `createAppointmentTransactional` requires the hold token, tenant/workshop, exact interval,
   duration and capacity request to match. It consumes the hold in the same transaction that
   inserts the appointment.

Tokens contain no PII or authority by themselves. Missing, altered, expired, cross-tenant and
already-consumed tokens fail closed. Idempotent replay returns the already-created appointment;
it cannot consume the hold again or create another appointment.

## Future ElevenLabs wiring (not implemented here)

The provider adapter asks Core for candidates, verbalizes only the returned times, submits the
selected candidate token to Core for a hold, and retains the returned hold token unchanged. Only
after explicit customer confirmation may it pass that hold token to the existing appointment
tool. The model cannot mint or edit tokens and never decides availability.

No HTTP endpoint is added in VS02.1. The functions are Core/port operations for a later approved
provider boundary. Required vertical-slice fixtures are tenant, workshop timezone/opening hours,
protected customer and vehicle with their relation, and Workshop membership for the read model.

## Deliberate limits

Capacity is one temporal lane for the whole workshop; the stored capacity requirements bind the
hold to the confirmed request but are not a resource planner. Expired candidate/hold rows remain
non-authoritative history until a separately approved retention process exists. The existing
appointment tool still uses the pilot policy facts/configuration embedded in that flow; tenant-
effective policy wiring remains a VS02 follow-up and was not required to prove scheduling
acquisition. Provider transport and any HTTP surface remain VS02.2 decisions.
