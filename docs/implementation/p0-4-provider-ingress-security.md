# P0.4 Provider Ingress Security Report

Status: complete in the isolated branch; stopped before P0.5.

## Delivered

- `ProviderAuthenticationAdapter` with provider-specific verification and fail-closed defaults.
- Twilio signature verification through the official SDK using a configured canonical public URL.
- ElevenLabs webhook raw-body HMAC and timestamp verification through the official SDK.
- A dedicated constant-time Bearer credential for the synchronous ElevenLabs appointment tool,
  matching ElevenLabs' supported webhook-tool authentication model.
- `service_principals` and `provider_bindings`; database rows hold only `credential_ref`, never the
  secret itself.
- Provider authorization transaction that validates the active principal, resolves exactly one
  active binding, sets trusted `app.tenant_id`, then executes under forced RLS.
- Inbox payload hashes, authenticated principal, correlation, provider event time and signature
  verification time. Identical retries are idempotent; conflicting replays fail closed.
- The appointment tool now receives an already-authorized `TenantContext`; provider/account/tenant
  selection was removed from its input contract.
- Legacy `/v1/voice/tools/create-appointment` is gone.

## Trust sequence

```text
raw provider request
  -> route-specific credential/signature verification
  -> ServicePrincipal (no tenant authority)
  -> active service_principal row
  -> unique active provider_binding / channel_endpoint
  -> trusted TenantContext
  -> Inbox replay claim
  -> handler/domain action under forced RLS
```

For Twilio, `AccountSid` is verified against the configured principal and `To` selects only among
that principal's server-side bindings. For ElevenLabs, the configured webhook/tool secret selects
the service principal; signed webhook `agent_id` must also match. Caller metadata is never used as
authorization.

## Verification

- Valid and invalid Twilio signatures.
- Exact canonical webhook URL and account binding.
- Valid, altered and stale ElevenLabs HMAC.
- Correct and incorrect tool Bearer secret.
- Known DID accepted; manipulated/unknown DID denied.
- Bound ElevenLabs agent accepted; other signed agent denied.
- Identical retry deduplicated; same event ID with another hash rejected.
- Suspended service principal denied.
- Deliberately unfiltered tenant query remains contained by RLS.
- Clean PostgreSQL 17 migration `001` through `005`, then no-op second migration pass.

## Residual decisions

- The exact live Twilio callback URL must equal `PUBLIC_API_BASE_URL` plus the route after ZaQ's
  proxy/TLS configuration; forwarded host/protocol headers are intentionally not trusted.
- ElevenLabs tool calls support secret headers rather than per-request HMAC. For the pilot the
  control is a dedicated rotatable secret, TLS, one service principal per agent, binding and replay
  protection. Reassess a signing gateway only if the provider adds native signing or risk grows.
- Lifecycle/kill switch enforcement at the final action boundary remains P0.5.

## ZaQ coordination (future deployment only)

Provision and rotate these through the runtime secret mechanism, never Git or PostgreSQL:

- `PUBLIC_API_BASE_URL` (non-secret canonical external API origin);
- `TWILIO_SERVICE_PRINCIPAL_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`;
- `ELEVENLABS_AGENT_ID`;
- `ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID`, `ELEVENLABS_WEBHOOK_SECRET`;
- `ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID`, `ELEVENLABS_TOOL_SECRET`.

Partial provider configuration aborts process startup. Migration `005` must eventually be applied
after `003` and `004` together with the compatible artifact. Nothing was applied to the live DB.

