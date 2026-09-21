# BibendIA pilot PII protection

Status: P0.6 technical policy. GDPR-aware engineering control, not a legal compliance or
certification claim.

## Inventory and handling decision

| Category | Current ingress/storage | Classification | Pilot decision |
|---|---|---|---|
| Customer name | Voice tool; `customers` | direct identifier | store only AES-GCM protected; reveal only to authorized Workshop flows |
| Customer phone | Twilio `From`; optional customer record | direct identifier | do not retain caller ID from webhook; if product needs a customer phone, protect it and use tenant-bound HMAC exact lookup |
| Email | OIDC profile in future | direct identifier | not currently persisted by the product; do not add in P0.6 |
| Vehicle plate | Voice tool; `vehicles` | indirect/direct identifier depending context; small domain | AES-GCM protected plus keyed, tenant-bound HMAC exact lookup; no plaintext/simple hash/partial search |
| Customer/vehicle UUIDs | relational tables and events | pseudonymous identifier | keep where needed for integrity/idempotency; never treat as anonymous |
| Conversation confirmation | tool body; `messages` | conversation PII | encrypt the minimum confirmation text; plaintext metadata only says confirmation occurred |
| Full transcript/audio | ElevenLabs event/provider | highly sensitive conversation content | BibendIA does not ingest it in the pilot; retain only provider IDs/digests. Provider-side retention is a separate decision |
| Caller ID | signed Twilio body | direct identifier | used in memory for signature/request handling, not persisted or logged |
| Provider raw payload | request memory | may contain PII/secrets | hash for replay; do not persist body. Inbox stores digest, IDs, timestamps and principal only |
| Symptoms/notes/recommendations | appointment command | may contain sensitive/free-form PII | encrypt together as appointment sensitive details; plaintext appointment columns remain empty for new rows |
| Service intent/duration/capacity | appointment | operational, normally non-PII | keep minimized plaintext for scheduling/querying |
| ActionIntent | command record | may accidentally duplicate PII | store only IDs and slot token; no transcript, name, plate, symptoms or notes |
| Outbox | event dispatch | duplication risk | store event type + aggregate/appointment ID only |
| Audit/Action Ledger | evidence | pseudonymous/security data | store actor/entity/correlation/evidence refs, not raw PII or payloads |
| Logs/errors | runtime | accidental disclosure channel | structured allowlisted error attributes; secret-header redaction; no request/error object dump |
| User profile name | `users` | direct identifier | optional; absent by default. If later retained, it must use protected columns |
| Workshop/tenant name, make/model | master/product data | normally business/non-personal | infrastructure encryption only for pilot; reassess sole-trader/free-text use |

## Cryptographic design

- Application-level encryption: Node.js maintained `crypto` implementation of AES-256-GCM.
- Fresh random 96-bit nonce per value and 128-bit authentication tag.
- AAD: `bibendia-pii-v1 + scope/tenant ID + semantic field`; ciphertext cannot be moved between
  tenant or field without authentication failure.
- Stored separately: ciphertext, nonce, authentication tag and key ID.
- Exact lookup: HMAC-SHA-256 with a distinct lookup key over version, tenant ID, field and normalized
  value. This avoids an offline dictionary against plain plate hashes.
- Encryption and lookup keys are separate. Multiple read/lookup versions may coexist; new writes use
  only the configured active IDs.
- Partial/fuzzy plate lookup is not implemented.
- PostgreSQL/storage encryption, TLS and encrypted backups remain infrastructure controls owned by
  ZaQ and do not replace application encryption.

## Runtime secrets and fail-closed behavior

Required for every API runtime after migration 007:

- `PII_ENCRYPTION_KEYS_JSON`: JSON object `{ "enc-2026-01": "<base64 32 bytes>" }`.
- `PII_ACTIVE_ENCRYPTION_KEY_ID`: ID used for new ciphertext.
- `PII_LOOKUP_KEYS_JSON`: separate JSON object of base64 32-byte HMAC keys.
- `PII_ACTIVE_LOOKUP_KEY_ID`: lookup key used for new digests.

Missing, malformed, unknown-version, wrong or altered material fails closed. Secrets never belong in
Git, PostgreSQL, frontend bundles, logs or audit. ZaQ owns runtime injection, protected backup and
rotation operations. naQor owns formats, compatibility and re-encryption/reindex behavior.

Rotation sequence: add new key alongside old, deploy readers, switch active ID, re-encrypt/reindex
rows in a controlled migration, verify, then remove the old key. Lookup reads calculate candidates
for every configured lookup-key version during the transition.

## Legacy migration

Migration 007 never assumes that old `*_ciphertext` or hashes were real protection. It renames them
to explicit `*_legacy_*` columns and marks existing records `legacy_review_required`. Product reads
only `protected` rows. No legacy value is deleted or returned through the protected API.

Before any live application of 007:

1. make and verify a backup (ZaQ);
2. inventory/count legacy rows without exporting values;
3. load approved runtime keys through the secret boundary;
4. run a dedicated, reviewed one-time migrator that encrypts rows tenant by tenant and clears legacy
   columns in the same transaction;
5. verify counts, decrypt samples under authorization, RLS and lookup behavior;
6. retain rollback evidence, then approve removal of legacy columns in a later migration.

The one-time live migrator is deliberately not run or automated in P0.6 because the current live-data
truth and retention approval are unknown. `legacy_review_required` is a blocking quarantine, not a
silent compatibility path.

## API/support exposure

Workshop appointment reads decrypt only after PrincipalContext, membership, capability,
TenantContext, lifecycle and RLS checks. Platform `SUPPORT_READONLY` receives a dedicated redacted
appointment projection containing operational IDs/status/times only. It cannot request decryption,
impersonate a Workshop user or obtain the ciphertext envelope through APIs.

## Retention and purge preparation

Migration 007 adds nullable `retention_expires_at` and `purge_requested_at` markers to messages,
calls, appointments, Inbox, Outbox and Audit. No blind deletion job is introduced. P0.7 may consume
approved markers but cannot invent periods.

Proposed technical starting values, all **DECISION REQUIRED before production activation**:

- full transcript/audio: not stored by BibendIA; configure provider minimum retention;
- encrypted confirmation/message content: 90 days after case closure;
- Inbox replay digests: 30 days after receipt;
- successfully published Outbox: 30 days after publication; unresolved/dead-letter retained until resolution;
- application logs: 14 days, with no PII by design;
- security/admin audit: 365 days;
- operational customer/vehicle/appointment data: while tenant active, then a separately approved
  deactivation grace/anonymization period.

Legal hold, contractual commitments, customer requests, backup expiry and tax/repair-record duties
need legal/product approval. P0.6 makes expiry explicit but does not claim those periods are lawful.
