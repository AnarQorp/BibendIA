# PostgreSQL runtime identities

P0.1 defines three NOLOGIN capability roles in migrations:

- `bibendia_migrator`: owns schema objects and applies migrations;
- `bibendia_api`: tenant-domain API access under forced RLS;
- `bibendia_worker`: Outbox claim/update access under forced RLS.

ZaQ's infrastructure workstream provisions one LOGIN identity per process, stores independent
passwords in the runtime secret store and grants each identity exactly one capability role.
Illustrative SQL (names may be environment-prefixed):

```sql
CREATE ROLE bibendia_api_login LOGIN PASSWORD '<secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bibendia_api TO bibendia_api_login;

CREATE ROLE bibendia_worker_login LOGIN PASSWORD '<different-secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bibendia_worker TO bibendia_worker_login;

CREATE ROLE bibendia_migrator_login LOGIN PASSWORD '<different-secret>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bibendia_migrator TO bibendia_migrator_login;
```

The application receives separate `API_DATABASE_URL`, `WORKER_DATABASE_URL` and
`MIGRATOR_DATABASE_URL` secrets. Production startup fails if its process-specific URL is absent;
the shared `DATABASE_URL` fallback is development/test only.

The migrator credential is available only to the migration job, never to API or worker services.
Credential creation/rotation belongs to infrastructure; capability grants and RLS remain
canonical application migrations.
