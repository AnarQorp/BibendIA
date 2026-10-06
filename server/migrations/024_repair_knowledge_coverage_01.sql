-- 024: Repair Knowledge coverage expansion 01.
-- Scope: correct K9K 872 timing data and add verified K9K 872 vehicle applications.
-- No new RK architecture, no paid data dependency, no diagnostic inference.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_coverage_01()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
BEGIN
  -- Correct the PoC K9K 872 applicability. The original seed mixed pre-Blue-dCi
  -- K9K references (5671XS/VKMC 06143) with K9K 872.
  UPDATE repair_vehicle_applicabilities
  SET generation='LVA/M/N',
      variant='1.5 Blue dCi 95 (LVA2)',
      engine_code='K9K 872',
      production_from=DATE '2019-02-01',
      production_to=NULL,
      restrictions='K9K 872 Blue dCi; 119-tooth / 27 mm timing system; Gates KP15712XS / SKF VKMC 06140; applicability narrowed to Mégane IV Sedan LVA2'
  WHERE code='APP_RENAULT_MEGANE4_15DCI_K9K872_JOB_TIMING_BELT_WATER_PUMP';

  UPDATE repair_bom_edges
  SET notes='{"applicability":"Renault Mégane IV Sedan LVA2 — K9K 872 Blue dCi","specification":"119 teeth / 27 mm","oem_reference":null,"aftermarket_references":{"Gates":"5712XS","Continental":"CT1244","SKF":"SKF04649 / VKMA 06140"}}',
      bom_classification='MULTI_SOURCE_BOM',
      confidence_state='MULTI_SOURCE_VERIFIED'
  WHERE code='EDGE_MEGANE4_K9K_TB_001';

  UPDATE repair_bom_edges
  SET notes='{"applicability":"Renault Mégane IV Sedan LVA2 — K9K 872 Blue dCi","specification":"K9K 872 timing-belt tensioner","oem_reference":null,"aftermarket_references":{"Gates":"T43286","SKF":"VKM 16140"}}',
      bom_classification='MULTI_SOURCE_BOM',
      confidence_state='MULTI_SOURCE_VERIFIED'
  WHERE code='EDGE_MEGANE4_K9K_TB_002';

  UPDATE repair_bom_edges
  SET notes='{"applicability":"Renault Mégane IV Sedan LVA2 — K9K 872 Blue dCi","specification":"Water pump used by the verified K9K 872 timing kit","oem_reference":null,"aftermarket_references":{"Gates":"WP0077","SKF":"VKPC 86419"}}',
      bom_classification='DERIVED_FROM_KIT',
      confidence_state='MULTI_SOURCE_VERIFIED'
  WHERE code='EDGE_MEGANE4_K9K_TB_003';

  -- The prior coolant quantity/specification was not demonstrated to the same
  -- standard as the timing-kit fitment. Keep the edge but prevent automation.
  UPDATE repair_bom_edges
  SET quantity=NULL,
      condition='Required if cooling system opened; exact fluid specification and fill quantity require vehicle-specific confirmation',
      confidence_state='UNKNOWN',
      notes='{"applicability":"K9K 872 Blue dCi cooling circuit","specification":"Manual confirmation required before quote","oem_reference":null,"aftermarket_references":{}}'
  WHERE code='EDGE_MEGANE4_K9K_TB_004';

  DELETE FROM repair_bom_evidence
  WHERE edge_id IN (
    SELECT id FROM repair_bom_edges
    WHERE code IN ('EDGE_MEGANE4_K9K_TB_001','EDGE_MEGANE4_K9K_TB_002','EDGE_MEGANE4_K9K_TB_003','EDGE_MEGANE4_K9K_TB_004')
  );

  INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
  SELECT e.id,'AUTODOC vehicle fitment / Gates kit BOM',
    'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/megane/megane-iv-sedan/135260-1-5-blue-dci-95-lva2',
    'VEHICLE_FITMENT_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED','ALLOW_FACT_DERIVATION',
    'K9K 872 LVA2 fitment and Gates KP15712XS contents; factual fitment only, no protected catalog replicated.',
    'RK Coverage Expansion 01@2026-10-06'
  FROM repair_bom_edges e
  WHERE e.code IN ('EDGE_MEGANE4_K9K_TB_001','EDGE_MEGANE4_K9K_TB_002','EDGE_MEGANE4_K9K_TB_003')
  ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
    source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,confidence_state=EXCLUDED.confidence_state,
    reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

  INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
  SELECT e.id,'Winparts Gates KP15712XS application list',
    'https://www.winparts.eu/engine-parts-accessories/car-drive-belts/timing-belt/c606/water-pump-timing-belt-set-kp15712xs-gates/p1729965.html',
    'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED','ALLOW_FACT_DERIVATION',
    'Independent vehicle/application corroboration for K9K 872 and KP15712XS.',
    'RK Coverage Expansion 01@2026-10-06'
  FROM repair_bom_edges e
  WHERE e.code IN ('EDGE_MEGANE4_K9K_TB_001','EDGE_MEGANE4_K9K_TB_002','EDGE_MEGANE4_K9K_TB_003')
  ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
    source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,confidence_state=EXCLUDED.confidence_state,
    reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

  INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
  SELECT e.id,'Existing coolant evidence retained for manual review',
    'https://partsfinder.bilsteingroup.com',
    'TECHNICAL_RULE',DATE '2026-10-06','UNKNOWN','MANUAL_REVIEW_REQUIRED',
    'Previous coolant edge intentionally downgraded: exact K9K 872 fluid specification and fill quantity are not used automatically.',
    'RK Coverage Expansion 01@2026-10-06'
  FROM repair_bom_edges e WHERE e.code='EDGE_MEGANE4_K9K_TB_004'
  ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
    source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,confidence_state=EXCLUDED.confidence_state,
    reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

  -- First production expansion: exact K9K 872 applications for the same
  -- Gates KP15712XS / SKF VKMC 06140 timing-system family.
  FOR item IN
    SELECT * FROM (VALUES
      ('APP_NISSAN_QASHQAIJ11_15DCI_K9K872_JOB_TIMING_BELT_WATER_PUMP',
       'Nissan','Qashqai II','J11/J11_','1.5 dCi 116','K9K 872',DATE '2018-06-01',NULL::date,
       'K9K 872; 85 kW / 116 hp; Gates KP15712XS / SKF VKMC 06140',
       'EDGE_QASHQAIJ11_K9K872_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/nissan/qashqai/qashqai-j11-j11/133684-1-5-dci'),
      ('APP_DACIA_DUSTER2_15DCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
       'Dacia','Duster II','HM_','1.5 dCi 95 (HMAF)','K9K 872',DATE '2017-10-01',NULL::date,
       'K9K 872; 70 kW / 95 hp; Gates KP15712XS / SKF VKMC 06140',
       'EDGE_DUSTER2_K9K872_95_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/dacia/duster/duster/132854-1-5-dci-95-hmaf'),
      ('APP_DACIA_DUSTER2_15DCI115_K9K872_JOB_TIMING_BELT_WATER_PUMP',
       'Dacia','Duster II','HM_','1.5 dCi 115 (HMAD)','K9K 872',DATE '2017-10-01',NULL::date,
       'K9K 872; 85 kW / 116 hp; Gates KP15712XS',
       'EDGE_DUSTER2_K9K872_115_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/dacia/duster/duster/132855-1-5-dci-115-hmad'),
      ('APP_RENAULT_KANGOO2EXP_15DCI95_K9K872_JOB_TIMING_BELT_WATER_PUMP',
       'Renault','Kangoo II Express','FW0/1_','1.5 dCi 95 (FW16)','K9K 872',DATE '2019-10-01',NULL::date,
       'K9K 872; 70 kW / 95 hp; Gates KP15712XS / SKF VKMC 06140',
       'EDGE_KANGOO2EXP_K9K872_95_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/kangoo/kangoo-express-fw0-1/139307-1-5-dci-95-fw16'),
      ('APP_RENAULT_GRANDKANGOO2_15DCI115_K9K872_JOB_TIMING_BELT_WATER_PUMP',
       'Renault','Kangoo II / Grand Kangoo','KW/KW0/1','1.5 dCi 115 (KW17)','K9K 872',DATE '2019-03-01',NULL::date,
       'K9K 872; 85 kW / 115 hp; Gates KP15712XS / SKF VKMC 06140',
       'EDGE_GRANDKANGOO2_K9K872_115_TB_KIT_001',
       'https://www.autodoc.es/repuestos/bomba-de-agua-kit-de-distribucion-10553/renault/kangoo/kangoo-grand-kangoo-kw0-1/135955-1-5-dci-115-kw17')
    ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,restrictions,edge_code,fitment_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,item.production_from,item.production_to,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,variant=EXCLUDED.variant,
      engine_code=EXCLUDED.engine_code,production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,notes)
    SELECT item.edge_code,a.id,j.id,r.id,'PART_ROLE',NULL,'REQUIRED',
      'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',NULL,false,
      '{"applicability":"K9K 872 timing system","specification":"119 teeth / 27 mm; Gates PowerGrip kit with water pump","oem_reference":null,"aftermarket_references":{"Gates":"KP15712XS","Gates belt":"5712XS","Gates tensioner":"T43286","Gates water pump":"WP0077","Gates pulley bolt":"Z80504","SKF":"VKMC 06140"}}'
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_TIMING_BELT_WATER_PUMP' AND r.code='timing_belt_kit_water_pump'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,part_role_id=EXCLUDED.part_role_id,
      item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,requirement_type=EXCLUDED.requirement_type,
      bom_classification=EXCLUDED.bom_classification,confidence_state=EXCLUDED.confidence_state,
      condition=EXCLUDED.condition,replace_once=EXCLUDED.replace_once,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,'AUTODOC vehicle fitment / Gates kit BOM',item.fitment_url,
      'VEHICLE_FITMENT_KIT_BOM',DATE '2026-10-06','MULTI_SOURCE_VERIFIED','ALLOW_FACT_DERIVATION',
      'Exact vehicle/engine fitment plus Gates KP15712XS kit contents; factual fitment only, no protected catalog replicated.',
      'RK Coverage Expansion 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

    INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,'REXBO Gates KP15712XS application list',
      'https://www.rexbo.fr/gates/kit-de-distribution-pompe-a-eau-kp15712xs',
      'KIT_APPLICATION_CATALOG',DATE '2026-10-06','MULTI_SOURCE_VERIFIED','ALLOW_FACT_DERIVATION',
      'Independent application-list corroboration for K9K 872 and Gates KP15712XS.',
      'RK Coverage Expansion 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=item.edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_coverage_01() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_coverage_01() FROM PUBLIC;

-- Preserve callers/tests that use the original PoC seeder, but make the
-- correction/coverage layer idempotently re-apply after the historical seed.
DO $$
BEGIN
  IF to_regprocedure('public.seed_repair_knowledge_poc_v1_legacy()') IS NULL THEN
    ALTER FUNCTION seed_repair_knowledge_poc_v1() RENAME TO seed_repair_knowledge_poc_v1_legacy;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION seed_repair_knowledge_poc_v1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  PERFORM seed_repair_knowledge_poc_v1_legacy();
  PERFORM apply_repair_knowledge_coverage_01();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_coverage_01();

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
 ('023_reception_case_foundation.sql'),('024_repair_knowledge_coverage_01.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '024_repair_knowledge_coverage_01.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
