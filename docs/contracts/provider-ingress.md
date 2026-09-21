# Provider ingress contract

Status: P0.4 implemented; not deployed or configured against live providers.

All routes are deny-by-default and require a `service` principal with `provider` audience.
Provider identifiers in body, URL or headers are assertions to validate, never tenant authority.

## Twilio voice events

`POST /v1/providers/twilio/voice/events`

- Content type: `application/x-www-form-urlencoded`.
- Authentication: `X-Twilio-Signature`, validated with the Twilio SDK against the exact configured
  `PUBLIC_API_BASE_URL`, request path, all form parameters and the account Auth Token.
- Required fields: `AccountSid`, `CallSid`, `To` in E.164.
- Tenant resolution: authenticated service principal + active provider binding + exact `To` DID.
- Replay key: `CallSid + CallStatus + SequenceNumber`; identical delivery returns `duplicate`, a
  conflicting payload returns `403 REPLAY_CONFLICT`.

## ElevenLabs conversation events

`POST /v1/providers/elevenlabs/conversations/events`

- Content type: `application/json`; the unmodified body is retained for verification.
- Authentication: official ElevenLabs SDK verification of `ElevenLabs-Signature` HMAC and its
  timestamp tolerance.
- The signed `agent_id` must equal the authenticated service principal binding.
- Tenant resolution never uses caller metadata or a tenant/workshop value in the payload.
- Retry identity uses event type, conversation ID and event timestamp in `inbox_events`.

## ElevenLabs appointment tool

`POST /v1/providers/elevenlabs/tools/create-appointment`

- Authentication: a dedicated high-entropy Bearer secret configured as an ElevenLabs webhook-tool
  secret. It is distinct from API keys and webhook HMAC secrets.
- ElevenLabs webhook tools do not emit the workspace webhook HMAC. Therefore this synchronous tool
  uses the provider-supported secret header plus TLS, a dedicated service principal, server-side
  binding and Inbox/idempotency replay controls.
- The tool body contains appointment facts and `providerCallId`; it no longer accepts provider,
  external account, tenant or workshop authority.
- Tenant/workshop come exclusively from the active service-principal binding.

Successful ingress returns `200` with `ok`, `disposition` and `correlationId`. Missing/invalid
credentials return `401`; valid credentials without a unique active binding return `403`.

