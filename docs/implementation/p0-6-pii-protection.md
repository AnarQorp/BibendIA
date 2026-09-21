# P0.6 PII Protection Report

Status: complete in the isolated branch; stopped before P0.7.

Canonical inventory and policy: [pilot PII protection](../security/pii-protection-pilot.md).

## Delivered

- AES-256-GCM application protection port with versioned keyring, fresh nonce, authentication tag
  and tenant/field-bound AAD.
- Separate HMAC-SHA-256 keyring for exact, tenant-bound plate/phone lookup and rotation overlap.
- Protected persistence for customer names/optional phone, vehicle plates, message confirmation text
  and appointment free-form symptoms/notes.
- Minimized ActionIntent, Inbox, Outbox and Audit evidence. Provider request bodies remain memory-only;
  Inbox persists only their digest and authenticated metadata.
- Workshop decryption only after authentication, membership, capability, lifecycle and RLS.
- A dedicated redacted Platform appointment projection; Support cannot request or receive PII.
- Structured safe-error logging and secret-header redaction. No exception/request dump.
- Legacy quarantine: renamed legacy columns plus `legacy_review_required`; protected reads exclude them.
- Retention/purge markers without an unapproved destructive job or invented legal claim.

## Deliberate boundaries

- No transcript/audio ingestion. Provider-side retention remains a provider/configuration decision.
- No partial plate search.
- No paid KMS/HSM dependency; environment-injected keyrings are compatible with a future secret/KMS
  adapter without changing domain/storage envelopes.
- No live legacy transformation or deletion. It requires backup, inventory and explicit approval.
- No P0.7 purge worker, retry/dead-letter or full Outbox work.

## Deployment dependency

Migration 007 must ship with an API configured with all four `PII_*` settings. Applying the schema
without compatible keys intentionally makes PII flows fail closed. ZaQ must not apply it to a live DB
until the legacy inventory and one-time migration plan have been reviewed.
