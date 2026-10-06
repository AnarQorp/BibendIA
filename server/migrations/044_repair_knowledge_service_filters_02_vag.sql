-- 044: Repair Knowledge service filters coverage 02 — VAG/Seat expansion.
-- Scope: extend air, cabin and diesel-fuel filters on exact León II engine-code applications.
-- Housing/chassis restrictions remain explicit; no filter-family inference.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_service_filters_02()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  edge_code text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('APP_FILTER2_LEON2_CAYC_AIR','Seat','León II','1P1','1.6 TDI CAYC — standard air filter','CAYC','2009-12-01','2012-12-31','JOB_MAINT_AIR_FILTER','air_filter','C 35 154','Standard climate air-filter application; cold-climate C 35 154/1 remains separate','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c35154_mann-filter.html'),

      ('APP_FILTER2_LEON2_CAYC_CABIN','Seat','León II','1P1','1.6 TDI CAYC — particle cabin filter','CAYC','2009-12-01','2012-12-31','JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2939','Particle cabin-filter application; activated-carbon/biofunctional alternatives not collapsed','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/cu2939_mann-filter.html'),

      ('APP_FILTER2_LEON2_CAYC_FUEL','Seat','León II','1P1','1.6 TDI CAYC — diesel fuel filter','CAYC','2009-12-01','2012-12-31','JOB_MAINT_FUEL_FILTER','fuel_filter','PU 825 x','Exact MANN CAYC diesel-fuel-filter application','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/pu825x_mann-filter.html'),

      ('APP_FILTER2_LEON2_BKC_AIR','Seat','León II','1P1','1.9 TDI BKC — standard air filter','BKC','2005-08-01','2010-12-31','JOB_MAINT_AIR_FILTER','air_filter','C 35 154','Standard climate air-filter application; cold-climate C 35 154/1 remains separate','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c35154_mann-filter.html'),

      ('APP_FILTER2_LEON2_BKC_CABIN','Seat','León II','1P1','1.9 TDI BKC — particle cabin filter','BKC','2005-08-01','2010-12-31','JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2939','Particle cabin-filter application; activated-carbon/biofunctional alternatives not collapsed','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/cu2939_mann-filter.html'),

      ('APP_FILTER2_LEON2_BKC_FUEL_LATE','Seat','León II','1P1','1.9 TDI BKC — fuel filter — chassis from 1P_6_014786','BKC','2005-08-01','2010-12-31','JOB_MAINT_FUEL_FILTER','fuel_filter','PU 825 x','Only from chassis 1P_6_014786; earlier housings intentionally excluded pending exact OE-housing disambiguation','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/pu825x_mann-filter.html'),

      ('APP_FILTER2_LEON2_BLS_AIR','Seat','León II','1P1','1.9 TDI BLS — standard air filter','BLS','2005-08-01','2010-12-31','JOB_MAINT_AIR_FILTER','air_filter','C 35 154','Standard climate air-filter application; cold-climate C 35 154/1 remains separate','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c35154_mann-filter.html'),

      ('APP_FILTER2_LEON2_BLS_CABIN','Seat','León II','1P1','1.9 TDI BLS — particle cabin filter','BLS','2005-08-01','2010-12-31','JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2939','Particle cabin-filter application; activated-carbon/biofunctional alternatives not collapsed','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/cu2939_mann-filter.html'),

      ('APP_FILTER2_LEON2_BLS_FUEL_LATE','Seat','León II','1P1','1.9 TDI BLS — fuel filter — chassis from 1P_6_014786','BLS','2005-08-01','2010-12-31','JOB_MAINT_FUEL_FILTER','fuel_filter','PU 825 x','Only from chassis 1P_6_014786; earlier housings intentionally excluded pending exact OE-housing disambiguation','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/pu825x_mann-filter.html'),

      ('APP_FILTER2_LEON2_BXE_AIR','Seat','León II','1P1','1.9 TDI BXE — standard air filter','BXE','2005-08-01','2010-12-31','JOB_MAINT_AIR_FILTER','air_filter','C 35 154','Standard climate air-filter application; cold-climate C 35 154/1 remains separate','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c35154_mann-filter.html'),

      ('APP_FILTER2_LEON2_BXE_CABIN','Seat','León II','1P1','1.9 TDI BXE — particle cabin filter','BXE','2005-08-01','2010-12-31','JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2939','Particle cabin-filter application; activated-carbon/biofunctional alternatives not collapsed','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/cu2939_mann-filter.html'),

      ('APP_FILTER2_LEON2_BXE_FUEL_LATE','Seat','León II','1P1','1.9 TDI BXE — fuel filter — chassis from 1P_6_014786','BXE','2005-08-01','2010-12-31','JOB_MAINT_FUEL_FILTER','fuel_filter','PU 825 x','Only from chassis 1P_6_014786; earlier housings intentionally excluded pending exact OE-housing disambiguation','https://www.mann-filter.com/es/catalogo/resultados-de-busqueda/producto.html/pu825x_mann-filter.html')
    ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,job_code,role_code,filter_ref,restrictions,source_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,
      item.production_from::date,item.production_to::date,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    edge_code := replace(item.app_code,'APP_FILTER2_','EDGE_FILTER2_');

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,notes)
    SELECT edge_code,a.id,j.id,r.id,'PART_ROLE',1,'REQUIRED',
      'EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,
      jsonb_build_object(
        'specification',item.filter_ref,
        'aftermarket_references',jsonb_build_object('MANN-FILTER',item.filter_ref),
        'restriction',item.restrictions
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
    SELECT e.id,'MANN-FILTER official application catalogue',item.source_url,
      'TIER1_FILTER_CATALOG',DATE '2026-10-06','VERIFIED_MANUFACTURER','ALLOW_FACT_DERIVATION',
      format('%s %s %s / %s — %s',item.make,item.model,item.engine_code,item.job_code,item.restrictions),
      'RK Service Filters Coverage 02@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_service_filters_02() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_service_filters_02() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_brakes_02();
  PERFORM apply_repair_knowledge_brakes_03();
  PERFORM apply_repair_knowledge_service_filters_02();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_service_filters_02();

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),
 ('002_identity_and_evidence.sql'),
 ('003_runtime_roles_and_rls.sql'),
 ('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),
 ('006_tenant_lifecycle_and_kill_switch.sql'),
 ('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),
 ('009_runtime_operability.sql'),
 ('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),
 ('012_platform_admin_p0_9.sql'),
 ('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),
 ('016_repair_estimate_draft.sql'),
 ('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql'),
 ('019_estimate_draft_editing.sql'),
 ('020_vehicle_catalog_foundation.sql'),
 ('021_vehicle_catalog_vehiclesdb_2026_09_1.sql'),
 ('022_manual_operations_foundation.sql'),
 ('023_reception_case_foundation.sql'),
 ('024_workshop_capacity_scheduling_v1.sql'),
 ('025_workshop_capacity_resource_bootstrap.sql'),
 ('026_workshop_capacity_resource_rls_backfill.sql'),
 ('027_repair_knowledge_coverage_01.sql'),
 ('028_repair_knowledge_coverage_02_clha.sql'),
 ('029_repair_knowledge_coverage_03_crmb.sql'),
 ('030_repair_knowledge_coverage_04_cayc.sql'),
 ('031_repair_knowledge_coverage_05_dv6c.sql'),
 ('032_repair_knowledge_coverage_06_vag19tdi.sql'),
 ('033_repair_knowledge_coverage_07_k9k636_646.sql'),
 ('034_repair_knowledge_coverage_08_opel17.sql'),
 ('035_repair_knowledge_coverage_09_dv6_legacy.sql'),
 ('036_repair_knowledge_maintenance_01_vag_opel.sql'),
 ('037_repair_knowledge_maintenance_02_psa_ford.sql'),
 ('038_repair_knowledge_maintenance_03_k9k.sql'),
 ('039_repair_knowledge_brakes_01_priority.sql'),
 ('040_repair_knowledge_clutch_01_priority.sql'),
 ('041_repair_knowledge_service_filters_01.sql'),
 ('042_repair_knowledge_brakes_02_vag.sql'),
 ('043_repair_knowledge_brakes_03_nonvag.sql'),
 ('044_repair_knowledge_service_filters_02_vag.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '044_repair_knowledge_service_filters_02_vag.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
