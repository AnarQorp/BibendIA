# P0.8 Production runtime contract

Status: application contract for ZaQ; no deployment or live migration has been performed.

## Immutable artifacts

Build all images from one reviewed commit. Supply immutable metadata:

```sh
docker build --target api --build-arg APP_VERSION=1.0.0 --build-arg APP_COMMIT_SHA=<40-char-sha> -t bibendia-api:<sha> .
docker build --target worker --build-arg APP_VERSION=1.0.0 --build-arg APP_COMMIT_SHA=<40-char-sha> -t bibendia-worker:<sha> .
docker build --target migrator --build-arg APP_VERSION=1.0.0 --build-arg APP_COMMIT_SHA=<40-char-sha> -t bibendia-migrator:<sha> .
```

The multi-stage image compiles TypeScript in the build stage. Runtime images contain compiled JavaScript and the locked server-only production dependency set; only the migrator target contains SQL migrations and the version-matched bootstrap SQL under `dist/bootstrap`. They run as the non-root `node` user. No secret is a build argument. Deploy by immutable image digest; the OCI revision label and structured runtime logs identify the commit.

Targets and commands:

| Target | Command | Port | Database identity |
|---|---|---:|---|
| `api` | `node dist/src/api/main.js` | 3100 | login granted only `bibendia_api` |
| `worker` | `node dist/src/worker/main.js` | 3101 health only | login granted only `bibendia_worker` |
| `migrator` | `node dist/src/persistence/migrate.js` | none | login allowed to assume only `bibendia_migrator` |

No persistent application volume is required. stdout/stderr are the logging boundary; infrastructure owns collection, rotation and retention.

## Migration and release order

1. Take and test a database backup. Inventory `legacy_review_required` records; do not relabel plaintext as ciphertext.
2. For a new database, use the ephemeral database-owner credential to run `server/bootstrap/001_database_capabilities.sql`, then provision the three independent LOGIN identities exactly as documented in `database-runtime-identities.md`. Re-running the bootstrap is safe. Remove the bootstrap credential from the deployment path.
3. Stop writes or use the release procedure agreed by ZaQ. Run the exact release's migrator as a one-shot job with `MIGRATOR_DATABASE_URL`.
4. The migrator takes migrations in lexical order and records each transaction in `schema_migrations`. Re-running is a no-op.
5. Verify the table contains exactly `001_vertical_slice.sql` through `010_real_scheduling_acquisition.sql`.
6. Start API and disabled Worker using distinct credentials. Route traffic only after readiness passes.

API and Worker never invoke migrations. Their roles are explicitly revoked from `schema_migrations` and cannot own/alter schema. Production migration refuses to proceed unless its login can assume `bibendia_migrator`. The runtime migrator cannot create or grant roles; cluster role administration and the database-level `pgcrypto` prerequisite exist only at the bootstrap boundary. Readiness fails closed when the schema is older, newer or divergent from the artifact.

Migrations are forward-only. SQL/file rollback is not promised and schema rollback may lose meaning or data. For a failed irreversible release: stop traffic, preserve evidence, restore the tested backup, deploy the prior artifact/schema pair, and reconcile external effects before reopening. Existing tenants are deliberately placed into `pilot` by migration 006. Migration 007 preserves legacy values as `legacy_review_required`; those records need the separately controlled PII transformation before production service.

## Health and process semantics

- API `GET /health/live`: process-only liveness; no external calls.
- API `GET /health/ready`: validates API DB connectivity, exclusive runtime membership in `bibendia_api`, and exact schema 001–010. PII keyrings and all startup configuration were already validated before listen.
- Worker `GET /health/live`: process-only liveness.
- Worker `GET /health/ready`: validates Worker DB connectivity, membership in `bibendia_worker`, exact schema, and reports `mode: disabled`.
- Health responses use stable status/error codes only and never return URLs, credentials, exception text, PII or provider responses.
- Twilio/ElevenLabs outages do not affect health.

The Worker defaults to `WORKER_MODE=disabled`. This is a deliberate safe operational mode, not a simulated adapter. Any other value is rejected at startup until a reviewed production outbound adapter is implemented in a later block, so this artifact cannot claim or execute Outbox effects. Enablement requires a new compatible artifact and explicit release approval.

SIGTERM makes API stop accepting connections, drain Fastify work and close its pool. Worker stops its health listener and closes its pool; because it is disabled it holds no claims. Both have a bounded `SHUTDOWN_TIMEOUT_MS`, after which they exit non-zero.

## Runtime configuration matrix

| Variable | Process | Required | Secret | Format / missing behavior | Rotation / restart |
|---|---|---|---|---|---|
| `NODE_ENV` | all | yes | no | `production` in production | restart |
| `APP_VERSION` | all | yes | no | release identifier; refuses missing | image metadata; rebuild/restart |
| `APP_COMMIT_SHA` | all | yes | no | 7–64 hex chars; refuses missing/invalid | image metadata; rebuild/restart |
| `API_DATABASE_URL` | API | yes | yes | PostgreSQL URL for API-only login; refuses missing in production | rotate credential + restart |
| `WORKER_DATABASE_URL` | Worker | yes | yes | PostgreSQL URL for Worker-only login | rotate credential + restart |
| `MIGRATOR_DATABASE_URL` | migrator | yes | yes | PostgreSQL URL, migrator membership required | per job; rotate freely |
| `WORKSHOP_ORIGIN` | API | yes | no | absolute URL origin, no trailing slash | restart |
| `PLATFORM_ORIGIN` | API | yes | no | distinct absolute URL origin, no trailing slash | restart |
| `PUBLIC_API_BASE_URL` | API | conditional | no | URL; required only when provider ingress configured | restart |
| `PORT` | API | no | no | 1–65535; default 3100 | restart |
| `WORKER_HEALTH_PORT` | Worker | no | no | 1–65535; default 3101 | restart |
| `WORKER_MODE` | Worker | no | no | must be `disabled`; default disabled; other values refuse startup | new approved artifact required |
| `WORKER_ID` | Worker | no | no | non-secret operational instance label; defaults to process id | restart |
| `SHUTDOWN_TIMEOUT_MS` | API/Worker | no | no | integer 1000–60000; default 10000 | restart |
| `PII_ENCRYPTION_KEYS_JSON` | API | yes | yes | JSON key-id to base64 32-byte keys; invalid/missing refuses startup | add versions + restart before re-encryption |
| `PII_ACTIVE_ENCRYPTION_KEY_ID` | API | yes | no | existing key id | restart; retain referenced old keys |
| `PII_LOOKUP_KEYS_JSON` | API | yes | yes | separate JSON keyring, base64 32-byte keys | add versions + restart before reindex |
| `PII_ACTIVE_LOOKUP_KEY_ID` | API | yes | no | existing lookup key id | restart; retain referenced old keys |
| `TWILIO_SERVICE_PRINCIPAL_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | API | conditional group | token secret | all three or none | rotate + restart |
| `ELEVENLABS_WEBHOOK_SERVICE_PRINCIPAL_ID`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET` | API | conditional group | webhook secret | all three or none | rotate + restart |
| `ELEVENLABS_TOOL_SERVICE_PRINCIPAL_ID`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_TOOL_SECRET` | API | conditional group | tool secret | all three or none | rotate + restart |

`DATABASE_URL` is development fallback only and must not be supplied as a shared production credential. `PUBLIC_API_BASE_URL` is public configuration. All URLs and keyrings enter at runtime; none belong in an image or Compose file committed to Git.

## Logging and rollback checks

API logs are structured JSON from Fastify with service/version/commit base fields and request correlation ID. Worker emits structured JSON with timestamp, level, service/version/commit and operational mode. Existing redaction removes Authorization, cookies, signatures, tokens and named PII. Never log raw payloads, ciphertext, connection URLs or keyrings.

Before traffic, verify the deployed image digest and `org.opencontainers.image.revision`, then check readiness. Rollback is safe only to an artifact declaring compatibility with the current schema; otherwise restore the corresponding backup/schema. Worker remains disabled during rollback. Never blindly replay `unknown_outcome` or old blocked events.
