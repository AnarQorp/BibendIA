-- 035: Repair Knowledge coverage expansion 09.
-- Scope: add verified legacy PSA DV6 timing-belt + water-pump coverage.
-- Engines: 9HZ/9HY (DV6TED4) and 9HX (DV6ATED4), 137 teeth / 25 mm.
-- Deliberately excludes DV6C 141-tooth family already covered by schema 031.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_09()
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
      ('APP_CITROEN_C4I_9HZ_DV6TED4_TB_KIT','Citroen','C4 I','LC_',
       '1.6 HDi 109','9HZ (DV6TED4)',DATE '2004-01-01',DATE '2011-12-31',
       '9HZ DV6TED4 80 kW / 109 hp; 137 teeth / 25 mm; Gates KP15598XS / SKF VKMC 03259',
       'EDGE_C4I_9HZ_DV6TED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c4/c4-i-lc/18337-1-6-hdi'),

      ('APP_CITROEN_C4SEDAN_9HZ_DV6TED4_TB_KIT','Citroen','C4 Sedan','',
       '1.6 HDi 109','9HZ (DV6TED4)',DATE '2006-01-01',DATE '2011-12-31',
       '9HZ DV6TED4 80 kW / 109 hp; 137 teeth / 25 mm; Gates KP15598XS',
       'EDGE_C4SEDAN_9HZ_DV6TED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c4/c4-sedan/32802-1-6-hdi'),

      ('APP_CITROEN_C4GRANDPICASSO1_9HZ_DV6TED4_TB_KIT','Citroen','C4 Grand Picasso I','UA_',
       '1.6 HDi 109','9HZ (DV6TED4)',DATE '2006-01-01',DATE '2011-12-31',
       '9HZ DV6TED4 80 kW / 109 hp; 137 teeth / 25 mm; Gates KP15598XS',
       'EDGE_C4GRANDPICASSO1_9HZ_DV6TED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c4/c4-grand-picasso-i-ua/22483-1-6-hdi'),

      ('APP_PEUGEOT_308SW_9HY_DV6TED4_TB_KIT','Peugeot','308 SW','4E_/4H_',
       '1.6 HDi 109','9HY (DV6TED4)',DATE '2007-01-01',DATE '2014-12-31',
       '9HY DV6TED4 80 kW / 109 hp; 137 teeth / 25 mm; Gates KP15598XS',
       'EDGE_308SW_9HY_DV6TED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/peugeot/308/308-sw/26615-1-6-hdi'),

      ('APP_PEUGEOT_207_9HY_DV6TED4_TB_KIT','Peugeot','207','WA_/WC_',
       '1.6 HDi 109','9HY (DV6TED4)',DATE '2006-01-01',DATE '2013-12-31',
       '9HY DV6TED4 80 kW / 109 hp; 137 teeth / 25 mm; Gates KP15598XS / SKF VKMC 03259 family',
       'EDGE_207_9HY_DV6TED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/peugeot/207/207-wa-wc/19353-1-6-hdi'),

      ('APP_CITROEN_XSARAPICASSO_9HX_DV6ATED4_TB_KIT','Citroen','Xsara Picasso','N68',
       '1.6 HDi 90','9HX (DV6ATED4)',DATE '2005-01-01',DATE '2011-12-31',
       '9HX DV6ATED4 66 kW / 90 hp; 137 teeth / 25 mm; Gates KP15598XS / SKF VKMC 03259',
       'EDGE_XSARAPICASSO_9HX_DV6ATED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/xsara/xsara-picasso-n68/19010-1-6-hdi'),

      ('APP_CITROEN_C3II_9HX_DV6ATED4_TB_KIT','Citroen','C3 II','SC_',
       '1.6 HDi 90','9HX (DV6ATED4)',DATE '2009-01-01',DATE '2016-12-31',
       '9HX DV6ATED4 66 kW / 90 hp; 137 teeth / 25 mm; Gates KP15598XS / SKF VKMC 03259',
       'EDGE_C3II_9HX_DV6ATED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c3/c3-ii/33394-1-6-hdi-90'),

      ('APP_CITROEN_BERLINGOFIRST_9HX_DV6ATED4_TB_KIT','Citroen','Berlingo First','MF/GJK/GFK',
       '1.6 HDi 90','9HX (DV6ATED4)',DATE '2005-01-01',DATE '2008-12-31',
       '9HX DV6ATED4 66 kW / 90 hp; 137 teeth / 25 mm; Gates KP15598XS',
       'EDGE_BERLINGOFIRST_9HX_DV6ATED4_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/berlingo/berlingo-mf/19027-1-6-hdi-90-mf9hx')
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
        'applicability','Legacy PSA DV6 9HZ/9HY/9HX timing system',
        'specification','137 teeth / 25 mm',
        'oem_reference','PSA 1609525680KIT family',
        'aftermarket_references',jsonb_build_object(
          'Gates kit','KP15598XS',
          'Gates belt','5598XS',
          'Gates tensioner','T43158',
          'Gates idler','T42162',
          'Gates water pump','WP0055',
          'Gates fastener set','SET62',
          'SKF kit','VKMC 03259',
          'SKF timing kit','VKMA 03259',
          'SKF water pump','VKPC 83259',
          'ContiTech kit','CT1092WP1'
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
      format('Exact PSA DV6 page corroborates %s in the 137-tooth / 25 mm timing family.',item.engine_code),
      'RK Coverage Expansion 09@2026-10-06'
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
    SELECT e.id,'Gates official KP15598XS product catalogue',
      'https://www.gates.com/gb/en/power-transmission/power-transmission-components/tensioners.p.7782-000000-000002.v.7883-13074.html',
      'TIER1_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      'Gates official product catalogue confirms KP15598XS contents: 5598XS, T43158, T42162, WP0055 and SET62.',
      'RK Coverage Expansion 09@2026-10-06'
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

ALTER FUNCTION apply_repair_knowledge_coverage_09() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_09() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_coverage_09();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_09();

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
 ('035_repair_knowledge_coverage_09_dv6_legacy.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '035_repair_knowledge_coverage_09_dv6_legacy.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
