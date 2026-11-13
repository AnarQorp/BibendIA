#!/usr/bin/env bash
set -euo pipefail
# Disposable database only. No inherited application/migrator URL is ever used.
container="bibendia-initial-admin-test-$$"
database="bibendia_initial_admin_test"
password="disposable-bootstrap-test"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run -d --name "$container" -p 127.0.0.1::5432 -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB="$database" postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d "$database" >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 30 ]; then echo 'Ephemeral PostgreSQL unavailable' >&2; exit 1; fi
  sleep 1
done
port="$(docker port "$container" 5432/tcp | sed 's/.*://')"
export BIBENDIA_TEST_DATABASE_URL="postgresql://postgres:$password@127.0.0.1:$port/$database"
export DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL" API_DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL" WORKER_DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL" MIGRATOR_DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL"
export BIBENDIA_INITIAL_ADMIN_TEST_CONTAINER="$container"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" < server/bootstrap/001_database_capabilities.sql >/dev/null
npm run build:server
mkdir -p server/dist/migrations
cp server/migrations/*.sql server/dist/migrations/
node server/dist/src/persistence/migrate.js
npx tsx server/test/bootstrap/initial-global-admin.ts
npx vitest run --config server/vitest.integration.config.ts server/test/integration/platform-admin-p0-9.test.ts server/test/integration/workshop-invitations.test.ts server/test/integration/repair-knowledge-coverage-02.test.ts
echo 'PASS: isolated initial-global-admin gate; disposable container removed on exit'
