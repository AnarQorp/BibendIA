-- 039: Repair Knowledge brakes coverage 01.
-- Scope: expand JOB_BRAKE_DISCS_PADS_FRONT across priority vehicles already present in RK.
-- Brake size / PR / RPO / ESP variants are explicit; no inference from engine family alone.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_brakes_01()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  disc_edge text;
  pad_edge text;
BEGIN
  -- Replace the historical generic Golf VII CLHA brake row with explicit PR-code variants.
  DELETE FROM repair_bom_evidence
  WHERE edge_id IN (
    SELECT e.id FROM repair_bom_edges e
    JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
    WHERE a.code='APP_VAG_GOLF7_16TDI_CLHA_JOB_BRAKE_DISCS_PADS_FRONT'
  );
  DELETE FROM repair_bom_edges
  WHERE applicability_id=(
    SELECT id FROM repair_vehicle_applicabilities
    WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_BRAKE_DISCS_PADS_FRONT'
  );
  DELETE FROM repair_vehicle_applicabilities
  WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_BRAKE_DISCS_PADS_FRONT';

  FOR item IN
    SELECT * FROM (VALUES
      ('APP_BRK_GOLF7_CLHA_PR1ZF_276','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — PR 1ZF — 276 mm','CLHA',
       'PR 1ZF; 276x24 mm ventilated front disc; Teves front pad set',
       '09.C547.11','276x24 mm ventilated','P 85 137','Teves; electric wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/vw-golf-vii-5g1-bq1-be1-be2-1-6-tdi/000056145-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_GOLF7_CLHA_PR1ZE_288','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2',
       '1.6 TDI CLHA — PR 1ZE/1ZP — 288 mm','CLHA',
       'PR 1ZE/1ZP; 288x25 mm ventilated front disc; TRW front pad set',
       '09.9145.11','288x25 mm ventilated','P 85 126','TRW; electric wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/vw-golf-vii-5g1-bq1-be1-be2-1-6-tdi/000056145-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_A3_8V_CLHA_PR1ZF_276','Audi','A3 Sportback 8V','8VA/8VF',
       '1.6 TDI CLHA — PR 1ZF — 276 mm','CLHA',
       'PR 1ZF; 276x24 mm ventilated front disc; Teves front pad set',
       '09.C547.11','276x24 mm ventilated','P 85 137','Teves; electric wear indicator',
       'https://www.bremboparts.com/europe/en/catalogue/audi-a3-sportback-8va-8vf-1-6-tdi/000057430-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_A3_8V_CLHA_PR1ZE_288','Audi','A3 Sportback 8V','8VA/8VF',
       '1.6 TDI CLHA — PR 1ZE/1ZP — 288 mm','CLHA',
       'PR 1ZE/1ZP; 288x25 mm ventilated front disc; TRW front pad set',
       '09.9145.11','288x25 mm ventilated','P 85 126','TRW; electric wear indicator',
       'https://www.bremboparts.com/europe/en/catalogue/audi-a3-sportback-8va-8vf-1-6-tdi/000057430-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_LEON3_CLHA_PR1ZF_276','Seat','León III','5F1',
       '1.6 TDI CLHA — PR 1ZF — 276 mm','CLHA',
       'PR 1ZF; 276x24 mm ventilated front disc; Teves front pad set',
       '09.C547.11','276x24 mm ventilated','P 85 137','Teves; electric wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/seat-leon-5f1-1-6-tdi/000056777-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_LEON3_CLHA_PR1ZE_288','Seat','León III','5F1',
       '1.6 TDI CLHA — PR 1ZE/1ZJ — 288 mm','CLHA',
       'PR 1ZE/1ZJ; 288x25 mm ventilated front disc; TRW front pad set',
       '09.9145.11','288x25 mm ventilated','P 85 126','TRW; electric wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/seat-leon-5f1-1-6-tdi/000056777-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_GOLF6_CAYC_PR1ZF_280','Volkswagen','Golf VI','5K1',
       '1.6 TDI 105 — PR 1ZF — 280 mm','CAYC',
       'PR 1ZF; 280x22 mm ventilated front disc; Teves front pad set',
       '09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/vw-golf-vi-5k1-1-6-tdi/000031340-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_IBIZA4SC_CAYC_PR1LQ_256','Seat','Ibiza IV SportCoupe','6J1/6P1',
       '1.6 TDI 105 — PR 1LQ/1LR — 256 mm','CAYC',
       'PR 1LQ/1LR; 256x22 mm ventilated front disc; ATE/Teves pad set',
       '09.7011.11','256x22 mm ventilated','P 85 041','ATE/Teves/Continental; no wear contact',
       'https://www.autodoc.es/repuestos/pastilla-de-freno-10130/seat/ibiza/ibiza-v-sportcoupe-6j1-6p1/32748-1-6-tdi','MULTI_SOURCE_VERIFIED'),

      ('APP_BRK_308I_9HR_283_BOSCH','Peugeot','308 I','4A/4C',
       '1.6 HDi 112 — Bosch — 283 mm','9HR (DV6C)',
       'Bosch front brake system; 283x26 mm ventilated disc',
       '09.9619.11','283x26 mm ventilated','P 61 101','Bosch; no wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/peugeot-308-i-4a-4c-1-6-hdi/000033271-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_FOCUS3_T1DA_278_STANDARD','Ford','Focus III','DYB',
       '1.6 TDCi 115 — standard brakes — 278 mm','T1DA',
       'Vehicle without sport package; 278x25 mm ventilated front disc',
       '09.A905.11','278x25 mm ventilated','P 24 061','Teves; no wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/ford-focus-iii-1-6-tdci/000008039-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_QASHQAIJ11_K9K636_296_AKEBONO','Nissan','Qashqai II','J11/J11_',
       '1.5 dCi 110 — Akebono — 296 mm','K9K 636',
       '296x26 mm ventilated front disc; Akebono front pad set',
       '09.C545.11','296x26 mm ventilated','P 56 100','Akebono; acoustic wear indicator; with accessories',
       'https://www.bremboparts.com/europe/es/catalogue/nissan-qashqai-ii-j11-j11-1-5-dci/000100507-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_CLIO4_K9K646_258_TEVES','Renault','Clio IV','BH_',
       '1.5 dCi 110 — 15/16 inch brakes — 258 mm','K9K 646',
       '15/16 inch front brake; 258x22 mm ventilated disc; Teves pads',
       '09.9078.21','258x22 mm ventilated','P 68 065','Teves; no wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/renault-clio-iv-bh-1-5-dci-110/000122130-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_ASTRAJ_A17DTR_276_15IN','Opel','Astra J','P10',
       '1.7 CDTI 125 — 15 inch brakes — 276 mm','A17DTR',
       '15 inch front brake; 276x26 mm ventilated disc',
       '09.B355.11','276x26 mm ventilated','P 59 076','Bosch; acoustic wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/opel-astra-j-p10-1-7-cdti-68/000032092-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_ASTRAJ_A17DTR_300_16IN','Opel','Astra J','P10',
       '1.7 CDTI 125 — 16 inch brakes — 300 mm','A17DTR',
       '16 inch front brake; 300x26 mm ventilated disc',
       '09.B356.11','300x26 mm ventilated','P 59 077','Bosch; acoustic wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/opel-astra-j-p10-1-7-cdti-68/000032092-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_DUSTER2_K9K872_280_ESP','Dacia','Duster II','HM_',
       '1.5 dCi 115 — ESP — 280 mm','K9K 872',
       'Vehicle with ESP; 280x24 mm ventilated front disc; Teves pads',
       '09.A727.11','280x24 mm ventilated','P 68 050','Teves; no wear indicator',
       'https://www.bremboparts.com/europe/en/catalogue/dacia-duster-hm-1-5-dci-115-hmad/000132855-1','VERIFIED_MANUFACTURER'),

      ('APP_BRK_C4I_9HZ_283_OPR12054','Citroen','C4 I','LC_',
       '1.6 HDi 109 — OPR >= 12054 — 283 mm','9HZ (DV6TED4)',
       'OPR >= 12054; Bosch front pads; 283x26 mm ventilated front disc',
       '09.9619.11','283x26 mm ventilated','P 61 137','Bosch; no wear indicator',
       'https://www.bremboparts.com/europe/es/catalogue/citro%C3%ABn-c4-i-lc-1-6-hdi/000018337-1','VERIFIED_MANUFACTURER')
    ) AS v(app_code,make,model,generation,variant,engine_code,restrictions,disc_ref,disc_spec,pad_ref,pad_spec,source_url,confidence_state)
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

    disc_edge := replace(item.app_code,'APP_BRK_','EDGE_BRK_') || '_DISC';
    pad_edge := replace(item.app_code,'APP_BRK_','EDGE_BRK_') || '_PAD';

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT disc_edge,a.id,j.id,r.id,'PART_ROLE',2,'REQUIRED',
      'EXPLICIT_BOM',item.confidence_state,NULL,false,NULL,'FRONT','FRONT_AXLE',
      jsonb_build_object(
        'specification',item.disc_spec,
        'aftermarket_references',jsonb_build_object('Brembo',item.disc_ref)
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_BRAKE_DISCS_PADS_FRONT' AND r.code='brake_disc_front'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,side=EXCLUDED.side,axle=EXCLUDED.axle,
      position=EXCLUDED.position,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT pad_edge,a.id,j.id,r.id,'PART_ROLE',NULL,'REQUIRED',
      'EXPLICIT_BOM',item.confidence_state,NULL,false,NULL,'FRONT','FRONT_AXLE',
      jsonb_build_object(
        'specification',item.pad_spec,
        'aftermarket_references',jsonb_build_object('Brembo',item.pad_ref)
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_BRAKE_DISCS_PADS_FRONT' AND r.code='brake_pad_front'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,
      replace_once=EXCLUDED.replace_once,side=EXCLUDED.side,axle=EXCLUDED.axle,
      position=EXCLUDED.position,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,
      CASE WHEN item.app_code='APP_BRK_IBIZA4SC_CAYC_PR1LQ_256'
        THEN 'Brembo / AUTODOC exact SportCoupe fitment'
        ELSE 'Brembo Parts official vehicle catalogue' END,
      item.source_url,
      CASE WHEN item.app_code='APP_BRK_IBIZA4SC_CAYC_PR1LQ_256'
        THEN 'MULTI_SOURCE_VEHICLE_FITMENT'
        ELSE 'TIER1_BRAKE_CATALOG' END,
      DATE '2026-10-06',item.confidence_state,'ALLOW_FACT_DERIVATION',
      format('%s %s %s — %s',item.make,item.model,item.variant,item.restrictions),
      'RK Brakes Coverage 01@2026-10-06'
    FROM repair_bom_edges e
    WHERE e.code IN (disc_edge,pad_edge)
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_brakes_01() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_brakes_01() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_brakes_01();

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
 ('039_repair_knowledge_brakes_01_priority.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '039_repair_knowledge_brakes_01_priority.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
