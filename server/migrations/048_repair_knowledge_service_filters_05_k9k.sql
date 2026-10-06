-- 048: Repair Knowledge service filters coverage 05 — K9K.
-- Exact MANN applications for Mégane III, Qashqai II and Kangoo II.
-- Euro class and MAHLE/Sogefi fuel-housing variants remain explicit.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_service_filters_05()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; edge_code text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
      ('APP_FILTER5_MEGANE3_K9K636_AIR','Renault','Mégane III','BZ0/1_, B3_','1.5 dCi 110 K9K636 — air filter','K9K 636','2009-01-01','2015-08-31','JOB_MAINT_AIR_FILTER','air_filter','C 25 115','Exact MANN application includes K9K 636 in the 81 kW / 110 hp FAP group','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c25115_mann-filter.html'),

      ('APP_FILTER5_MEGANE3_K9K636_CABIN_FP','Renault','Mégane III','BZ0/1_, B3_','1.5 dCi 110 K9K636 — biofunctional cabin filter','K9K 636','2009-01-01','2015-08-31','JOB_MAINT_CABIN_FILTER','cabin_filter','FP 26 005','MANN FreciousPlus application includes K9K 636 in the 81 kW / 110 hp FAP group','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/fp26005_mann-filter.html'),

      ('APP_FILTER5_MEGANE3_K9K636_FUEL','Renault','Mégane III','BZ0/1_, B3_','1.5 dCi 110 K9K636 — OE 16 40 093 84R fuel filter','K9K 636','2009-01-01','2015-08-31','JOB_MAINT_FUEL_FILTER','fuel_filter','WK 9012 x','Exact MANN K9K636/832/836/837/846 application; OE 16 40 093 84R','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk9012x_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K636_AIR_EURO5','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 K9K636 — Euro 5 air filter','K9K 636','2014-02-01','2018-08-31','JOB_MAINT_AIR_FILTER','air_filter','C 25 040','MANN Qashqai II 1.5 dCi 81 kW application; Euro 5 configuration','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c25040_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K636_AIR_EURO6','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 K9K636 — Euro 6 air filter','K9K 636','2014-02-01','2018-08-31','JOB_MAINT_AIR_FILTER','air_filter','C 18 037','MANN Qashqai II 1.5 dCi 81 kW application; Euro 6 configuration','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c18037_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K636_CABIN','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 K9K636 — particle cabin filter','K9K 636','2014-02-01','2018-08-31','JOB_MAINT_CABIN_FILTER','cabin_filter','CU 25 003','MANN Qashqai II 1.5 dCi 81 kW cabin-filter application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu25003_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K636_FUEL_HEATED','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 K9K636 — fuel filter with integrated heater','K9K 636','2014-09-01','2018-08-31','JOB_MAINT_FUEL_FILTER','fuel_filter','WK 9054','MANN application 09/2014 onward; filter with integrated heater; confirm installed fuel-filter assembly','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk9054_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K636_FUEL_EURO6','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 K9K636 — Euro 6 fuel filter','K9K 636','2018-06-01','2018-08-31','JOB_MAINT_FUEL_FILTER','fuel_filter','WK 9079 z','MANN application from 06/2018; Euro 6; confirm installed fuel-filter assembly','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk9079z_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K872_AIR_EURO5','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 K9K872 — Euro 5 air filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 25 040','MANN explicitly lists K9K-872 85 kW / 115 hp; Euro 5 configuration','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c25040_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K872_AIR_EURO6','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 K9K872 — Euro 6 air filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 18 037','MANN explicitly lists K9K-872 85 kW / 115 hp; Euro 6 configuration','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c18037_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K872_CABIN','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 K9K872 — particle cabin filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 25 003','MANN explicitly lists K9K-872 Qashqai II cabin-filter application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu25003_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K872_FUEL_HEATED','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 K9K872 — fuel filter with integrated heater','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 9054','MANN explicitly lists K9K-872; filter with integrated heater; confirm installed fuel-filter assembly','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk9054_mann-filter.html'),

      ('APP_FILTER5_QASHQAIJ11_K9K872_FUEL_EURO6','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 K9K872 — Euro 6 fuel filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 9079 z','MANN explicitly lists K9K-872 Euro 6; confirm installed fuel-filter assembly','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk9079z_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K636_AIR','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 K9K636 — air filter','K9K 636','2010-09-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 2510/1','MANN exact K9K636/804/812/816 81 kW / 110 hp application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c2510/1_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K636_CABIN','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 K9K636 — particle cabin filter','K9K 636','2010-09-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2418-2','MANN exact K9K636/804/812/816 81 kW / 110 hp application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu2418-2_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K636_FUEL_MAHLE','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 K9K636 — MAHLE fuel housing','K9K 636','2014-06-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','From 06/2014; MAHLE filtration system; housing-specific application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K636_FUEL_SOGEFI','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 K9K636 — Sogefi riveted fuel housing','K9K 636','2014-06-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','From 06/2014; Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk12008_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K872_AIR','Renault','Kangoo II / Grand Kangoo','KW/KW0/1','1.5 Blue dCi 115 K9K872 — air filter','K9K 872','2019-03-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 2510/1','MANN exact K9K872 85 kW / 116 hp application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/c2510/1_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K872_CABIN','Renault','Kangoo II / Grand Kangoo','KW/KW0/1','1.5 Blue dCi 115 K9K872 — particle cabin filter','K9K 872','2019-03-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 2418-2','MANN exact K9K872 85 kW / 116 hp cabin-filter application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu2418-2_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K872_FUEL_MAHLE','Renault','Kangoo II / Grand Kangoo','KW/KW0/1','1.5 Blue dCi 115 K9K872 — MAHLE fuel housing','K9K 872','2019-03-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','MAHLE filtration system; housing-specific application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER5_KANGOO2_K9K872_FUEL_SOGEFI','Renault','Kangoo II / Grand Kangoo','KW/KW0/1','1.5 Blue dCi 115 K9K872 — Sogefi riveted fuel housing','K9K 872','2019-03-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/wk12008_mann-filter.html')
  ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,job_code,role_code,filter_ref,restrictions,source_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES(item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,item.production_from::date,item.production_to::date,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,variant=EXCLUDED.variant,
      engine_code=EXCLUDED.engine_code,production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,restrictions=EXCLUDED.restrictions;

    edge_code:=replace(item.app_code,'APP_FILTER5_','EDGE_FILTER5_');
    INSERT INTO repair_bom_edges(code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,bom_classification,
      confidence_state,condition,replace_once,notes)
    SELECT edge_code,a.id,j.id,r.id,'PART_ROLE',1,'REQUIRED','EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,
      jsonb_build_object('specification',item.filter_ref,'aftermarket_references',jsonb_build_object('MANN-FILTER',item.filter_ref),'restriction',item.restrictions)::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code=item.job_code AND r.code=item.role_code
    ON CONFLICT(code) DO UPDATE SET applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,part_role_id=EXCLUDED.part_role_id,
      item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,replace_once=EXCLUDED.replace_once,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,'MANN-FILTER official application catalogue',item.source_url,'TIER1_FILTER_CATALOG',DATE '2026-10-06',
      'VERIFIED_MANUFACTURER','ALLOW_FACT_DERIVATION',
      format('%s %s %s / %s — %s',item.make,item.model,item.engine_code,item.job_code,item.restrictions),
      'RK Service Filters Coverage 05@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;
ALTER FUNCTION apply_repair_knowledge_service_filters_05() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_service_filters_05() FROM PUBLIC;

CREATE OR REPLACE FUNCTION seed_repair_knowledge_poc_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM seed_repair_knowledge_poc_v1_legacy();
  PERFORM apply_repair_knowledge_coverage_01(); PERFORM apply_repair_knowledge_coverage_02(); PERFORM apply_repair_knowledge_coverage_03();
  PERFORM apply_repair_knowledge_coverage_04(); PERFORM apply_repair_knowledge_coverage_05(); PERFORM apply_repair_knowledge_coverage_06();
  PERFORM apply_repair_knowledge_coverage_07(); PERFORM apply_repair_knowledge_coverage_08(); PERFORM apply_repair_knowledge_coverage_09();
  PERFORM apply_repair_knowledge_maintenance_01(); PERFORM apply_repair_knowledge_maintenance_02(); PERFORM apply_repair_knowledge_maintenance_03();
  PERFORM apply_repair_knowledge_brakes_01(); PERFORM apply_repair_knowledge_clutch_01(); PERFORM apply_repair_knowledge_service_filters_01();
  PERFORM apply_repair_knowledge_brakes_02(); PERFORM apply_repair_knowledge_brakes_03(); PERFORM apply_repair_knowledge_service_filters_02();
  PERFORM apply_repair_knowledge_service_filters_03(); PERFORM apply_repair_knowledge_service_filters_04(); PERFORM apply_repair_knowledge_brakes_04();
  PERFORM apply_repair_knowledge_service_filters_05();
END $$;
ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_service_filters_05();

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
 ('044_repair_knowledge_service_filters_02_vag.sql'),
 ('045_repair_knowledge_service_filters_03_vag.sql'),
 ('046_repair_knowledge_service_filters_04_touran.sql'),
 ('047_repair_knowledge_brakes_04_psa.sql'),
 ('048_repair_knowledge_service_filters_05_k9k.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '048_repair_knowledge_service_filters_05_k9k.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
