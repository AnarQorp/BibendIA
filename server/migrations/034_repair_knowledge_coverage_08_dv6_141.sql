-- 034: Repair Knowledge coverage expansion 08.
-- Scope: extend the already validated KP15656XS / VKMC 03316 family to
-- additional exact DV6/Ford engine codes. No generic 1.6 HDi/TDCi inference.

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
      ('APP_CITROEN_C3II_9HP_DV6DTED_TB_KIT','Citroen','C3 II','SC_',
       '1.6 HDi 92','9HP (DV6DTED)',NULL::date,NULL::date,
       '9HP DV6DTED 68 kW / 92 hp; 141 teeth / 25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_C3II_9HP_DV6DTED_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c3/c3-ii/32031-1-6-hdi'),

      ('APP_PEUGEOT_207_9HP_DV6DTED_TB_KIT','Peugeot','207','WA_/WC_',
       '1.6 HDi 92','9HP (DV6DTED)',DATE '2009-01-01',DATE '2012-12-31',
       '9HP DV6DTED 68 kW / 92 hp; 141 teeth / 25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_207_9HP_DV6DTED_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/peugeot/207/207-wa-wc/33260-1-6-hdi'),

      ('APP_CITROEN_C3PICASSO_9HP_DV6DTED_TB_KIT','Citroen','C3 Picasso','SH_',
       '1.6 HDi 92','9HP (DV6DTED)',DATE '2010-01-01',DATE '2015-12-31',
       '9HP DV6DTED 68 kW / 92 hp; 141 teeth / 25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_C3PICASSO_9HP_DV6DTED_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/citroen/c3/c3-picasso/33783-1-6-hdi-90'),

      ('APP_PEUGEOT_208I_9HD_DV6C_TB_KIT','Peugeot','208 I','CA_/CC_',
       '1.6 HDi 114','9HD (DV6C)',DATE '2012-01-01',DATE '2019-12-31',
       '9HD DV6C 84 kW / 114 hp; 141 teeth / 25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_208I_9HD_DV6C_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/peugeot/208/208-2012/8686-1-6-hdi'),

      ('APP_FORD_FOCUS3_T3DA_DV6_TB_KIT','Ford','Focus III','DYB',
       '1.6 TDCi 95','T3DA',DATE '2011-01-01',NULL::date,
       'T3DA 70 kW / 95 hp; 141 teeth / 25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_FOCUS3_T3DA_DV6_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/ford/focus/focus-iii-turnier/8170-1-6-tdci'),

      ('APP_FORD_FIESTA6_T3JA_DV6_TB_KIT','Ford','Fiesta VI','CB1/CCN/JA8/JR8',
       '1.6 TDCi 95','T3JA',NULL::date,DATE '2015-12-31',
       'T3JA 70 kW / 95 hp; 141 teeth / 25.4 mm; Gates KP15656XS / SKF VKMC 03316',
       'EDGE_FIESTA6_T3JA_DV6_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/ford/fiesta/fiesta-vi/33334-1-6-tdci')
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
        'applicability','DV6 141-tooth KP15656XS timing family',
        'specification','141 teeth / 25.4 mm',
        'oem_reference',NULL,
        'aftermarket_references',jsonb_build_object(
          'Gates kit','KP15656XS',
          'Gates belt','5656XS',
          'Gates tensioner','T43230',
          'Gates idler','T42307',
          'Gates water pump','WP0055',
          'Gates fastener set','SET62',
          'SKF kit','VKMC 03316'
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
      format('Exact page corroborates %s in the 141-tooth KP15656XS family.',item.engine_code),
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
    SELECT e.id,'Gates KP15656XS application catalog mirror',
      'https://plenty.parts/parts/gates/engine/gates-kp15656xs-water-pump-timing-belt-kit-powergrip-t7807451',
      'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      format('Independent Gates application/component list corroborates %s and the KP15656XS BOM.',item.engine_code),
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
 ('033_repair_knowledge_coverage_07_k9k636_646.sql'),('034_repair_knowledge_coverage_08_dv6_141.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '034_repair_knowledge_coverage_08_dv6_141.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
