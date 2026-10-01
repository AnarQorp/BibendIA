# Appointment lifecycle V3 capability safety

## Threat model

1. A candidate or hold stolen from another conversation could reserve the wrong slot.
2. A reception context replayed by another workshop or service principal could expose or mutate appointments.
3. Idempotency lookup before authorization could disclose a prior mutation result.
4. Repeated preparation requests could create competing active challenges.
5. Expired preparations marked `ready` could block cancellation indefinitely.
6. A hold for a different service, duration, or capacity policy could alter the job while appearing to only move time.
7. Agent-authored confirmation text could be mistaken for provider-backed customer evidence.

## Capability chain

The durable chain is:

`authenticated provider binding → reception context → candidate capability → hold capability → reschedule preparation → provider confirmation evidence → atomic reschedule`.

Capabilities are opaque UUIDs. Their binding is stored server-side in `action_intents`; the token itself carries no authority claims. Every read validates tenant, workshop, authenticated service-principal ID, provider, provider conversation, operation and expiry. Candidate and hold bindings additionally preserve service intent, duration, capacity requirements and searched window. No new table or migration is required; schema remains 022.

## Reception context

The server stores tenant/workshop, provider, service principal, provider conversation, caller lookup fingerprint, resolved Customer/Vehicle, relationship status and expiry. A declared phone never creates mutation authority. The caller fingerprint records which protected lookup evidence was used; it is not KYC.

## Scheduling capabilities

`find-slots` records one candidate capability per returned candidate. `hold-slot` accepts it only under the same provider session binding and emits a hold capability inheriting the complete scheduling contract. A token from a different conversation, workshop or principal fails closed.

## Reschedule preparation and expiry

The canonical preparation idempotency key is service principal + provider conversation + provider request ID. Exact Inbox replay returns the same logical token. Same request ID with a different body is rejected by the Inbox payload hash. Preparation binds the original Appointment/version, canonical context, hold, old/new interval and current authority.

Expiry is enforced on every read. Lazy cleanup transitions expired preparation intents to `expired`; only unexpired `ready` preparations block cancel. Successful reschedule consumes both preparation and capability.

Reschedule is time-only. The hold must match the Appointment service intent, required duration and capacity JSON exactly. Changing the job is outside this contract.

## Confirmation evidence boundary

`confirmationEvidenceRef` is an opaque reference verified by a configured provider adapter. The verifier must bind evidence to tenant, workshop, service principal, provider conversation and preparation token, and return a provider event time strictly after `preparedAt`. Free confirmation text and caller-supplied timestamps are rejected.

No verified real-time ElevenLabs turn/event contract is currently configured. Therefore production voice reschedule remains fail-closed with `PROVIDER_CONFIRMATION_EVIDENCE_REQUIRED`. Backend tests may use an explicitly labelled test verifier; they do not certify an ElevenLabs call.

## Replay semantics

Authorization and capability validation always precede reschedule idempotency lookup. Exact authorized replay returns the prior Appointment. A different conversation, principal, workshop, capability or payload cannot obtain it. Idempotency never substitutes for authorization.
