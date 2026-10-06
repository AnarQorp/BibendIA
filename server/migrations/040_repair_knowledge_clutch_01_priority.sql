-- 040: Repair Knowledge clutch + dual-mass-flywheel coverage 01.
-- Scope: correct the historical Golf VII CLHA clutch seed and add verified
-- manual-transmission clutch+DMF configurations for priority RK vehicles.
-- Engine code alone is never treated as sufficient fitment evidence.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_clutch_01()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  edge_code text;
BEGIN
  -- Historical PoC used LuK 600 0016 00, a VAG 1.9 TDI family kit, for CLHA.
  -- Remove that applicability and rebuild it below for the actual CLHA/MWW manual configuration.
  DELETE FROM repair_bom_evidence
  WHERE edge_id IN (
    SELECT e.id FROM repair_bom_edges e
    JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
    WHERE a.code='APP_VAG_GOLF7_16TDI_CLHA_JOB_CLUTCH_DMF_KIT'
  );
  DELETE FROM repair_bom_edges
  WHERE applicability_id=(
    SELECT id FROM repair_vehicle_applicabilities
    WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_CLUTCH_DMF_KIT'
  );
  DELETE FROM repair_vehicle_applicabilities
  WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_CLUTCH_DMF_KIT';

  FOR item IN
    SELECT * FROM (VALUES
      ('APP_CLT_GOLF7_CLHA_MWW','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — MWW manual 5-speed','CLHA',
       'MWW manual 5-speed; Start&Stop; do not use for DSG',
       'MULTI_SOURCE_BOM','MULTI_SOURCE_VERIFIED',
       '{"SACHS clutch":"3000 970 069","SACHS DMF":"3021 600 288"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/vw/golf/golf-vii-5g1-be1/56145-1-6-tdi',
       'https://www.autodoc.es/repuestos/volante-motor-10157/vw/golf/golf-vii-5g1-be1/56145-1-6-tdi',
       'Exact CLHA clutch page + exact CLHA manual flywheel page; MWW manual gearbox is explicitly documented.'),

      ('APP_CLT_A3_8V_CLHA_NTG','Audi','A3 Sportback 8V','8VA/8VF',
       '1.6 TDI CLHA — NTG manual 6-speed','CLHA',
       'NTG manual 6-speed; build window for Valeo 837074; do not use for S tronic',
       'EXPLICIT_BOM','MULTI_SOURCE_VERIFIED',
       '{"Valeo FULLPACK DMF":"837074"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/audi/a3/a3-sportback-8va/57430-1-6-tdi',
       'https://www.valeoservice.co.uk/en-uk/techassist/supplier/21/product/837074',
       'Exact A3 CLHA/NTG fitment plus Valeo official FULLPACK DMF product definition.'),

      ('APP_CLT_GOLF6_CAYC_NO_SS','Volkswagen','Golf VI','5K1',
       '1.6 TDI CAYC — manual 5-speed — without Start&Stop','CAYC',
       'Manual 5-speed; without Start&Stop; LuK 600 0199 00 applicability is build/VIN restricted',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0199 00","LuK clutch":"623 3094 00","LuK DMF":"415 0574 10","LuK flywheel bolts":"411 0133 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/vw/golf/golf-vi-5k1/31340-1-6-tdi',
       'https://www.trodo.es/kit-de-embrague-luk-600-0199-00',
       'Exact Golf VI CAYC fitment plus independent LuK 600 0199 00 product definition.'),

      ('APP_CLT_A3_8P_CAYC_NO_SS','Audi','A3 Sportback 8P','8PA',
       '1.6 TDI CAYC — manual — without Start&Stop','CAYC',
       'Manual transmission; without Start&Stop; LuK 600 0199 00',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0199 00","LuK clutch":"623 3094 00","LuK DMF":"415 0574 10","LuK flywheel bolts":"411 0133 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/audi/a3/a3-8p1/31317-1-6-tdi',
       'https://www.trodo.es/kit-de-embrague-luk-600-0199-00',
       'Exact A3 CAYC fitment plus independent LuK 600 0199 00 product definition.'),

      ('APP_CLT_LEON2_CAYC_NO_SS','Seat','León II','1P1',
       '1.6 TDI CAYC — manual 5-speed — without Start&Stop','CAYC',
       'Manual 5-speed; without Start&Stop; LuK 600 0199 00; Start&Stop uses a different kit path',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0199 00","LuK clutch":"623 3094 00","LuK DMF":"415 0574 10","LuK flywheel bolts":"411 0133 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/seat/leon/leon-1p1/762-1-6-tdi',
       'https://www.trodo.es/kit-de-embrague-luk-600-0199-00',
       'Exact León II CAYC catalogue exposes LuK 600 0199 00 and a separate Start&Stop FULLPACK family.'),

      ('APP_CLT_OCTAVIA2_CAYC_NO_SS','Skoda','Octavia II','1Z3',
       '1.6 TDI CAYC — manual 5-speed — without Start&Stop','CAYC',
       'Manual 5-speed; without Start&Stop; LuK 600 0199 00; early build restriction',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0199 00","LuK clutch":"623 3094 00","LuK DMF":"415 0574 10","LuK flywheel bolts":"411 0133 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/skoda/octavia/octavia-1z3/31590-1-6-tdi',
       'https://www.trodo.es/kit-de-embrague-luk-600-0199-00',
       'Exact Octavia II CAYC fitment plus independent LuK 600 0199 00 product definition.'),

      ('APP_CLT_FOCUS3_T1DA_MAN6','Ford','Focus III','DYB',
       '1.6 TDCi 115 T1DA — manual 6-speed','T1DA',
       'Manual 6-speed; LuK 600 0277 00; not for automated transmission',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0277 00","LuK CSC":"510 0162 10","LuK clutch":"624 3774 33","LuK DMF":"415 0537 11"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/ford/focus/focus-iii/8039-1-6-tdci',
       'https://www.autodoc.es/luk/13766305',
       'Exact Focus III T1DA fitment plus LuK RepSet DMF technical contents.'),

      ('APP_CLT_QASHQAIJ11_K9K636_TL4','Nissan','Qashqai II','J11/J11_',
       '1.5 dCi 110 K9K 636 — TL4 manual — to 05/2018','K9K 636',
       'TL4 manual transmission; LuK 600 0197 00; application through 05/2018',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0197 00","LuK CSC":"510 0164 10","LuK clutch":"623 3544 33","LuK DMF":"415 0400 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/nissan/qashqai/qashqai-j11-j11/100507-1-5-dci',
       'https://www.trodo.es/kit-de-embrague-luk-600-0197-00',
       'Exact Qashqai J11 fitment plus independent LuK 600 0197 00 product definition.'),

      ('APP_CLT_MEGANE3_K9K636_TL4','Renault','Mégane III','BZ0/1_, B3_',
       '1.5 dCi 110 K9K 636 — TL4 manual','K9K 636',
       'TL4 manual transmission; VIN/type BZ0D where applicable; LuK 600 0197 00',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0197 00","LuK CSC":"510 0164 10","LuK clutch":"623 3544 33","LuK DMF":"415 0400 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/renault/megane/megane-iii-fastback-bz0/29956-1-5-dci-bz09-bz0d-bz1w-bz29-bz14',
       'https://www.trodo.es/kit-de-embrague-luk-600-0197-00',
       'Exact Mégane III K9K 636/TL4 fitment plus LuK kit definition.'),

      ('APP_CLT_MEGANE3GT_K9K636_TL4','Renault','Mégane III Grandtour','KZ0/1_',
       '1.5 dCi 110 K9K 636 — TL4 manual','K9K 636',
       'TL4 manual transmission; LuK 600 0197 00',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0197 00","LuK CSC":"510 0164 10","LuK clutch":"623 3544 33","LuK DMF":"415 0400 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/renault/megane/megane-iii-grandtour-kz0-1/31536-1-5-dci-kz09-kz0d-kz1g-kz29-kz14-kz1w-kz10-kz1f',
       'https://www.trodo.es/kit-de-embrague-luk-600-0197-00',
       'Exact Mégane III Grandtour K9K 636/TL4 fitment plus LuK kit definition.'),

      ('APP_CLT_CAPTUR1_K9K646_TL4','Renault','Captur I','J5_/H5_',
       '1.5 dCi 110 K9K 646 — TL4 manual — to 07/2018','K9K 646',
       'TL4/manual family; LuK 600 0197 00 through 07/2018',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0197 00","LuK CSC":"510 0164 10","LuK clutch":"623 3544 33","LuK DMF":"415 0400 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/renault/captur/captur/112332-1-5-dci-110',
       'https://www.trodo.es/kit-de-embrague-luk-600-0197-00',
       'Exact Captur K9K 646 fitment plus LuK kit definition.'),

      ('APP_CLT_CLIO4_K9K646_TL4','Renault','Clio IV','BH_',
       '1.5 dCi 110 K9K 646 — TL4 manual','K9K 646',
       'TL4 manual 6-speed; LuK 600 0197 00',
       'DERIVED_FROM_KIT','MULTI_SOURCE_VERIFIED',
       '{"LuK RepSet DMF":"600 0197 00","LuK CSC":"510 0164 10","LuK clutch":"623 3544 33","LuK DMF":"415 0400 10"}',
       'https://www.autodoc.es/repuestos/juego-de-embragues-10151/renault/clio/clio-iv/122130-1-5-dci-110',
       'https://www.trodo.es/kit-de-embrague-luk-600-0197-00',
       'Exact Clio IV K9K 646/TL4 fitment plus LuK kit definition.')
    ) AS v(app_code,make,model,generation,variant,engine_code,restrictions,bom_classification,confidence_state,refs_json,fitment_url,product_url,evidence_note)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,NULL,NULL,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    edge_code := replace(item.app_code,'APP_CLT_','EDGE_CLT_') || '_KIT';

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT edge_code,a.id,j.id,r.id,'PART_ROLE',1,'REQUIRED',
      item.bom_classification,item.confidence_state,NULL,false,
      jsonb_build_object(
        'applicability',item.variant,
        'specification','Clutch + dual-mass flywheel package for the explicit transmission configuration',
        'aftermarket_references',item.refs_json::jsonb
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_CLUTCH_DMF_KIT' AND r.code='clutch_dmf_kit_complete'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,'Exact vehicle/engine/transmission fitment catalogue',item.fitment_url,
      'VEHICLE_TRANSMISSION_FITMENT',DATE '2026-10-06',item.confidence_state,
      'ALLOW_FACT_DERIVATION',item.evidence_note,'RK Clutch Coverage 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,
      CASE WHEN item.app_code='APP_CLT_A3_8V_CLHA_NTG'
        THEN 'Valeo official product catalogue'
        ELSE 'Independent clutch/DMF product definition' END,
      item.product_url,'CLUTCH_DMF_KIT_BOM',DATE '2026-10-06',item.confidence_state,
      'ALLOW_FACT_DERIVATION',
      'Independent kit-content/product evidence corroborates the clutch + DMF package and included hardware.',
      'RK Clutch Coverage 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_clutch_01() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_clutch_01() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_brakes_01();
  PERFORM apply_repair_knowledge_clutch_01();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_clutch_01();

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
 ('037_repair_knowledge_maintenance_02_psa_ford.sql'),('038_repair_knowledge_maintenance_03_k9k.sql'),
 ('039_repair_knowledge_brakes_01_priority.sql'),('040_repair_knowledge_clutch_01_priority.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '040_repair_knowledge_clutch_01_priority.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
