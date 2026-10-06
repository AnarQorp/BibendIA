-- 033: Repair Knowledge coverage expansion 07.
-- Scope: add verified K9K 636 / K9K 646 119-tooth timing-belt + water-pump coverage.
-- Deliberately excludes adjacent K9K codes unless explicitly evidenced in a later migration.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_07()
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
      ('APP_NISSAN_QASHQAIJ11_K9K636_TB_KIT','Nissan','Qashqai II','J11/J11_',
       '1.5 dCi 110','K9K 636',NULL::date,DATE '2018-08-31',
       'K9K 636 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS / SKF VKMC 06136; Gates restriction through 08/2018',
       'EDGE_QASHQAIJ11_K9K636_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/nissan/qashqai/qashqai-j11-j11/100507-1-5-dci'),

      ('APP_NISSAN_QASHQAIJ11_K9K646_TB_KIT','Nissan','Qashqai II','J11/J11_',
       '1.5 dCi 110','K9K 646',NULL::date,DATE '2018-08-31',
       'K9K 646 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS / SKF VKMC 06136; Gates restriction through 08/2018',
       'EDGE_QASHQAIJ11_K9K646_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/nissan/qashqai/qashqai-j11-j11/100507-1-5-dci'),

      ('APP_RENAULT_MEGANE3_BZ_K9K636_TB_KIT','Renault','Mégane III','BZ0/1_, B3_',
       '1.5 dCi 110','K9K 636',NULL::date,DATE '2015-12-31',
       'K9K 636 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS / SKF VKMC 06136',
       'EDGE_MEGANE3_BZ_K9K636_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/megane/megane-iii-fastback-bz0/29956-1-5-dci-bz09-bz0d-bz1w-bz29-bz14'),

      ('APP_RENAULT_MEGANE3_KZ_K9K636_TB_KIT','Renault','Mégane III Grandtour','KZ0/1_',
       '1.5 dCi 110','K9K 636',NULL::date,DATE '2015-12-31',
       'K9K 636 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS / SKF VKMC 06136',
       'EDGE_MEGANE3_KZ_K9K636_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/megane/megane-iii-grandtour-kz0-1/31536-1-5-dci-kz09-kz0d-kz1g-kz29-kz14-kz1w-kz10-kz1f'),

      ('APP_RENAULT_KANGOO2_K9K636_TB_KIT','Renault','Kangoo II / Grand Kangoo','KW0/1_',
       '1.5 dCi 110','K9K 636',NULL::date,NULL::date,
       'K9K 636 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS',
       'EDGE_KANGOO2_K9K636_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/kangoo/kangoo-grand-kangoo-kw0-1/108444-1-5-dci-110-kw06-kw12'),

      ('APP_RENAULT_KANGOO2_K9K646_TB_KIT','Renault','Kangoo II / Grand Kangoo','KW0/1_',
       '1.5 dCi 110','K9K 646',NULL::date,NULL::date,
       'K9K 646 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS',
       'EDGE_KANGOO2_K9K646_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/kangoo/kangoo-grand-kangoo-kw0-1/108444-1-5-dci-110-kw06-kw12'),

      ('APP_RENAULT_CAPTUR1_K9K646_TB_KIT','Renault','Captur I','J5_/H5_',
       '1.5 dCi 110','K9K 646',NULL::date,NULL::date,
       'K9K 646 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS / SKF VKMC 06136',
       'EDGE_CAPTUR1_K9K646_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/captur/captur/112332-1-5-dci-110'),

      ('APP_RENAULT_CLIO4_K9K646_TB_KIT','Renault','Clio IV','BH_',
       '1.5 dCi 110','K9K 646',DATE '2016-01-01',DATE '2021-12-31',
       'K9K 646 81 kW / 110 hp; 119 teeth / 27 mm; Gates KP15675XS',
       'EDGE_CLIO4_K9K646_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/clio/clio-iv/122130-1-5-dci-110')
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
        'applicability','K9K 636/646 1.5 dCi 110 timing system',
        'specification','119 teeth / 27 mm',
        'oem_reference',NULL,
        'aftermarket_references',jsonb_build_object(
          'Gates kit','KP15675XS',
          'Gates belt','5675XS',
          'Gates tensioner','T43240',
          'Gates water pump','WP0077',
          'Gates pulley bolt','Z80504',
          'SKF kit','VKMC 06136',
          'SKF timing kit','VKMA 06136',
          'SKF water pump','VKPC 86419'
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
    SELECT e.id,'AUTODOC exact vehicle/engine-family fitment',item.fitment_url,
      'VEHICLE_FITMENT_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      format('Vehicle page corroborates %s in the 119-tooth / 27 mm KP15675XS family.',item.engine_code),
      'RK Coverage Expansion 07@2026-10-06'
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
    SELECT e.id,'Gates KP15675XS application catalog mirror',
      'https://plenty.parts/parts/gates/engine/gates-kp15675xs-water-pump-timing-belt-kit-powergrip-t7807461',
      'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED',
      'ALLOW_FACT_DERIVATION',
      format('Independent Gates application list maps %s to the corresponding vehicle family and KP15675XS.',item.engine_code),
      'RK Coverage Expansion 07@2026-10-06'
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

ALTER FUNCTION apply_repair_knowledge_coverage_07() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_07() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_07();

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
 ('033_repair_knowledge_coverage_07_k9k636_646.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '033_repair_knowledge_coverage_07_k9k636_646.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
