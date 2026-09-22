# ElevenLabs scheduling tools

Both routes reuse the P0.4 constant-time Bearer credential and active `ServicePrincipal` / `provider_bindings` resolution. Tenant and workshop are never accepted from the request.

## `POST /v1/providers/elevenlabs/tools/find-slots`

Strict JSON body: `providerCallId`, an operation-unique `requestId`, `durationMinutes` (15..480),
`windowFrom`, `windowTo`, and `limit` (1..5). Call/request IDs provide correlation
and replay identity only; they never grant tenant authority. The response exposes only
`disposition`, `candidateId`, `startAt`, `endAt`, `timezone`, and `expiresAt`. Timezone, tenant, and
workshop come from the server-side binding. Candidate identifiers are opaque UUIDs and expire
after ten minutes. Identical retries return the same active candidate identifiers; a reused
request identity with a different payload fails closed. PostgreSQL remains availability authority.

## `POST /v1/providers/elevenlabs/tools/hold-slot`

Strict JSON body: `providerCallId`, operation-unique `requestId`, and the opaque `candidateId`.
A successful response contains `disposition`, `slotToken`, `startAt`, `endAt`, and `expiresAt`.
The Core fixes the hold TTL at ten minutes. Replaying the same request/candidate returns the same
still-valid hold; invalid, expired, manipulated, cross-tenant, or unavailable candidates fail
with the same safe error.

A hold never creates an appointment. After the customer explicitly confirms, the agent passes the
unmodified `slotToken` to the existing `create-appointment` tool. The Core loads `operating_mode`,
`policy_version`, and ReceptionCase risk from the bound tenant state, records a minimized
`policy_evaluated` audit event, and then performs final hold validation and single-use consumption.
