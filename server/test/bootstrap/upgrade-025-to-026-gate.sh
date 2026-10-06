#!/bin/sh
set -eu

container="bibendia-upgrade-026-gate-$$"
postgres_password="upgrade-gate-only"
migrator_password="migrator-upgrade-only"
migration="server/dist/migrations/026_workshop_capacity_resource_rls_backfill.sql"
pending="server/dist/migrations/026_workshop_capacity_resource_rls_backfill.pending"
migration_027="server/dist/migrations/027_repair_knowledge_coverage_01.sql"
pending_027="server/dist/migrations/027_repair_knowledge_coverage_01.pending"
migration_028="server/dist/migrations/028_repair_knowledge_coverage_02_clha.sql"
pending_028="server/dist/migrations/028_repair_knowledge_coverage_02_clha.pending"
migration_029="server/dist/migrations/029_repair_knowledge_coverage_03_crmb.sql"
pending_029="server/dist/migrations/029_repair_knowledge_coverage_03_crmb.pending"

cleanup() {
  if [ -f "$pending" ]; then mv "$pending" "$migration"; fi
  if [ -f "$pending_027" ]; then mv "$pending_027" "$migration_027"; fi
  if [ -f "$pending_028" ]; then mv "$pending_028" "$migration_028"; fi
  if [ -f "$pending_029" ]; then mv "$pending_029" "$migration_029"; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run -d --name "$container" -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD="$postgres_password" -e POSTGRES_DB=bibendia postgres:17-alpine >/dev/null

attempt=0
until docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -Atc 'SELECT 1' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo 'upgrade PostgreSQL did not become ready' >&2; exit 1; }
  sleep 1
done

docker cp server/bootstrap/001_database_capabilities.sql "$container":/tmp/bootstrap.sql >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -f /tmp/bootstrap.sql >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -c "
  CREATE ROLE bibendia_migrator_login LOGIN PASSWORD '$migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  GRANT bibendia_migrator TO bibendia_migrator_login;
" >/dev/null

port="$(docker port "$container" 5432/tcp | sed 's/.*://')"
export NODE_ENV=production
export MIGRATOR_DATABASE_URL="postgresql://bibendia_migrator_login:$migrator_password@127.0.0.1:$port/bibendia"

# Stop at the exact production state: schema 025 applied, 026/027/028/029 not yet present.
mv "$migration" "$pending"
mv "$migration_027" "$pending_027"
mv "$migration_028" "$pending_028"
mv "$migration_029" "$pending_029"
node server/dist/src/persistence/migrate.js

placeholder='{"version":"v1","liftCount":2,"nonLiftBayCount":2,"concurrentTechnicians":2,"maxVehiclesOnSite":8,"maxVehicleIntakesPerHour":3,"resourceRequirements":{"rules":{},"fallback":null}}'
custom='{"version":"custom","liftCount":4,"nonLiftBayCount":1,"concurrentTechnicians":3,"maxVehiclesOnSite":12,"maxVehicleIntakesPerHour":4,"resourceRequirements":{"rules":{"inspection":{"mechanic":2,"lift":0,"genericBay":1}},"fallback":{"mechanic":1,"lift":0,"genericBay":1}}}'
corrupt='{"version":"v1","liftCount":2,"nonLiftBayCount":2,"concurrentTechnicians":2,"maxVehiclesOnSite":8,"maxVehicleIntakesPerHour":3,"resourceRequirements":{"rules":{"inspection":{"mechanic":-1}},"fallback":null}}'
docker exec "$container" psql -v ON_ERROR_STOP=1 -U postgres -d bibendia -c "
  INSERT INTO tenants(id,name) VALUES
    ('10000000-0000-4000-8000-000000000001','Upgrade tenant A'),
    ('10000000-0000-4000-8000-000000000002','Upgrade tenant B');
  INSERT INTO workshops(id,tenant_id,name,capacity_policy) VALUES
    ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Placeholder A','$placeholder'::jsonb),
    ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Placeholder B','$placeholder'::jsonb),
    ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Custom','$custom'::jsonb),
    ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','Corrupt','$corrupt'::jsonb);
" >/dev/null

force_rls="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT relforcerowsecurity FROM pg_class WHERE oid='workshops'::regclass")"
[ "$force_rls" = 't' ] || { echo 'workshops FORCE RLS is not active' >&2; exit 1; }

setting="$(docker exec "$container" psql -qAt -U postgres -d bibendia -c "SET ROLE bibendia_migrator; SELECT coalesce(current_setting('app.tenant_id',true),'<absent>')")"
[ "$setting" = '<absent>' ] || { echo "expected absent app.tenant_id, found $setting" >&2; exit 1; }

mv "$pending" "$migration"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js

canonical='{"rules":{"inspection":{"mechanic":1,"lift":0,"genericBay":1},"oil_service":{"mechanic":1,"lift":1,"genericBay":0},"brakes_or_noise":{"mechanic":1,"lift":1,"genericBay":0},"generic_fault":{"mechanic":1,"lift":0,"genericBay":1}},"fallback":{"mechanic":1,"lift":0,"genericBay":1}}'
backfilled="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM workshops WHERE capacity_policy->'resourceRequirements'='$canonical'::jsonb")"
[ "$backfilled" = '2' ] || { echo "expected 2 canonical backfills, found $backfilled" >&2; exit 1; }

preserved="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM workshops WHERE name='Custom' AND capacity_policy='$custom'::jsonb")"
[ "$preserved" = '1' ] || { echo 'custom capacity policy was changed' >&2; exit 1; }

corrupt_preserved="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM workshops WHERE name='Corrupt' AND capacity_policy='$corrupt'::jsonb")"
[ "$corrupt_preserved" = '1' ] || { echo 'corrupt fail-closed capacity policy was changed' >&2; exit 1; }

applied="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='026_workshop_capacity_resource_rls_backfill.sql'")"
[ "$applied" = '1' ] || { echo "expected one 026 migration record, found $applied" >&2; exit 1; }

# Then prove the next production migration applies cleanly on the upgraded schema.
mv "$pending_027" "$migration_027"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_027="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='027_repair_knowledge_coverage_01.sql'")"
[ "$applied_027" = '1' ] || { echo "expected one 027 migration record, found $applied_027" >&2; exit 1; }

# Then prove CLHA coverage applies as the next production migration.
mv "$pending_028" "$migration_028"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_028="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='028_repair_knowledge_coverage_02_clha.sql'")"
[ "$applied_028" = '1' ] || { echo "expected one 028 migration record, found $applied_028" >&2; exit 1; }

# Then prove CRMB coverage applies as the next production migration.
mv "$pending_029" "$migration_029"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_029="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='029_repair_knowledge_coverage_03_crmb.sql'")"
[ "$applied_029" = '1' ] || { echo "expected one 029 migration record, found $applied_029" >&2; exit 1; }

echo '025 to 026 to 027 to 028 to 029 upgrade gate: PASS'
