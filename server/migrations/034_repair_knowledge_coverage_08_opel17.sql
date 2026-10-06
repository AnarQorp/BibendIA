-- 034: Repair Knowledge coverage expansion 08.
-- Scope: add verified Opel 1.7 CDTI 125 hp A17DTR/Z17DTR timing-belt + water-pump coverage.
-- Deliberately excludes Z17DTH 100/101 hp and adjacent 1.7 CDTI variants with different belt/kit families.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_08()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('APP_OPEL_ASTRAH_L48_Z17DTR_TB_KIT','Opel','Astra H','L48',
       '1.7 CDTI 125','Z17DTR',DATE '2007-01-01',DATE '2014-12-31',
       'Z17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 / SKF VKMC 05193',
       'EDGE_ASTRAH_L48_Z17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/opel/astra/astra-h-l48/22689-1-7-cdti-l48'),

      ('APP_OPEL_ASTRAH_L48_A17DTR_TB_KIT','Opel','Astra H','L48',
       '1.7 CDTI 125','A17DTR',DATE '2007-01-01',DATE '2014-12-31',
       'A17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 / SKF VKMC 05193; catalog page exposes A17DTR and Z17DTR',
       'EDGE_ASTRAH_L48_A17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/opel/astra/astra-h-l48/22689-1-7-cdti-l48'),

      ('APP_OPEL_ASTRAJ_P10_A17DTR_TB_KIT','Opel','Astra J','P10',
       '1.7 CDTI 125','A17DTR',DATE '2009-01-01',DATE '2015-12-31',
       'A17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 / SKF VKMC 05193',
       'EDGE_ASTRAJ_P10_A17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/opel/astra/astra-j/32092-1-7-cdti-68'),

      ('APP_OPEL_ASTRAJ_ST_P10_A17DTR_TB_KIT','Opel','Astra J Sports Tourer','P10',
       '1.7 CDTI 125','A17DTR',DATE '2010-01-01',DATE '2015-12-31',
       'A17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 / SKF VKMC 05193',
       'EDGE_ASTRAJ_ST_P10_A17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/opel/astra/astra-j-sports-tourer/1021-1-7-cdti-35'),

      ('APP_OPEL_ZAFIRAB_Z17DTR_TB_KIT','Opel','Zafira B','A05',
       '1.7 CDTI 125','Z17DTR',DATE '2007-01-01',DATE '2015-12-31',
       'Z17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 / SKF VKMC 05193',
       'EDGE_ZAFIRAB_Z17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/opel/zafira/zafira-b-a05/25503-1-7-cdti-m75'),

      ('APP_OPEL_ZAFIRAB_A17DTR_TB_KIT','Opel','Zafira B','A05',
       '1.7 CDTI 125','A17DTR',DATE '2007-01-01',DATE '2015-12-31',
       'A17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 / SKF VKMC 05193; catalog page exposes A17DTR and Z17DTR',
       'EDGE_ZAFIRAB_A17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/opel/zafira/zafira-b-a05/25503-1-7-cdti-m75'),

      ('APP_OPEL_CORSAD_Z17DTR_TB_KIT','Opel','Corsa D','S07',
       '1.7 CDTI 125','Z17DTR',DATE '2006-01-01',DATE '2011-12-31',
       'Z17DTR 92 kW / 125 hp; 131 teeth / 25 mm; Gates KP35623XS-1 family / Dayco KTBWP5310',
       'EDGE_CORSAD_Z17DTR_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/opel/corsa/corsa-d/19727-1-7-cdti-l08-l68')
    ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,restrictions,edge_code,fitment_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,
      item.production_from,item.production_to,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,
      model=EXCLUDED.model,
      generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,
      engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,
      production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT
      item.edge_code,a.id,j.id,r.id,'PART_ROLE',NULL,
      'REQUIRED','DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',NULL,false,
      jsonb_build_object(
        'applicability','Opel 1.7 CDTI 125 A17DTR/Z17DTR timing system',
        'specification','131 teeth / 25 mm',
        'oem_reference','Opel 93196791 / 98109416 family',
        'aftermarket_references',jsonb_build_object(
          'Gates kit','KP35623XS-1',
          'Gates belt','5623XS',
          'Gates tensioner','T43211',
          'Gates idler','T42140',
          'Gates water pump','WP0040',
          'SKF kit','VKMC 05193',
          'ContiTech kit','CT1105WP2',
          'Febi kit','173021'
        )
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code
      AND j.code='JOB_TIMING_BELT_WATER_PUMP'
      AND r.code='timing_belt_kit_water_pump'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,
      repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,
      item_kind=EXCLUDED.item_kind,
      quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,
      bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,
      condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,
      notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,
      reuse_status,notes,source_version)
    SELECT e.id,'AUTODOC exact vehicle/engine fitment',item.fitment_url,
      'VEHICLE_FITMENT_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      format('Exact Opel 1.7 CDTI page corroborates %s in the 131-tooth / 25 mm timing family and compatible water-pump kits.',item.engine_code),
      'RK Coverage Expansion 08@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,
      checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,
      source_version=EXCLUDED.source_version;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,
      reuse_status,notes,source_version)
    SELECT e.id,'Gates KP35623XS-1 kit BOM mirror',
      'https://www.distri-auto.es/gates/powergriptm-3227915-kp35623xs-1-3180668',
      'KIT_BOM_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      'Independent Gates kit breakdown corroborates 5623XS, T43211, T42140 and WP0040 for KP35623XS-1.',
      'RK Coverage Expansion 08@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,
      checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,
      source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_coverage_08() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_08() FROM PUBLIC;

CREATE OR REPLACE FUNCTION seed_repair_knowledge_poc_v1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_08();

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
 ('033_repair_knowledge_coverage_07_k9k636_646.sql'),('034_repair_knowledge_coverage_08_opel17.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '034_repair_knowledge_coverage_08_opel17.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
