import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('usage: node generate-vehiclesdb-migration.mjs <vehicles.json> <migration.sql>');

const expected = {
  version: '2026.09.1',
  sha256: '5cbed181c933e16e7ffeaf2cb7fcbd831774e2223f35eea60d1bd6b115c7d2ca',
  artifactUrl: 'https://github.com/vehiclesdb/vehiclesdb/releases/download/v2026.09.1/vehicles.json',
  attributionUrl: 'https://github.com/vehiclesdb/vehiclesdb/releases/download/v2026.09.1/ATTRIBUTION.md',
  attributionSha256: 'c14cf3ed4869664b9c1c2263b872eb0e6cda0d405b6fa26980615f21fe21359d',
};
const bytes = await readFile(inputPath);
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== expected.sha256) throw new Error(`VehiclesDB artifact hash mismatch: ${digest}`);
const catalog = JSON.parse(bytes.toString('utf8'));
if (catalog.version !== expected.version || catalog.license !== 'CC-BY-4.0') throw new Error('unexpected VehiclesDB metadata');

const makes = [];
const models = [];
for (const make of catalog.makes) {
  const selected = make.models.filter((model) => ['car','van'].includes(model.kind) && model.availability?.includes('es'));
  for (const kind of ['car','van']) {
    if (selected.some((model) => model.kind === kind)) makes.push({ sourceId: make.slug, kind, name: make.name, slug: make.slug, aliases: make.aliases ?? [] });
  }
  for (const model of selected) models.push({
    makeSourceId: make.slug, sourceId: `${make.slug}/${model.slug}`, kind: model.kind, name: model.name, slug: model.slug,
    bodyTypes: model.body_type ? [model.body_type] : [], aliases: model.aliases ?? [], formerIds: model.former_ids ?? [],
    decile: model.global_decile ?? null,
  });
}

const duplicate = new Set();
for (const model of models) {
  const key = `${model.kind}\0${model.makeSourceId}\0${model.slug}`;
  if (duplicate.has(key)) throw new Error(`duplicate filtered model: ${key}`);
  duplicate.add(key);
}

const sql = [];
sql.push(`-- Generated from VehiclesDB ${expected.version}. Do not hand edit; run server/scripts/generate-vehiclesdb-migration.mjs.`);
sql.push(`-- Source artifact SHA-256: ${expected.sha256}`);
sql.push(`CREATE OR REPLACE FUNCTION seed_vehicle_catalog_vehiclesdb_2026_09_1() RETURNS void`);
sql.push(`LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$`);
sql.push(`DECLARE source_uuid uuid; BEGIN`);
sql.push(`  INSERT INTO vehicle_catalog_sources(provider,dataset_version,schema_version,artifact_name,artifact_sha256,artifact_url,source_url,license_spdx,attribution,attribution_url,attribution_sha256,active)`);
sql.push(`  VALUES ('VehiclesDB','2026.09.1',${literal(catalog.schema_version)},'vehicles.json','${expected.sha256}',${literal(expected.artifactUrl)},'https://github.com/vehiclesdb/vehiclesdb','CC-BY-4.0',${literal(`${catalog.attribution.text} (${catalog.attribution.url})`)},${literal(expected.attributionUrl)},'${expected.attributionSha256}',false)`);
sql.push(`  ON CONFLICT(provider,dataset_version) DO NOTHING;`);
sql.push(`  SELECT id INTO source_uuid FROM vehicle_catalog_sources WHERE provider='VehiclesDB' AND dataset_version='2026.09.1' AND artifact_sha256='${expected.sha256}';`);
sql.push(`  IF source_uuid IS NULL THEN RAISE EXCEPTION 'VehiclesDB 2026.09.1 source hash conflict'; END IF;`);
sql.push(`  UPDATE vehicle_catalog_sources SET active=false WHERE provider='VehiclesDB' AND id<>source_uuid AND active;`);
for (const make of makes) sql.push(`  INSERT INTO vehicle_catalog_makes(source_id,source_make_id,kind,name,slug,aliases) VALUES (source_uuid,${literal(make.sourceId)},${literal(make.kind)},${literal(make.name)},${literal(make.slug)},${array(make.aliases)}) ON CONFLICT(source_id,kind,source_make_id) DO NOTHING;`);
for (const model of models) {
  sql.push(`  INSERT INTO vehicle_catalog_models(source_id,make_id,source_model_id,kind,name,slug,body_types,aliases,former_source_ids,global_popularity_decile)`);
  sql.push(`  SELECT source_uuid,m.id,${literal(model.sourceId)},${literal(model.kind)},${literal(model.name)},${literal(model.slug)},${array(model.bodyTypes)},${array(model.aliases)},${array(model.formerIds)},${model.decile ?? 'NULL'} FROM vehicle_catalog_makes m WHERE m.source_id=source_uuid AND m.kind=${literal(model.kind)} AND m.source_make_id=${literal(model.makeSourceId)} ON CONFLICT(source_id,kind,source_model_id) DO NOTHING;`);
  sql.push(`  INSERT INTO vehicle_catalog_availability(source_id,model_id,country_code,evidence_type,source_ref) SELECT source_uuid,id,'ES','registration','es_dgt' FROM vehicle_catalog_models WHERE source_id=source_uuid AND kind=${literal(model.kind)} AND source_model_id=${literal(model.sourceId)} ON CONFLICT DO NOTHING;`);
}
for (const link of [
  ['car','volkswagen/golf','Volkswagen','Golf VII'],
  ['car','seat/leon','Seat','León 5F'],
  ['car','renault/megane','Renault','Mégane IV'],
]) sql.push(`  INSERT INTO vehicle_catalog_rk_model_links(source_id,model_id,rk_make,rk_model,link_method) SELECT source_uuid,id,${literal(link[2])},${literal(link[3])},'EXPLICIT_REVIEWED' FROM vehicle_catalog_models WHERE source_id=source_uuid AND kind=${literal(link[0])} AND source_model_id=${literal(link[1])} ON CONFLICT DO NOTHING;`);
sql.push(`  UPDATE vehicle_catalog_sources SET active=true WHERE id=source_uuid;`);
sql.push(`END $$;`);
sql.push(`ALTER FUNCTION seed_vehicle_catalog_vehiclesdb_2026_09_1() OWNER TO bibendia_migrator;`);
sql.push(`REVOKE ALL ON FUNCTION seed_vehicle_catalog_vehiclesdb_2026_09_1() FROM PUBLIC;`);
sql.push(`SELECT seed_vehicle_catalog_vehiclesdb_2026_09_1();`);
sql.push(`CREATE OR REPLACE FUNCTION runtime_schema_status()`);
sql.push(`RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)`);
sql.push(`LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$`);
sql.push(`WITH expected(name) AS (VALUES`);
sql.push(` ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),`);
sql.push(` ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),`);
sql.push(` ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),`);
sql.push(` ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),`);
sql.push(` ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql'),('017_workshop_service_duration_policy.sql'),`);
sql.push(` ('018_repair_knowledge_api.sql'),('019_estimate_draft_editing.sql'),('020_vehicle_catalog_foundation.sql'),`);
sql.push(` ('021_vehicle_catalog_vehiclesdb_2026_09_1.sql')`);
sql.push(`),counts AS (SELECT (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,`);
sql.push(` (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown)`);
sql.push(`SELECT '021_vehicle_catalog_vehiclesdb_2026_09_1.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;`);
sql.push(`ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;`);
sql.push(`REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;`);
sql.push(`GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;`);
sql.push('');

await writeFile(outputPath, sql.join('\n'), 'utf8');
process.stdout.write(JSON.stringify({ version: expected.version, sha256: digest, makes: new Set(makes.map((make) => make.sourceId)).size,
  makeKindRows: makes.length, carModels: models.filter((model) => model.kind === 'car').length,
  vanModels: models.filter((model) => model.kind === 'van').length, models: models.length }) + '\n');

function literal(value) { return value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`; }
function array(values) { return `ARRAY[${values.map(literal).join(',')}]::text[]`; }
