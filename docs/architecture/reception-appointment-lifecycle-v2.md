# Reception context and appointment lifecycle V2

## Authority boundary

Voice tools never accept a customer or vehicle UUID as authority. `resolve-reception-context` may issue an opaque, expiring `receptionContextToken` only when the provider-supplied caller number resolves uniquely to a canonical Customer and the requested Vehicle is canonically associated with that Customer. A phone spoken by the caller may support search, but never issues mutation authority.

`system__caller_id` and `system__conversation_id` are treated as provider-supplied only at the authenticated ElevenLabs ingress. This is not KYC. Its assurance depends on the ElevenLabs tool secret, protected dynamic-variable binding, and an authenticated Zadarma/SBC path with caller-ID sanitization.

## Contracts

- `resolve-reception-context`: provider conversation/request IDs plus provider caller phone or declared phone and optional plate. Returns unique/multiple/not-found results and, only for sufficient provider context, an opaque reception token.
- `list-future-appointments`: provider conversation and reception token. It cannot select arbitrary entity UUIDs.
- `create-appointment`: provider conversation/request IDs, reception token, idempotency key, confirmed held slot and service data. Canonical entity IDs are loaded server-side.
- `cancel-appointment`: reception token, selected appointment/version, reason, origin, confirmation and idempotency key. A successful cancel consumes that reception token; it cannot then authorize a replacement create. Cancel is rejected while a prepared reschedule exists.
- `prepare-reschedule`: reception token, selected appointment/version and hold. Returns an opaque context binding appointment, version, hold, proposed interval and provider conversation.
- `reschedule-appointment`: the prepared context, provider conversation, post-hold confirmation transcript and idempotency key. It has no free appointment, hold, timestamp or confirmation-boolean fields.

All provider routes claim the Inbox request before mutation. Domain retries additionally use ActionIntent idempotency keys and optimistic appointment versions.

## Provisional relationship semantics

`customer_vehicle_roles.verification_status=provisional` means the canonical Customer and Vehicle may be associated with a booking, but ownership or authority over the Vehicle has not been verified. Booking preserves both UUIDs without changing this status. `verified` may be assigned only by explicit workshop reconciliation, a trusted import carrying reviewable provenance, or a future dedicated verification ceremony. A voice statement, name/plate match, booking, or implementation convenience never promotes it.

## Atomic reschedule

The existing Appointment UUID is retained. In one transaction the prepared context and optimistic version are checked, the hold is locked and consumed, the appointment interval and version are updated, confirmation evidence is persisted, and an audit receipt is written. Any failure rolls back every step. No `appointment.created` event is emitted for reschedule and the Worker registry is unchanged.
