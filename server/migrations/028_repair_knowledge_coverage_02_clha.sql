-- 028: Repair Knowledge coverage expansion 02.
-- Scope: replace ambiguous CLHA timing knowledge with explicit water-pump configurations
-- and expand the verified CLHA family across common MQB vehicles.
-- No paid data dependency and no diagnostic inference.

-- Repair knowledge already referenced by an estimate is historical evidence.
-- Keep it addressable by its original identifiers while excluding it from new
-- catalogue resolution.
ALTER TABLE repair_vehicle_applicabilities
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_02()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  skf_kit text;
  skf_url text;
  kit_spec text;
  pump_ref text;
BEGIN
  -- RK01 mixed several CLHA pump configurations under one applicability. It can
  -- no longer be selected for new estimates, but its edges and evidence remain
  -- immutable for historical estimate drafts.
  UPDATE repair_vehicle_applicabilities
  SET active=false
  WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_TIMING_BELT_WATER_PUMP';

  -- Two explicitly different configurations are admitted:
  --   SWITCH: switchable pump with integrated switch contact -> SKF VKMC 01278 / VKPC 81278
  --   NO_SWITCH: switchable pump without integrated switch contact -> SKF VKMC 01278-1 / VKPC 81178
  -- Both use the same CLHA timing-belt core (145 teeth / 25 mm), but they are not interchangeable.
  FOR item IN
    SELECT * FROM (VALUES
      ('APP_VW_GOLF7_CLHA_TB_SWITCH','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — pump with switch contact','CLHA',DATE '2012-08-01',DATE '2017-03-31',
       'CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump with integrated switch contact',
       'EDGE_GOLF7_CLHA_TB_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/vw/golf/golf-vii-5g1-be1/56145-1-6-tdi',
       true),
      ('APP_VW_GOLF7_CLHA_TB_NO_SWITCH','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — pump without switch contact','CLHA',DATE '2012-08-01',DATE '2017-03-31',
       'CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump without integrated switch contact',
       'EDGE_GOLF7_CLHA_TB_NO_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/vw/golf/golf-vii-5g1-be1/56145-1-6-tdi',
       false),
      ('APP_AUDI_A3_8VA_CLHA_TB_SWITCH','Audi','A3 Sportback 8V','8VA/8VF',
       '1.6 TDI CLHA — pump with switch contact','CLHA',NULL::date,NULL::date,
       'Catalog fitment 2012-2016; CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump with integrated switch contact',
       'EDGE_A3_8VA_CLHA_TB_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/audi/a3/a3-sportback-8va/57430-1-6-tdi',
       true),
      ('APP_AUDI_A3_8VA_CLHA_TB_NO_SWITCH','Audi','A3 Sportback 8V','8VA/8VF',
       '1.6 TDI CLHA — pump without switch contact','CLHA',NULL::date,NULL::date,
       'Catalog fitment 2012-2016; CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump without integrated switch contact',
       'EDGE_A3_8VA_CLHA_TB_NO_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/audi/a3/a3-sportback-8va/57430-1-6-tdi',
       false),
      ('APP_SEAT_LEON5F1_CLHA_TB_SWITCH','Seat','León III','5F1',
       '1.6 TDI CLHA — pump with switch contact','CLHA',NULL::date,NULL::date,
       'Catalog fitment 2012-2020; CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump with integrated switch contact',
       'EDGE_LEON5F1_CLHA_TB_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/seat/leon/leon-5f1/56777-1-6-tdi',
       true),
      ('APP_SEAT_LEON5F1_CLHA_TB_NO_SWITCH','Seat','León III','5F1',
       '1.6 TDI CLHA — pump without switch contact','CLHA',NULL::date,NULL::date,
       'Catalog fitment 2012-2020; CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump without integrated switch contact',
       'EDGE_LEON5F1_CLHA_TB_NO_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/seat/leon/leon-5f1/56777-1-6-tdi',
       false),
      ('APP_SKODA_OCTAVIA3_CLHA_TB_SWITCH','Skoda','Octavia III','5E3/NL3/NR3',
       '1.6 TDI CLHA — pump with switch contact','CLHA',NULL::date,NULL::date,
       'Catalog fitment 2012-2015; CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump with integrated switch contact',
       'EDGE_OCTAVIA3_CLHA_TB_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/skoda/octavia/octavia-5e3/58760-1-6-tdi',
       true),
      ('APP_SKODA_OCTAVIA3_CLHA_TB_NO_SWITCH','Skoda','Octavia III','5E3/NL3/NR3',
       '1.6 TDI CLHA — pump without switch contact','CLHA',NULL::date,NULL::date,
       'Catalog fitment 2012-2015; CLHA 77 kW / 105 hp; 145 teeth / 25 mm; switchable pump without integrated switch contact',
       'EDGE_OCTAVIA3_CLHA_TB_NO_SWITCH_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/skoda/octavia/octavia-5e3/58760-1-6-tdi',
       false)
    ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,restrictions,edge_code,fitment_url,has_switch_contact)
  LOOP
    IF item.has_switch_contact THEN
      skf_kit := 'VKMC 01278';
      skf_url := 'https://automotive.skf.com/eur/en/product-catalogue/VKMC01278';
      kit_spec := '145 teeth / 25 mm; switchable water pump with integrated switch contact';
      pump_ref := 'VKPC 81278';
    ELSE
      skf_kit := 'VKMC 01278-1';
      skf_url := 'https://automotive.skf.com/eap/en/product-catalogue/VKMC012781';
      kit_spec := '145 teeth / 25 mm; switchable water pump without integrated switch contact';
      pump_ref := 'VKPC 81178';
    END IF;

    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions,active)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,
      item.production_from,item.production_to,item.restrictions,true)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions,active=true;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT
      item.edge_code,a.id,j.id,r.id,'PART_ROLE',NULL,
      'REQUIRED','DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',NULL,false,
      jsonb_build_object(
        'applicability','CLHA 1.6 TDI explicit water-pump configuration',
        'specification',kit_spec,
        'oem_reference',NULL,
        'aftermarket_references',jsonb_build_object(
          'SKF',skf_kit,
          'SKF timing kit','VKMA 01278',
          'SKF water pump',pump_ref,
          'Gates timing belt','5678XS'
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
      'VEHICLE_FITMENT_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      'Exact CLHA vehicle page lists the corresponding SKF water-pump/timing-kit configuration; factual fitment only.',
      'RK Coverage Expansion 02@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,
      reuse_status,notes,source_version)
    SELECT e.id,'SKF Automotive product catalogue',skf_url,
      'TIER1_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      'Tier-1 product reference for the explicit pump-contact configuration; protected source content is not replicated.',
      'RK Coverage Expansion 02@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_coverage_02() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_02() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_02();

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
 ('027_repair_knowledge_coverage_01.sql'),('028_repair_knowledge_coverage_02_clha.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '028_repair_knowledge_coverage_02_clha.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
