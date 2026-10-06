-- 032: Repair Knowledge coverage expansion 06.
-- Scope: add verified VAG 1.9 TDI BKC/BLS/BXE timing-belt + water-pump coverage.
-- These engine codes are stored separately even where the technical result is equivalent.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_06()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  vehicle record;
  engine text;
  app_code text;
  edge_code text;
BEGIN
  FOR vehicle IN
    SELECT * FROM (VALUES
      ('VW_GOLF5','Volkswagen','Golf V','1K1',DATE '2003-01-01',DATE '2008-12-31',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/vw/golf/golf-v-1k1/17484-1-9-tdi'),
      ('AUDI_A3_8P1','Audi','A3 8P','8P1',DATE '2003-01-01',DATE '2010-05-31',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/audi/a3/a3-8p1/17398-1-9-tdi'),
      ('SEAT_LEON2','Seat','León II','1P1',DATE '2005-01-01',DATE '2010-12-31',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/seat/leon/leon-1p1/18769-1-9-tdi'),
      ('SKODA_OCTAVIA2_COMBI','Skoda','Octavia II Combi','1Z5',DATE '2004-01-01',DATE '2010-12-31',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/skoda/octavia/octavia-combi-1z5/18248-1-9-tdi'),
      ('VW_TOURAN1T2','Volkswagen','Touran I','1T1/1T2',DATE '2003-01-01',DATE '2010-12-31',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/vw/touran/touran-1t1-1t2/17768-1-9-tdi')
    ) AS v(code_base,make,model,generation,production_from,production_to,fitment_url)
  LOOP
    FOREACH engine IN ARRAY ARRAY['BKC','BLS','BXE']::text[]
    LOOP
      app_code := format('APP_%s_19TDI_%s_TB_KIT',vehicle.code_base,engine);
      edge_code := format('EDGE_%s_19TDI_%s_TB_KIT_001',vehicle.code_base,engine);

      INSERT INTO repair_vehicle_applicabilities(
        code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
      VALUES (
        app_code,vehicle.make,vehicle.model,vehicle.generation,'1.9 TDI 105',engine,
        vehicle.production_from,vehicle.production_to,
        format('%s 77 kW / 105 hp; 120 teeth / 30 mm; Gates KP55569XS-2 / SKF VKMC 01250-2',engine))
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
        edge_code,a.id,j.id,r.id,'PART_ROLE',NULL,
        'REQUIRED','DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',NULL,false,
        jsonb_build_object(
          'applicability','VAG 1.9 TDI BKC/BLS/BXE timing system',
          'specification','120 teeth / 30 mm',
          'oem_reference','VAG 038198119A / 03G198119A family',
          'aftermarket_references',jsonb_build_object(
            'Gates kit','KP55569XS-2',
            'Gates belt','5569XS',
            'Gates tensioner','T43091',
            'Gates idler','T41229',
            'Gates water pump','WP0087',
            'Gates fastener set','SET24',
            'SKF kit','VKMC 01250-2',
            'SKF timing kit','VKMA 01250',
            'SKF water pump','VKPC 81418'
          )
        )::text
      FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
      WHERE a.code=app_code
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
      SELECT e.id,'AUTODOC exact vehicle/engine-family fitment',vehicle.fitment_url,
        'VEHICLE_FITMENT_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
        'ALLOW_FACT_DERIVATION',
        format('Vehicle page exposes %s among the 1.9 TDI 105 engine-code filters and the 120-tooth kit family.',engine),
        'RK Coverage Expansion 06@2026-10-06'
      FROM repair_bom_edges e WHERE e.code=edge_code
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
      SELECT e.id,'Gates KP55569XS-2 application catalog mirror',
        'https://plenty.parts/parts/gates/engine/gates-kp55569xs2-water-pump-timing-belt-kit-powergrip-t7808397',
        'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
        'ALLOW_FACT_DERIVATION',
        format('Independent Gates application list explicitly maps %s 1.9 TDI 105 to this vehicle family and kit.',engine),
        'RK Coverage Expansion 06@2026-10-06'
      FROM repair_bom_edges e WHERE e.code=edge_code
      ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
        source_type=EXCLUDED.source_type,
        checked_at=EXCLUDED.checked_at,
        confidence_state=EXCLUDED.confidence_state,
        reuse_status=EXCLUDED.reuse_status,
        notes=EXCLUDED.notes,
        source_version=EXCLUDED.source_version;
    END LOOP;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_coverage_06() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_06() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_06();

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
 ('031_repair_knowledge_coverage_05_dv6c.sql'),('032_repair_knowledge_coverage_06_vag19tdi.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '032_repair_knowledge_coverage_06_vag19tdi.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
