-- 049: Repair Knowledge service filters coverage 06 — Dacia K9K872.
-- Scope: exact MANN-FILTER air/cabin/fuel applications for Lodgy, Dokker,
-- Sandero II and Logan MCV II already represented in RK.
-- MAHLE/Sogefi fuel housings remain separate. Duster II is intentionally
-- excluded pending reconciliation of conflicting engine-subcode evidence.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_service_filters_06()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; edge_code text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
      ('APP_FILTER6_LODGY_K9K872_95_AIR','Dacia','Lodgy','JS_','1.5 Blue dCi 95 K9K872 — air filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 27 030','Exact MANN Lodgy Blue dCi 95 K9K 872 application','https://www.mann-filter.com/uk-en/catalogue/search-results/product.html/c27030_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_95_CABIN','Dacia','Lodgy','JS_','1.5 Blue dCi 95 K9K872 — particle cabin filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 25 012','Exact MANN Lodgy Blue dCi 95 K9K 872 application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu25012_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_95_FUEL_MAHLE','Dacia','Lodgy','JS_','1.5 Blue dCi 95 K9K872 — MAHLE fuel housing','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','MAHLE filtration system; housing with screwed lid','https://www.mann-filter.com/en/catalog/search-results/product.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_95_FUEL_SOGEFI','Dacia','Lodgy','JS_','1.5 Blue dCi 95 K9K872 — Sogefi fuel housing','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/en/catalog/search-results/product.html/wk12008_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_115_AIR','Dacia','Lodgy','JS_','1.5 Blue dCi 115 K9K872 — air filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 27 030','Exact MANN Lodgy Blue dCi 115 K9K 872 application','https://www.mann-filter.com/uk-en/catalogue/search-results/product.html/c27030_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_115_CABIN','Dacia','Lodgy','JS_','1.5 Blue dCi 115 K9K872 — particle cabin filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 25 012','Exact MANN Lodgy Blue dCi 115 K9K 872 application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu25012_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_115_FUEL_MAHLE','Dacia','Lodgy','JS_','1.5 Blue dCi 115 K9K872 — MAHLE fuel housing','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','MAHLE filtration system; housing with screwed lid','https://www.mann-filter.com/en/catalog/search-results/product.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER6_LODGY_K9K872_115_FUEL_SOGEFI','Dacia','Lodgy','JS_','1.5 Blue dCi 115 K9K872 — Sogefi fuel housing','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/en/catalog/search-results/product.html/wk12008_mann-filter.html'),

      ('APP_FILTER6_DOKKER_K9K872_95_AIR','Dacia','Dokker','KE_','1.5 Blue dCi 95 K9K872 — air filter','K9K 872','2018-12-01','2021-12-31','JOB_MAINT_AIR_FILTER','air_filter','C 27 030','Exact MANN Dokker Blue dCi 95 K9K 872 application','https://www.mann-filter.com/my-en/catalog/search-results/product.html/c27030_mann-filter.html'),

      ('APP_FILTER6_DOKKER_K9K872_95_CABIN','Dacia','Dokker','KE_','1.5 Blue dCi 95 K9K872 — particle cabin filter','K9K 872','2018-12-01','2021-12-31','JOB_MAINT_CABIN_FILTER','cabin_filter','CU 25 012','Exact MANN Dokker Blue dCi 95 K9K 872 application','https://www.mann-filter.com/en/catalog/search-results/product.suffix.html/cu25012_mann-filter.html'),

      ('APP_FILTER6_DOKKER_K9K872_95_FUEL_MAHLE','Dacia','Dokker','KE_','1.5 Blue dCi 95 K9K872 — MAHLE fuel housing','K9K 872','2018-12-01','2021-12-31','JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','MAHLE filtration system; housing with screwed lid','https://www.mann-filter.com/en/catalog/search-results/product.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER6_DOKKER_K9K872_95_FUEL_SOGEFI','Dacia','Dokker','KE_','1.5 Blue dCi 95 K9K872 — Sogefi fuel housing','K9K 872','2018-12-01','2021-12-31','JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/en/catalog/search-results/product.html/wk12008_mann-filter.html'),

      ('APP_FILTER6_SANDERO2_K9K872_95_AIR','Dacia','Sandero II','B8_','1.5 dCi 95 K9K872 — air filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 27 030','Exact MANN Sandero II K9K 872 70 kW / 95 hp application','https://www.mann-filter.com/uk-en/catalogue/search-results/product.html/c27030_mann-filter.html'),

      ('APP_FILTER6_SANDERO2_K9K872_95_CABIN','Dacia','Sandero II','B8_','1.5 dCi 95 K9K872 — particle cabin filter','K9K 872','2018-08-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 22 011','Exact MANN Sandero II K9K 872 70 kW / 95 hp application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu22011_mann-filter.html'),

      ('APP_FILTER6_SANDERO2_K9K872_95_FUEL_MAHLE','Dacia','Sandero II','B8_','1.5 dCi 95 K9K872 — MAHLE fuel housing','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','MAHLE filtration system; housing with screwed lid','https://www.mann-filter.com/en/catalog/search-results/product.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER6_SANDERO2_K9K872_95_FUEL_SOGEFI','Dacia','Sandero II','B8_','1.5 dCi 95 K9K872 — Sogefi fuel housing','K9K 872','2018-08-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/en/catalog/search-results/product.html/wk12008_mann-filter.html'),

      ('APP_FILTER6_LOGANMCV2_K9K872_95_AIR','Dacia','Logan MCV II','K8_','1.5 Blue dCi 95 K9K872 — air filter','K9K 872','2018-05-01',NULL,'JOB_MAINT_AIR_FILTER','air_filter','C 27 030','Exact MANN Logan II / MCV II Blue dCi 95 K9K872 application','https://www.mann-filter.com/ph-en/catalog/search-results/product.html/c27030_mann-filter.html'),

      ('APP_FILTER6_LOGANMCV2_K9K872_95_CABIN','Dacia','Logan MCV II','K8_','1.5 Blue dCi 95 K9K872 — particle cabin filter','K9K 872','2018-05-01',NULL,'JOB_MAINT_CABIN_FILTER','cabin_filter','CU 22 011','Exact MANN Logan II / MCV II Blue dCi 95 K9K872 application','https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/cu22011_mann-filter.html'),

      ('APP_FILTER6_LOGANMCV2_K9K872_95_FUEL_MAHLE','Dacia','Logan MCV II','K8_','1.5 Blue dCi 95 K9K872 — MAHLE fuel housing','K9K 872','2018-05-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','PU 9011 z KIT','MAHLE filtration system; housing with screwed lid','https://www.mann-filter.com/en/catalog/search-results/product.html/pu9011zkit_mann-filter.html'),

      ('APP_FILTER6_LOGANMCV2_K9K872_95_FUEL_SOGEFI','Dacia','Logan MCV II','K8_','1.5 Blue dCi 95 K9K872 — Sogefi fuel housing','K9K 872','2018-05-01',NULL,'JOB_MAINT_FUEL_FILTER','fuel_filter','WK 12 008','Sogefi filtration system; housing with riveted lid','https://www.mann-filter.com/en/catalog/search-results/product.html/wk12008_mann-filter.html')
  ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,job_code,role_code,filter_ref,restrictions,source_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES(item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,item.production_from::date,item.production_to::date,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,variant=EXCLUDED.variant,
      engine_code=EXCLUDED.engine_code,production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,restrictions=EXCLUDED.restrictions;

    edge_code:=replace(item.app_code,'APP_FILTER6_','EDGE_FILTER6_');
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
      'RK Service Filters Coverage 06@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;
ALTER FUNCTION apply_repair_knowledge_service_filters_06() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_service_filters_06() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_service_filters_05(); PERFORM apply_repair_knowledge_service_filters_06();
END $$;
ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_service_filters_06();

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
 ('048_repair_knowledge_service_filters_05_k9k.sql'),
 ('049_repair_knowledge_service_filters_06_dacia.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '049_repair_knowledge_service_filters_06_dacia.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
