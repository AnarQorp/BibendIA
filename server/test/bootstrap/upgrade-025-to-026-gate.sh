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
migration_030="server/dist/migrations/030_repair_knowledge_coverage_04_cayc.sql"
pending_030="server/dist/migrations/030_repair_knowledge_coverage_04_cayc.pending"
migration_031="server/dist/migrations/031_repair_knowledge_coverage_05_dv6c.sql"
pending_031="server/dist/migrations/031_repair_knowledge_coverage_05_dv6c.pending"
migration_032="server/dist/migrations/032_repair_knowledge_coverage_06_vag19tdi.sql"
pending_032="server/dist/migrations/032_repair_knowledge_coverage_06_vag19tdi.pending"
migration_033="server/dist/migrations/033_repair_knowledge_coverage_07_k9k636_646.sql"
pending_033="server/dist/migrations/033_repair_knowledge_coverage_07_k9k636_646.pending"
migration_034="server/dist/migrations/034_repair_knowledge_coverage_08_opel17.sql"
pending_034="server/dist/migrations/034_repair_knowledge_coverage_08_opel17.pending"

cleanup() {
  if [ -f "$pending" ]; then mv "$pending" "$migration"; fi
  if [ -f "$pending_027" ]; then mv "$pending_027" "$migration_027"; fi
  if [ -f "$pending_028" ]; then mv "$pending_028" "$migration_028"; fi
  if [ -f "$pending_029" ]; then mv "$pending_029" "$migration_029"; fi
  if [ -f "$pending_030" ]; then mv "$pending_030" "$migration_030"; fi
  if [ -f "$pending_031" ]; then mv "$pending_031" "$migration_031"; fi
  if [ -f "$pending_032" ]; then mv "$pending_032" "$migration_032"; fi
  if [ -f "$pending_033" ]; then mv "$pending_033" "$migration_033"; fi
  if [ -f "$pending_034" ]; then mv "$pending_034" "$migration_034"; fi
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

# Stop at the exact production state: schema 025 applied, 026/027/028/029/030/031/032/033/034 not yet present.
mv "$migration" "$pending"
mv "$migration_027" "$pending_027"
mv "$migration_028" "$pending_028"
mv "$migration_029" "$pending_029"
mv "$migration_030" "$pending_030"
mv "$migration_031" "$pending_031"
mv "$migration_032" "$pending_032"
mv "$migration_033" "$pending_033"
mv "$migration_034" "$pending_034"
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

# Then prove CAYC coverage applies as the next production migration.
mv "$pending_030" "$migration_030"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_030="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='030_repair_knowledge_coverage_04_cayc.sql'")"
[ "$applied_030" = '1' ] || { echo "expected one 030 migration record, found $applied_030" >&2; exit 1; }

# Then prove DV6C coverage applies as the next production migration.
mv "$pending_031" "$migration_031"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_031="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='031_repair_knowledge_coverage_05_dv6c.sql'")"
[ "$applied_031" = '1' ] || { echo "expected one 031 migration record, found $applied_031" >&2; exit 1; }

# Then prove VAG 1.9 TDI coverage applies as the next production migration.
mv "$pending_032" "$migration_032"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_032="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='032_repair_knowledge_coverage_06_vag19tdi.sql'")"
[ "$applied_032" = '1' ] || { echo "expected one 032 migration record, found $applied_032" >&2; exit 1; }

# Then prove K9K 636/646 coverage applies as the next production migration.
mv "$pending_033" "$migration_033"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_033="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='033_repair_knowledge_coverage_07_k9k636_646.sql'")"
[ "$applied_033" = '1' ] || { echo "expected one 033 migration record, found $applied_033" >&2; exit 1; }

# Then prove Opel 1.7 CDTI coverage applies as the next production migration.
mv "$pending_034" "$migration_034"
node server/dist/src/persistence/migrate.js
node server/dist/src/persistence/migrate.js
applied_034="$(docker exec "$container" psql -At -U postgres -d bibendia -c "SELECT count(*) FROM schema_migrations WHERE name='034_repair_knowledge_coverage_08_opel17.sql'")"
[ "$applied_034" = '1' ] || { echo "expected one 034 migration record, found $applied_034" >&2; exit 1; }

echo '025 to 026 to 027 to 028 to 029 to 030 to 031 to 032 to 033 to 034 upgrade gate: PASS'
