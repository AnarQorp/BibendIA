-- 031: Repair Knowledge coverage expansion 05.
-- Scope: add verified DV6C / 1.6 HDi-TDCi timing-belt + water-pump coverage
-- for a deliberately narrow 141-tooth application family.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_05()
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
      ('APP_PEUGEOT_308I_9HR_DV6C_TB_KIT','Peugeot','308 I','4A/4C',
       '1.6 HDi 112','9HR (DV6C)',DATE '2009-01-01',DATE '2014-12-31',
       '9HR DV6C 82 kW / 112 hp; 141 teeth / 25-25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_308I_9HR_DV6C_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/peugeot/308/308-4a-4c/33271-1-6-hdi'),

      ('APP_CITROEN_C4II_9HR_DV6C_TB_KIT','Citroen','C4 II','NC/B7',
       '1.6 HDi 112','9HR (DV6C)',DATE '2009-01-01',NULL::date,
       '9HR DV6C 82 kW / 112 hp; 141 teeth / 25-25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_C4II_9HR_DV6C_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c4/c4-ii-b7/472-1-6-hdi-110'),

      ('APP_CITROEN_C4PICASSO1_9HR_DV6C_TB_KIT','Citroen','C4 Picasso I','UD',
       '1.6 HDi 112','9HR (DV6C)',DATE '2010-01-01',DATE '2013-12-31',
       '9HR DV6C 82 kW / 112 hp; 141 teeth / 25-25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_C4PICASSO1_9HR_DV6C_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c4/c4-picasso-i-ud/6442-1-6-hdi-110'),

      ('APP_PEUGEOT_508I_9HR_DV6C_TB_KIT','Peugeot','508 I','8D',
       '1.6 HDi 112','9HR (DV6C)',DATE '2010-01-01',DATE '2018-12-31',
       '9HR DV6C 82 kW / 112 hp; 141 teeth / 25-25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_508I_9HR_DV6C_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/peugeot/508/508-2010/713-1-6-hdi'),

      ('APP_FORD_FOCUS3_T1DA_DV6_TB_KIT','Ford','Focus III','DYB',
       '1.6 TDCi 115','T1DA',DATE '2011-01-01',DATE '2017-12-31',
       'T1DA DV6 85 kW / 115 hp; 141 teeth / 25-25.4 mm; Gates KP15656XS; Ford OE timing/water-pump family 2008686',
       'EDGE_FOCUS3_T1DA_DV6_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/ford/focus/focus-iii/8039-1-6-tdci'),

      ('APP_FORD_CMAX2_T1DA_DV6_TB_KIT','Ford','C-Max II','DXA/CB7/DXA/CEU',
       '1.6 TDCi 115','T1DA',DATE '2010-01-01',DATE '2019-12-31',
       'T1DA DV6 85 kW / 115 hp; 141 teeth / 25-25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_CMAX2_T1DA_DV6_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/ford/c-max/c-max-ii/71-1-6-tdci')
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
        'applicability','DV6C / Ford DV6 141-tooth timing family',
        'specification','141 teeth / 25-25.4 mm',
        'oem_reference',CASE WHEN item.make='Ford' THEN 'Ford 2008686 family' ELSE NULL END,
        'aftermarket_references',jsonb_build_object(
          'Gates kit','KP15656XS',
          'Gates belt','5656XS',
          'Gates tensioner','T43230',
          'Gates idler','T42307',
          'Gates water pump','WP0055',
          'Gates fastener set','SET62',
          'SKF kit','VKMC 03316',
          'Eurorepar kit','1689586380'
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
      'Exact DV6C/DV6 vehicle page corroborates the 141-tooth timing/water-pump family; factual fitment only.',
      'RK Coverage Expansion 05@2026-10-06'
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
    SELECT e.id,'Gates KP15656XS application catalog mirror',
      'https://plenty.parts/parts/gates/engine/gates-kp15656xs-water-pump-timing-belt-kit-powergrip-t7807451',
      'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      'Independent vehicle application list and Gates component breakdown for the 141-tooth DV6 family.',
      'RK Coverage Expansion 05@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,
      checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,
      source_version=EXCLUDED.source_version;

    IF item.make='Ford' THEN
      INSERT INTO repair_bom_evidence(
        edge_id,source,evidence_reference,source_type,checked_at,confidence_state,
        reuse_status,notes,source_version)
      SELECT e.id,'Ford OE parts catalog',
        'https://shop.ford.es/products/kit-de-correa-de-distribucion-y-bomba-de-agua-originales-para-ford-focus-mondeo-galaxy-1-6-tdci-2008686',
        'OEM_PART_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
        'ALLOW_FACT_DERIVATION',
        'Ford Spain identifies OE kit 2008686 for 1.6 TDCi timing-belt and water-pump applications.',
        'RK Coverage Expansion 05@2026-10-06'
      FROM repair_bom_edges e WHERE e.code=item.edge_code
      ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
        source_type=EXCLUDED.source_type,
        checked_at=EXCLUDED.checked_at,
        confidence_state=EXCLUDED.confidence_state,
        reuse_status=EXCLUDED.reuse_status,
        notes=EXCLUDED.notes,
        source_version=EXCLUDED.source_version;
    END IF;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_coverage_05() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_05() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_05();

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
 ('031_repair_knowledge_coverage_05_dv6c.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '031_repair_knowledge_coverage_05_dv6c.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
