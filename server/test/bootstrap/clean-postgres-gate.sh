#!/bin/sh
set -eu

container="bibendia-bootstrap-gate-$$"
postgres_password="bootstrap-gate-only"
migrator_password="migrator-gate-only"
api_password="api-gate-only"
worker_password="worker-gate-only"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

mkdir -p server/dist/migrations
cp server/migrations/*.sql server/dist/migrations/

docker run -d --name "$container" -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD="$postgres_password" -e POSTGRES_DB=bibendia postgres:17-alpine >/dev/null

attempt=0
until docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -Atc 'SELECT 1' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo 'clean PostgreSQL did not become ready' >&2; exit 1; }
  sleep 1
done

docker cp server/bootstrap/001_database_capabilities.sql "$container":/tmp/bootstrap.sql >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -f /tmp/bootstrap.sql >/dev/null

docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -c "
  CREATE ROLE bibendia_migrator_login LOGIN PASSWORD '$migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  CREATE ROLE bibendia_api_login LOGIN PASSWORD '$api_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  CREATE ROLE bibendia_worker_login LOGIN PASSWORD '$worker_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  GRANT bibendia_migrator TO bibendia_migrator_login;
  GRANT bibendia_api TO bibendia_api_login;
  GRANT bibendia_worker TO bibendia_worker_login;
" >/dev/null

port="$(docker port "$container" 5432/tcp | sed 's/.*://')"
export NODE_ENV=production
export MIGRATOR_DATABASE_URL="postgresql://bibendia_migrator_login:$migrator_password@127.0.0.1:$port/bibendia"
export API_DATABASE_URL="postgresql://bibendia_api_login:$api_password@127.0.0.1:$port/bibendia"
export WORKER_DATABASE_URL="postgresql://bibendia_worker_login:$worker_password@127.0.0.1:$port/bibendia"

node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js

# A fresh process against the same database proves restart safety.
node server/dist/src/persistence/migrate.js
node server/test/bootstrap/verify-runtime-contract.mjs

applied="$(docker exec "$container" psql -At -U postgres -d bibendia -c 'SELECT count(*) FROM schema_migrations')"
[ "$applied" = '10' ] || { echo "expected 10 migrations, found $applied" >&2; exit 1; }

# Bootstrap itself is restart-safe and must not change the final authority model.
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -f /tmp/bootstrap.sql >/dev/null
node server/dist/src/persistence/migrate.js
node server/test/bootstrap/verify-runtime-contract.mjs

echo 'clean PostgreSQL bootstrap gate: PASS'
