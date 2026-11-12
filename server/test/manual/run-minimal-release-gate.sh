#!/bin/bash
set -euo pipefail

CONTAINER_NAME="bibendia-minimal-release-$$"
DB_NAME="bibendia_ephemeral_test"
PG_PASS="ephemeral-secret-pass"
MIGRATOR_PASS="migrator-pass-$$"
API_PASS="api-pass-$$"
WORKER_PASS="worker-pass-$$"

pending="server/dist/migrations/041_workshop_invitations.pending"
migration="server/dist/migrations/041_workshop_invitations.sql"

cleanup() {
  if [ -f "$pending" ]; then mv "$pending" "$migration"; fi
  echo "🧹 Cleaning up ephemeral container $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "🐳 Starting isolated ephemeral PostgreSQL container: $CONTAINER_NAME..."
docker run -d --name "$CONTAINER_NAME" -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD="$PG_PASS" -e POSTGRES_DB="$DB_NAME" postgres:17-alpine >/dev/null

echo "⏳ Waiting for ephemeral PostgreSQL to become ready..."
attempt=0
until docker exec "$CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" -Atc 'SELECT 1' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "❌ Ephemeral PostgreSQL did not become ready" >&2; exit 1; }
  sleep 1
done

PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | sed 's/.*://')"
echo "✅ Ephemeral PostgreSQL ready on 127.0.0.1:$PORT (isolated from 55432)"

echo "🔧 Bootstrapping capabilities and roles..."
docker cp server/bootstrap/001_database_capabilities.sql "$CONTAINER_NAME":/tmp/bootstrap.sql >/dev/null
docker exec "$CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" -f /tmp/bootstrap.sql >/dev/null

docker exec "$CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" -c "
  CREATE ROLE bibendia_migrator_login LOGIN PASSWORD '$MIGRATOR_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  ALTER ROLE bibendia_migrator_login SET role = 'bibendia_migrator';
  CREATE ROLE bibendia_api_login LOGIN PASSWORD '$API_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  CREATE ROLE bibendia_worker_login LOGIN PASSWORD '$WORKER_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  GRANT bibendia_migrator TO bibendia_migrator_login;
  GRANT bibendia_api TO bibendia_api_login;
  GRANT bibendia_worker TO bibendia_worker_login;
" >/dev/null

# Export environment variables matching assertIsolatedTestDatabase
export BIBENDIA_TEST_DATABASE_URL="postgresql://postgres:$PG_PASS@127.0.0.1:$PORT/$DB_NAME"
export DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL"
export API_DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL"
export WORKER_DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL"
export MIGRATOR_DATABASE_URL="$BIBENDIA_TEST_DATABASE_URL"

echo "📦 Compiling server and applying migrations up to 041..."
npm run build:server
mkdir -p server/dist/migrations
cp server/migrations/*.sql server/dist/migrations/
# Rehearse 040→041 only on this disposable database. Never hide source migrations.
mv "$migration" "$pending"
node server/dist/src/persistence/migrate.js
npx tsx server/test/bootstrap/minimal-041-preservation.ts
mv "$pending" "$migration"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js

echo "🧪 Running canonical integration tests..."
npx vitest run --config server/vitest.integration.config.ts server/test/integration/workshop-invitations.test.ts server/test/integration/platform-admin-p0-9.test.ts server/test/integration/repair-knowledge-coverage-02.test.ts

echo "🎭 Running Playwright headless browser E2E test against ephemeral PostgreSQL..."
npx tsx server/test/manual/e2e-headless-workshops-and-invitations.ts

echo "🎉 Ephemeral test run completed successfully!"
