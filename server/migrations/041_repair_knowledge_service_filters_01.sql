-- 041: Repair Knowledge high-frequency service filters 01.
-- Scope: activate independent air, fuel and cabin filter jobs on three high-value RK vehicles.
-- Exact manufacturer fitment only; housing/climate variants remain explicit.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_service_filters_01()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  edge_code text;
BEGIN
  INSERT INTO repair_jobs(code,system,subsystem,name,description,active) VALUES
    ('JOB_MAINT_AIR_FILTER','MANTENIMIENTO','FILTROS','Sustitución Filtro de Aire','Filtro de admisión del motor con fitment exacto por vehículo/motor.',true),
    ('JOB_MAINT_FUEL_FILTER','MANTENIMIENTO','FILTROS','Sustitución Filtro de Combustible','Filtro de combustible con carcasa/sistema de filtración explícito cuando aplica.',true),
    ('JOB_MAINT_CABIN_FILTER','MANTENIMIENTO','FILTROS','Sustitución Filtro de Habitáculo','Filtro de habitáculo / polen con fitment exacto por vehículo.',true)
  ON CONFLICT(code) DO UPDATE SET
    system=EXCLUDED.system,subsystem=EXCLUDED.subsystem,name=EXCLUDED.name,
    description=EXCLUDED.description,active=true;

  INSERT INTO repair_part_roles(code,name,category,active) VALUES
    ('air_filter','Air Filter','COMPONENT',true),
    ('fuel_filter','Fuel Filter','COMPONENT',true),
    ('cabin_filter','Cabin Filter','COMPONENT',true)
  ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,active=true;

  FOR item IN
    SELECT * FROM (VALUES
      ('APP_SVCFLT_GOLF7_CLHA_AIR','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — standard air filter','CLHA',DATE '2012-11-01',DATE '2017-03-31',
       'JOB_MAINT_AIR_FILTER','air_filter','C 30 005',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c30005_mann-filter.html',
       'Golf VII 1.6 TDI CLHA 77 kW / 105 hp; exact engine-code fitment.'),

      ('APP_SVCFLT_GOLF7_CLHA_CABIN','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — particle cabin filter','CLHA',DATE '2012-11-01',DATE '2017-03-31',
       'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 26 009',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu26009_mann-filter.html',
       'Golf VII CLHA; particle cabin filter. Activated-carbon/biofunctional alternatives are not collapsed into this base row.'),

      ('APP_SVCFLT_GOLF7_CLHA_FUEL_NO_WATER_SENSOR','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — fuel housing without water sensor','CLHA',DATE '2012-11-01',DATE '2017-03-31',
       'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 8021',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/pu8021_mann-filter.html',
       'Golf VII CLHA; only for fuel-filter housing without water sensor.'),

      ('APP_SVCFLT_GOLF7_CLHA_FUEL_WITH_WATER_SENSOR','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — fuel housing with water sensor','CLHA',DATE '2012-11-01',DATE '2017-03-31',
       'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 8014',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/pu8014_mann-filter.html',
       'Golf VII CLHA; only for fuel-filter housing with water sensor.'),

      ('APP_SVCFLT_GOLF6_CAYC_AIR','Volkswagen','Golf VI','5K1',
       '1.6 TDI CAYC — standard-climate air filter','CAYC',DATE '2009-05-01',DATE '2016-05-31',
       'JOB_MAINT_AIR_FILTER','air_filter','C 35 154',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c35154_mann-filter.html',
       'Golf VI CAYC; standard-climate filter. Cold-climate C 35 154/1 is intentionally separate/not inferred.'),

      ('APP_SVCFLT_GOLF6_CAYC_CABIN','Volkswagen','Golf VI','5K1',
       '1.6 TDI CAYC — particle cabin filter','CAYC',DATE '2009-05-01',DATE '2016-05-31',
       'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2939',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/cu2939_mann-filter.html',
       'Golf VI CAYC; particle cabin filter.'),

      ('APP_SVCFLT_CLIO4_K9K646_AIR','Renault','Clio IV','BH_',
       '1.5 dCi 110 K9K646 — air filter','K9K 646',DATE '2016-07-01',NULL::date,
       'JOB_MAINT_AIR_FILTER','air_filter','C 27 029',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c27029_mann-filter.html',
       'Clio IV 1.5 dCi K9K646 81 kW / 110 hp; exact engine-code fitment.'),

      ('APP_SVCFLT_CLIO4_K9K646_CABIN','Renault','Clio IV','BH_',
       '1.5 dCi 110 K9K646 — particle cabin filter','K9K 646',DATE '2016-07-01',NULL::date,
       'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 22 011',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu22011_mann-filter.html',
       'Clio IV K9K646; particle cabin filter.'),

      ('APP_SVCFLT_CLIO4_K9K646_FUEL_MAHLE','Renault','Clio IV','BH_',
       '1.5 dCi 110 K9K646 — MAHLE housing with screwed lid','K9K 646',DATE '2016-07-01',NULL::date,
       'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT',
       'MANN-FILTER official application catalogue',
       'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/pu9011zkit_mann-filter.html',
       'Clio IV K9K646; MAHLE filtration system; housing with screwed lid.')
    ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,job_code,role_code,filter_ref,source,source_url,restrictions)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,
      item.production_from,item.production_to,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    edge_code := replace(item.app_code,'APP_SVCFLT_','EDGE_SVCFLT_') || '_FILTER';

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT edge_code,a.id,j.id,r.id,'PART_ROLE',1,
      'REQUIRED','EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,
      jsonb_build_object(
        'applicability',item.variant,
        'specification',item.role_code,
        'aftermarket_references',jsonb_build_object('MANN-FILTER',item.filter_ref)
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code=item.job_code AND r.code=item.role_code
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,item.source,item.source_url,'TIER1_FILTER_CATALOG',DATE '2026-10-06',
      'VERIFIED_MANUFACTURER','ALLOW_FACT_DERIVATION',item.restrictions,
      'RK Service Filters 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_service_filters_01() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_service_filters_01() FROM PUBLIC;

CREATE OR REPLACE FUNCTION seed_repair_knowledge_poc_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM seed_repair_knowledge_poc_v1_legacy();
  PERFORM apply_repair_knowledge_coverage_01();
  PERFORM apply_repair_knowledge_coverage_02();
  PERFORM apply_repair_knowledge_coverage_03();
  PERFORM apply_repair_knowledge_coverage_04();
  PERFORM apply_repair_knowledge_coverage_05();
  PERFORM apply_repair_knowledge_coverage_06();
  PERFORM apply_repair_knowledge_coverage_07();
  PERFORM apply_repair_knowledge_coverage_08();
  PERFORM apply_repair_knowledge_coverage_09();
  PERFORM apply_repair_knowledge_maintenance_01();
  PERFORM apply_repair_knowledge_maintenance_02();
  PERFORM apply_repair_knowledge_maintenance_03();
  PERFORM apply_repair_knowledge_brakes_01();
  PERFORM apply_repair_knowledge_clutch_01();
  PERFORM apply_repair_knowledge_service_filters_01();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_service_filters_01();

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),('002_identity_and_evidence.sql'),('003_runtime_roles_and_rls.sql'),('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),('006_tenant_lifecycle_and_kill_switch.sql'),('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),('009_runtime_operability.sql'),('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),('012_platform_admin_p0_9.sql'),('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),('016_repair_estimate_draft.sql'),('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql'),('019_estimate_draft_editing.sql'),('020_vehicle_catalog_foundation.sql'),
 ('021_vehicle_catalog_vehiclesdb_2026_09_1.sql'),('022_manual_operations_foundation.sql'),
 ('023_reception_case_foundation.sql'),('024_workshop_capacity_scheduling_v1.sql'),
 ('025_workshop_capacity_resource_bootstrap.sql'),('026_workshop_capacity_resource_rls_backfill.sql'),
 ('027_repair_knowledge_coverage_01.sql'),('028_repair_knowledge_coverage_02_clha.sql'),
 ('029_repair_knowledge_coverage_03_crmb.sql'),('030_repair_knowledge_coverage_04_cayc.sql'),
 ('031_repair_knowledge_coverage_05_dv6c.sql'),('032_repair_knowledge_coverage_06_vag19tdi.sql'),
 ('033_repair_knowledge_coverage_07_k9k636_646.sql'),('034_repair_knowledge_coverage_08_opel17.sql'),
 ('035_repair_knowledge_coverage_09_dv6_legacy.sql'),('036_repair_knowledge_maintenance_01_vag_opel.sql'),
 ('037_repair_knowledge_maintenance_02_psa_ford.sql'),('038_repair_knowledge_maintenance_03_k9k.sql'),
 ('039_repair_knowledge_brakes_01_priority.sql'),('040_repair_knowledge_clutch_01_priority.sql'),
 ('041_repair_knowledge_service_filters_01.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '041_repair_knowledge_service_filters_01.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
