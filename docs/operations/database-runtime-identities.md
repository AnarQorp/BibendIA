# PostgreSQL runtime identities

P0.1 defines three NOLOGIN capability roles. They are created by the explicit database bootstrap,
before application migrations run:

- `bibendia_migrator`: owns schema objects and applies migrations;
- `bibendia_api`: tenant-domain API access under forced RLS;
- `bibendia_worker`: Outbox claim/update access under forced RLS.

There are two deliberately separate trust boundaries:

1. An ephemeral **bootstrap identity** is the database owner (or equivalent administrator). It runs
   `server/bootstrap/001_database_capabilities.sql` once and on recovery/restart if needed. That
   script creates or validates only the three NOLOGIN capability roles, installs `pgcrypto`, and
   transfers the `public` schema to `bibendia_migrator`. It is restart-safe and is not supplied to
   any application container.
2. The **runtime migrator identity** is an unprivileged LOGIN granted only
   `bibendia_migrator`. The migrator immediately assumes that role and applies 001–011. It has no
   `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, API or Worker capability.

Application migrations never create, rename or grant cluster roles. This is required because a
least-privilege migrator cannot safely bootstrap or administer its own role membership.

Run the bootstrap as the database owner:

```sh
psql --no-psqlrc --set=ON_ERROR_STOP=1 "$BOOTSTRAP_DATABASE_URL" \
  --file server/bootstrap/001_database_capabilities.sql
```

ZaQ's infrastructure workstream then provisions one LOGIN identity per process, stores independent
passwords in the runtime secret store and grants each identity exactly one capability role. This SQL
is executed by the same bootstrap identity; names may be environment-prefixed:

```sql
CREATE ROLE bibendia_api_login LOGIN PASSWORD '<secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bibendia_api TO bibendia_api_login;

CREATE ROLE bibendia_worker_login LOGIN PASSWORD '<different-secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bibendia_worker TO bibendia_worker_login;

CREATE ROLE bibendia_migrator_login LOGIN PASSWORD '<different-secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bibendia_migrator TO bibendia_migrator_login;
```

Revoke the bootstrap credential after provisioning (or retain it only in the infrastructure-owned,
audited break-glass path). It is never a value of `MIGRATOR_DATABASE_URL`.

The application receives separate `API_DATABASE_URL`, `WORKER_DATABASE_URL` and
`MIGRATOR_DATABASE_URL` secrets. Production startup fails if its process-specific URL is absent;
the shared `DATABASE_URL` fallback is development/test only.

The migrator credential is available only to the migration job, never to API or worker services.
Credential creation/rotation and capability-role bootstrap belong to infrastructure. Object grants,
object ownership after bootstrap, and RLS remain canonical application migrations.

## Existing databases and historical migrations

This correction changes historical migrations 001–003 because the project is still preproduction
and clean installs must never execute role administration as `bibendia_migrator`. A database that
already records 001–011 is an upgrade/no-op path: the migration ledger remains unchanged and a
restart executes no SQL migration again. Running the bootstrap against it only validates safe role
attributes, ensures `pgcrypto`, and restores the intended schema owner.

A database stopped after the old 001 or 002 can continue after bootstrap. Revised 003 revokes all
object access from the legacy `bibendia_runtime` role without requiring `CREATEROLE`; infrastructure
may drop that now-unused role after verifying that no login retains it. No application process may
use `bibendia_runtime`.
