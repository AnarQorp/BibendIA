-- 038: Repair Knowledge maintenance coverage 03.
-- Scope: complete JOB_MAINT_SERVICE oil/filter coverage for the K9K 872 and
-- K9K 636/646 families already present in RK. Filter housing/start-stop
-- variants are explicit where MANN application data requires disambiguation.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_maintenance_03()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  filter_edge_code text;
  oil_edge_code text;
  filter_url text;
  filter_oe text;
  oil_qty numeric(10,3);
  oil_spec text;
  oil_source text;
  oil_url text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      -- K9K 872 / Blue dCi: 5.7 L service fill, RN17 family.
      ('APP_MAINT_RENAULT_MEGANE4_K9K872_W7032','Renault','Mégane IV','LVA/M/N','1.5 Blue dCi 95 — spin-on filter','K9K 872','W 7032','SPIN_ON',DATE '2019-02-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_NISSAN_QASHQAIJ11_K9K872_W7032','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 — spin-on filter','K9K 872','W 7032','SPIN_ON',DATE '2018-08-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_NISSAN_QASHQAIJ11_K9K872_HU618Y','Nissan','Qashqai II','J11/J11_','1.5 dCi 116 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2018-08-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_DACIA_DUSTER2_K9K872_HU618Y','Dacia','Duster II','HM_','1.5 Blue dCi — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2017-10-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_KANGOO2EXP_K9K872_HU618Y','Renault','Kangoo II Express','FW0/1_','1.5 dCi 95 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2019-03-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_KANGOO2_K9K872_HU618Y','Renault','Kangoo II / Grand Kangoo','KW/KW0/1','1.5 Blue dCi 115 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2019-03-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_DACIA_LODGY_K9K872_HU618Y','Dacia','Lodgy','JS_','1.5 Blue dCi — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2018-08-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_DACIA_DOKKER_K9K872_HU618Y','Dacia','Dokker','KE_','1.5 Blue dCi 95 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2018-12-01',DATE '2021-12-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_DACIA_DOKKEREXP_K9K872_HU618Y','Dacia','Dokker Express','FE_','1.5 Blue dCi 95 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2019-06-01',DATE '2021-12-31','MULTI_SOURCE_VERIFIED'),
      ('APP_MAINT_DACIA_LOGANMCV2_K9K872_HU618Y','Dacia','Logan MCV II','K8_','1.5 Blue dCi 95 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2018-05-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_DACIA_SANDERO2_K9K872_HU618Y','Dacia','Sandero II','B8_','1.5 Blue dCi 95 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2018-08-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_SYMBOL3_K9K872_W7032','Renault','Symbol / Thalia III','L8','1.5 dCi 95 — spin-on filter','K9K 872','W 7032','SPIN_ON',DATE '2019-11-01',NULL::date,'MULTI_SOURCE_VERIFIED'),
      ('APP_MAINT_NISSAN_NV250VAN_K9K872_HU618Y','Nissan','NV250 Van','X61','dCi 80 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2019-07-01',NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_NISSAN_NV250BUS_K9K872_HU618Y','Nissan','NV250 Bus','X61','dCi 80 — element filter','K9K 872','HU 618 y','ELEMENT',DATE '2019-07-01',NULL::date,'VERIFIED_MANUFACTURER'),

      -- K9K 636/646: 4.5 L, RN0720. Housing/start-stop is explicit where needed.
      ('APP_MAINT_NISSAN_QASHQAIJ11_K9K636_W7032','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 — spin-on filter','K9K 636','W 7032','SPIN_ON',NULL::date,DATE '2018-08-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_NISSAN_QASHQAIJ11_K9K636_HU618Y','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 — element filter','K9K 636','HU 618 y','ELEMENT',NULL::date,DATE '2018-08-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_NISSAN_QASHQAIJ11_K9K646_W7032','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 — spin-on filter','K9K 646','W 7032','SPIN_ON',NULL::date,DATE '2018-08-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_NISSAN_QASHQAIJ11_K9K646_HU618Y','Nissan','Qashqai II','J11/J11_','1.5 dCi 110 — element filter','K9K 646','HU 618 y','ELEMENT',NULL::date,DATE '2018-08-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_MEGANE3_K9K636_W7032','Renault','Mégane III','BZ0/1_, B3_','1.5 dCi 110 — start-stop','K9K 636','W 7032','START_STOP',NULL::date,DATE '2015-12-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_MEGANE3_K9K636_W79','Renault','Mégane III','BZ0/1_, B3_','1.5 dCi 110 — without start-stop','K9K 636','W 79','NO_START_STOP',NULL::date,DATE '2015-12-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_MEGANE3GT_K9K636_W7032','Renault','Mégane III Grandtour','KZ0/1_','1.5 dCi 110 — start-stop','K9K 636','W 7032','START_STOP',NULL::date,DATE '2015-12-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_MEGANE3GT_K9K636_W79','Renault','Mégane III Grandtour','KZ0/1_','1.5 dCi 110 — without start-stop','K9K 636','W 79','NO_START_STOP',NULL::date,DATE '2015-12-31','VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_KANGOO2_K9K636_W7032','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 — start-stop','K9K 636','W 7032','START_STOP',NULL::date,NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_KANGOO2_K9K636_W79','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 — without start-stop','K9K 636','W 79','NO_START_STOP',NULL::date,NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_KANGOO2_K9K646_W7032','Renault','Kangoo II / Grand Kangoo','KW0/1_','1.5 dCi 110 — start-stop','K9K 646','W 7032','START_STOP',NULL::date,NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_CAPTUR1_K9K646_W7032','Renault','Captur I','J5_/H5_','1.5 dCi 110','K9K 646','W 7032','SPIN_ON',NULL::date,NULL::date,'VERIFIED_MANUFACTURER'),
      ('APP_MAINT_RENAULT_CLIO4_K9K646_W7032','Renault','Clio IV','BH_','1.5 dCi 110','K9K 646','W 7032','SPIN_ON',DATE '2016-01-01',DATE '2021-12-31','VERIFIED_MANUFACTURER')
    ) AS v(app_code,make,model,generation,variant,engine_code,filter_ref,filter_variant,production_from,production_to,filter_confidence)
  LOOP
    IF item.filter_ref='HU 618 y' THEN
      filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu618y_mann-filter.html';
      filter_oe := 'Renault 15 20 925 67R / Nissan 15209-00Q0J';
    ELSIF item.filter_ref='W 79' THEN
      filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/w79_mann-filter.html';
      filter_oe := 'Renault application family';
    ELSE
      filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/w7032_mann-filter.html';
      filter_oe := 'Renault 15 20 895 99R / Nissan 15208-00Q1J';
    END IF;

    IF item.engine_code='K9K 872' THEN
      oil_qty := 5.7;
      oil_spec := 'Renault RN17 SAE 5W-30; RN17 FE / ACEA C5 0W-20 where the vehicle service plan specifies';
      oil_source := 'TecDoc/LakiNet service interval data — K9K 872';
      oil_url := 'https://uus.lakinet.ee/tecdoc/articles/en/p/93/38201/135260/100597/e100069%7C398100038/';
    ELSE
      oil_qty := 4.5;
      oil_spec := 'Renault RN0720 / ACEA C4; SAE 5W-30';
      oil_source := 'K9K 636/646 application oil data — RN0720';
      oil_url := 'https://www.autodoc.es/repuestos/aceite-de-motor-12094/nissan/nv200/nv200-evalia/10934-1-5-dci-110-m20-m20m';
    END IF;

    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,
      item.production_from,item.production_to,
      format('%s maintenance; oil filter %s (%s); %s',item.engine_code,item.filter_ref,item.filter_variant,oil_spec))
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    filter_edge_code := replace(item.app_code,'APP_MAINT_','EDGE_MAINT_') || '_OIL_FILTER';
    oil_edge_code := replace(item.app_code,'APP_MAINT_','EDGE_MAINT_') || '_ENGINE_OIL';

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT filter_edge_code,a.id,j.id,r.id,'PART_ROLE',NULL,'REQUIRED','EXPLICIT_BOM',
      item.filter_confidence,NULL,false,
      jsonb_build_object(
        'applicability',item.engine_code || ' oil-filter configuration',
        'specification',item.filter_variant,
        'oem_reference',filter_oe,
        'aftermarket_references',jsonb_build_object('MANN-FILTER',item.filter_ref)
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_MAINT_SERVICE' AND r.code='oil_filter'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,
      CASE WHEN item.filter_confidence='VERIFIED_MANUFACTURER'
        THEN 'MANN-FILTER official application catalogue'
        ELSE 'Exact vehicle fitment + MANN product cross-reference' END,
      filter_url,'TIER1_FILTER_CATALOG',DATE '2026-10-06',item.filter_confidence,
      'ALLOW_FACT_DERIVATION',
      format('%s / %s / %s maps to %s (%s).',item.make,item.model,item.engine_code,item.filter_ref,item.filter_variant),
      'RK Maintenance Coverage 03@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=filter_edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT oil_edge_code,a.id,j.id,r.id,'CONSUMABLE',oil_qty,'REQUIRED','EXPLICIT_BOM',
      'MULTI_SOURCE_VERIFIED',
      CASE WHEN item.engine_code='K9K 872'
        THEN 'Confirm RN17 versus RN17 FE against VIN/service plan before selecting the specific lubricant product'
        ELSE NULL END,
      false,
      jsonb_build_object(
        'applicability',item.engine_code || ' engine oil service',
        'specification',oil_spec,
        'service_fill_litres',oil_qty
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_MAINT_SERVICE' AND r.code='engine_oil'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,oil_source,oil_url,'VEHICLE_SERVICE_DATA',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      format('%s: service fill %s L; %s',item.engine_code,oil_qty::text,oil_spec),
      'RK Maintenance Coverage 03@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=oil_edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_maintenance_03() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_maintenance_03() FROM PUBLIC;

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
END $$;
ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_maintenance_03();

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
 ('037_repair_knowledge_maintenance_02_psa_ford.sql'),('038_repair_knowledge_maintenance_03_k9k.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '038_repair_knowledge_maintenance_03_k9k.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
