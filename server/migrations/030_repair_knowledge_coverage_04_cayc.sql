-- 030: Repair Knowledge coverage expansion 04.
-- Scope: add verified CAYC / EA189 timing-belt + water-pump coverage
-- across common VAG vehicles using a single corroborated kit family.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_04()
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
      ('APP_VW_GOLF6_CAYC_TB_KIT','Volkswagen','Golf VI','5K1',
       '1.6 TDI 105','CAYC',DATE '2009-01-01',DATE '2012-11-30',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_GOLF6_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/vw/golf/golf-vi-5k1/31340-1-6-tdi'),

      ('APP_AUDI_A3_8PA_CAYC_TB_KIT','Audi','A3 Sportback 8P','8PA',
       '1.6 TDI 105','CAYC',DATE '2009-01-01',DATE '2013-03-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_A3_8PA_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/audi/a3/a3-sportback-8pa/31319-1-6-tdi'),

      ('APP_SEAT_LEON1P_CAYC_TB_KIT','Seat','León II','1P1',
       '1.6 TDI 105','CAYC',DATE '2010-01-01',DATE '2012-12-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_LEON1P_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/seat/leon/leon-1p1/762-1-6-tdi'),

      ('APP_SEAT_IBIZA6JSC_CAYC_TB_KIT','Seat','Ibiza IV SportCoupe','6J1/6P1',
       '1.6 TDI 105','CAYC',DATE '2009-01-01',DATE '2015-12-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_IBIZA6JSC_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/seat/ibiza/ibiza-v-sportcoupe-6j1-6p1/32748-1-6-tdi'),

      ('APP_SKODA_OCTAVIA2_CAYC_TB_KIT','Skoda','Octavia II','1Z3',
       '1.6 TDI 105','CAYC',DATE '2009-01-01',DATE '2013-12-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_OCTAVIA2_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/skoda/octavia/octavia-1z3/31590-1-6-tdi'),

      ('APP_VW_TOURAN1T3_CAYC_TB_KIT','Volkswagen','Touran','1T3',
       '1.6 TDI 105','CAYC',DATE '2010-01-01',DATE '2015-12-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_TOURAN1T3_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/vw/touran/touran-1t3/55508-1-6-tdi'),

      ('APP_SEAT_ALTEA5P1_CAYC_TB_KIT','Seat','Altea','5P1',
       '1.6 TDI 105','CAYC',DATE '2009-01-01',DATE '2015-12-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_ALTEA5P1_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/seat/altea/altea-5p1/32744-1-6-tdi'),

      ('APP_SKODA_ROOMSTER5J_CAYC_TB_KIT','Skoda','Roomster','5J7',
       '1.6 TDI 105','CAYC',DATE '2010-01-01',DATE '2015-12-31',
       'CAYC 77 kW / 105 hp; 160 teeth / 25 mm; Gates KP25649XS-1 / SKF VKMC 01148-2',
       'EDGE_ROOMSTER5J_CAYC_TB_KIT_001',
       'https://www.autodoc.es/repuestos/juego-de-correas-dentadas-10505/skoda/roomster/roomster-5j/33321-1-6-tdi')
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
        'applicability','CAYC 1.6 TDI timing system',
        'specification','160 teeth / 25 mm',
        'oem_reference',NULL,
        'aftermarket_references',jsonb_build_object(
          'Gates kit','KP25649XS-1',
          'Gates belt','5649XS',
          'Gates tensioner','T43219',
          'Gates idler 1','T42044',
          'Gates idler 2','T42305',
          'Gates idler 3','T42309',
          'Gates water pump','WP0111',
          'Gates fastener set','SET11',
          'SKF kit','VKMC 01148-2',
          'SKF timing kit','VKMA 01148',
          'SKF water pump','VKPC 81269'
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
      'Exact CAYC vehicle page corroborates Gates KP25649XS-1 and/or SKF VKMC 01148-2 fitment and kit contents; factual fitment only.',
      'RK Coverage Expansion 04@2026-10-06'
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
    SELECT e.id,'Gates KP25649XS-1 application catalog mirror',
      'https://plenty.parts/parts/gates/engine/gates-kp25649xs1-water-pump-timing-belt-kit-powergrip-t7808163',
      'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      'Independent application list and Gates kit component breakdown for CAYC-compatible VAG vehicles.',
      'RK Coverage Expansion 04@2026-10-06'
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

ALTER FUNCTION apply_repair_knowledge_coverage_04() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_04() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_04();

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
 ('029_repair_knowledge_coverage_03_crmb.sql'),('030_repair_knowledge_coverage_04_cayc.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '030_repair_knowledge_coverage_04_cayc.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
