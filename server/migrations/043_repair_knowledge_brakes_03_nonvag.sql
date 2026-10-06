-- 043: Repair Knowledge brakes coverage 03 — non-VAG verified expansion.
-- Scope: extend front brake coverage only where Brembo exposes exact vehicle/brake configuration.
-- Ambiguous applications remain deliberately unseeded.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_brakes_03()
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
  FOR item IN
    SELECT * FROM (VALUES
      ('APP_BRAKE3_C4PICASSO1_9HR_283_TEVES','Citroen','C4 Picasso I','UD','1.6 HDi 112 — Teves — 283 mm','9HR (DV6C)',NULL,NULL,'283x26 mm ventilated front disc; Teves front pad set','09.9619.11','283x26 mm ventilated','P 61 083','Teves; no wear indicator','https://www.bremboparts.com/europe/en/catalogue/citro%C3%ABn-c4-picasso-i-mpv-ud-1-6-hdi-110/000006442-1'),

      ('APP_BRAKE3_C3II_9HX_266_TO_201006','Citroen','C3 II','SC_','1.6 HDi 90 — to 06/2010 — 266 mm','9HX (DV6ATED4)','2009-11-01','2010-06-30','Construction to 06/2010; 266x22 mm ventilated front disc; Bosch front pad set','09.8695.11','266x22 mm ventilated','P 61 066','Bosch; no wear indicator','https://www.bremboparts.com/europe/en/catalogue/citro%C3%ABn-c3-ii-sc-1-6-hdi-90/000033394-1'),

      ('APP_BRAKE3_BERLINGO1_9HX_ESP_283','Citroen','Berlingo First','MF/GJK/GFK','1.6 HDi 90 — ESP — 283 mm','9HX (DV6ATED4)',NULL,NULL,'Vehicle with ESP; 283x26 mm ventilated front disc; Bosch front pad set','09.9619.11','283x26 mm ventilated','P 23 119','Bosch; no wear indicator; for 283 mm disc','https://www.bremboparts.com/africa/en/catalogue/citro%C3%ABn-berlingo-berlingo-first-mpv-mf-gjk-gfk-1-6-hdi-90-mf9hx/000019027-1'),

      ('APP_BRAKE3_CORSAD_Z17DTR_278','Opel','Corsa D','S07','1.7 CDTI 125 — 278 mm','Z17DTR',NULL,NULL,'278x26 mm ventilated front disc; Bosch front pad set','09.A861.14','278x26 mm ventilated','P 59 053','Bosch; acoustic wear indicator','https://www.bremboparts.com/europe/en/catalogue/opel-corsa-d-s07-1-7-cdti-l08-l68/000019727-1'),

      ('APP_BRAKE3_ASTRAJ_ST_A17DTR_276_15IN','Opel','Astra J Sports Tourer','P10','1.7 CDTI 125 — 15 inch brakes — 276 mm','A17DTR',NULL,NULL,'15 inch front brake; 276x26 mm ventilated front disc','09.B355.11','276x26 mm ventilated','P 59 076','Bosch; acoustic wear indicator; 15 inch / 276 mm','https://www.bremboparts.com/europe/en/catalogue/opel-astra-j-sports-tourer-p10-1-7-cdti-35/000001021-1'),

      ('APP_BRAKE3_ASTRAJ_ST_A17DTR_300_16IN','Opel','Astra J Sports Tourer','P10','1.7 CDTI 125 — 16 inch brakes — 300 mm','A17DTR',NULL,NULL,'16 inch front brake; 300x26 mm ventilated front disc','09.B356.11','300x26 mm ventilated','P 59 077','Bosch; acoustic wear indicator; 16 inch / 300 mm','https://www.bremboparts.com/europe/en/catalogue/opel-astra-j-sports-tourer-p10-1-7-cdti-35/000001021-1'),

      ('APP_BRAKE3_ZAFIRAB_Z17DTR_280','Opel','Zafira B','A05','1.7 CDTI 125 Z17DTR — 280 mm','Z17DTR',NULL,NULL,'280x25 mm ventilated front disc; Teves front pad set','09.7629.11','280x25 mm ventilated','P 59 045','Teves; acoustic wear indicator','https://www.bremboparts.com/europe/en/catalogue/opel-zafira-zafira-family-b-a05-1-7-cdti-m75/000025503-1'),

      ('APP_BRAKE3_ZAFIRAB_Z17DTR_308','Opel','Zafira B','A05','1.7 CDTI 125 Z17DTR — 308 mm','Z17DTR',NULL,NULL,'308x25 mm ventilated front disc; Teves front pad set','09.9369.11','308x25 mm ventilated','P 59 045','Teves; acoustic wear indicator','https://www.bremboparts.com/europe/en/catalogue/opel-zafira-zafira-family-b-a05-1-7-cdti-m75/000025503-1'),

      ('APP_BRAKE3_ZAFIRAB_A17DTR_280','Opel','Zafira B','A05','1.7 CDTI 125 A17DTR — 280 mm','A17DTR',NULL,NULL,'280x25 mm ventilated front disc; Teves front pad set','09.7629.11','280x25 mm ventilated','P 59 045','Teves; acoustic wear indicator','https://www.bremboparts.com/europe/en/catalogue/opel-zafira-zafira-family-b-a05-1-7-cdti-m75/000025503-1'),

      ('APP_BRAKE3_ZAFIRAB_A17DTR_308','Opel','Zafira B','A05','1.7 CDTI 125 A17DTR — 308 mm','A17DTR',NULL,NULL,'308x25 mm ventilated front disc; Teves front pad set','09.9369.11','308x25 mm ventilated','P 59 045','Teves; acoustic wear indicator','https://www.bremboparts.com/europe/en/catalogue/opel-zafira-zafira-family-b-a05-1-7-cdti-m75/000025503-1')
    ) AS v(app_code,make,model,generation,variant,engine_code,production_from,production_to,restrictions,disc_ref,disc_spec,pad_ref,pad_spec,source_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,
      item.production_from::date,item.production_to::date,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET
      make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,
      production_from=EXCLUDED.production_from,production_to=EXCLUDED.production_to,
      restrictions=EXCLUDED.restrictions;

    disc_edge := replace(item.app_code,'APP_BRAKE3_','EDGE_BRAKE3_') || '_DISC';
    pad_edge := replace(item.app_code,'APP_BRAKE3_','EDGE_BRAKE3_') || '_PAD';

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT disc_edge,a.id,j.id,r.id,'PART_ROLE',2,'REQUIRED',
      'EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,NULL,'FRONT','FRONT_AXLE',
      jsonb_build_object('specification',item.disc_spec,'aftermarket_references',jsonb_build_object('Brembo',item.disc_ref))::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_BRAKE_DISCS_PADS_FRONT' AND r.code='brake_disc_front'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,replace_once=EXCLUDED.replace_once,
      side=EXCLUDED.side,axle=EXCLUDED.axle,position=EXCLUDED.position,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT pad_edge,a.id,j.id,r.id,'PART_ROLE',NULL,'REQUIRED',
      'EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,NULL,'FRONT','FRONT_AXLE',
      jsonb_build_object('specification',item.pad_spec,'aftermarket_references',jsonb_build_object('Brembo',item.pad_ref))::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_BRAKE_DISCS_PADS_FRONT' AND r.code='brake_pad_front'
    ON CONFLICT(code) DO UPDATE SET
      applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,
      part_role_id=EXCLUDED.part_role_id,item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,
      requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,replace_once=EXCLUDED.replace_once,
      side=EXCLUDED.side,axle=EXCLUDED.axle,position=EXCLUDED.position,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,'Brembo Parts official vehicle catalogue',item.source_url,
      'TIER1_BRAKE_CATALOG',DATE '2026-10-06','VERIFIED_MANUFACTURER','ALLOW_FACT_DERIVATION',
      format('%s %s %s — %s',item.make,item.model,item.variant,item.restrictions),
      'RK Brakes Coverage 03@2026-10-06'
    FROM repair_bom_edges e WHERE e.code IN (disc_edge,pad_edge)
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_brakes_03() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_brakes_03() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_service_filters_01();
  PERFORM apply_repair_knowledge_brakes_02();
  PERFORM apply_repair_knowledge_brakes_03();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_brakes_03();

CREATE OR REPLACE FUNCTION runtime_schema_status()
RETURNS TABLE(schema_version text,compatible boolean,missing_migrations integer,unknown_migrations integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
WITH expected(name) AS (VALUES
 ('001_vertical_slice.sql'),
 ('002_identity_and_evidence.sql'),
 ('003_runtime_roles_and_rls.sql'),
 ('004_tenant_authorization.sql'),
 ('005_provider_ingress_security.sql'),
 ('006_tenant_lifecycle_and_kill_switch.sql'),
 ('007_pii_protection.sql'),
 ('008_outbox_reliability.sql'),
 ('009_runtime_operability.sql'),
 ('010_real_scheduling_acquisition.sql'),
 ('011_provisional_identity_acquisition.sql'),
 ('012_platform_admin_p0_9.sql'),
 ('013_public_lead_acquisition.sql'),
 ('015_repair_knowledge_foundation.sql'),
 ('016_repair_estimate_draft.sql'),
 ('017_workshop_service_duration_policy.sql'),
 ('018_repair_knowledge_api.sql'),
 ('019_estimate_draft_editing.sql'),
 ('020_vehicle_catalog_foundation.sql'),
 ('021_vehicle_catalog_vehiclesdb_2026_09_1.sql'),
 ('022_manual_operations_foundation.sql'),
 ('023_reception_case_foundation.sql'),
 ('024_workshop_capacity_scheduling_v1.sql'),
 ('025_workshop_capacity_resource_bootstrap.sql'),
 ('026_workshop_capacity_resource_rls_backfill.sql'),
 ('027_repair_knowledge_coverage_01.sql'),
 ('028_repair_knowledge_coverage_02_clha.sql'),
 ('029_repair_knowledge_coverage_03_crmb.sql'),
 ('030_repair_knowledge_coverage_04_cayc.sql'),
 ('031_repair_knowledge_coverage_05_dv6c.sql'),
 ('032_repair_knowledge_coverage_06_vag19tdi.sql'),
 ('033_repair_knowledge_coverage_07_k9k636_646.sql'),
 ('034_repair_knowledge_coverage_08_opel17.sql'),
 ('035_repair_knowledge_coverage_09_dv6_legacy.sql'),
 ('036_repair_knowledge_maintenance_01_vag_opel.sql'),
 ('037_repair_knowledge_maintenance_02_psa_ford.sql'),
 ('038_repair_knowledge_maintenance_03_k9k.sql'),
 ('039_repair_knowledge_brakes_01_priority.sql'),
 ('040_repair_knowledge_clutch_01_priority.sql'),
 ('041_repair_knowledge_service_filters_01.sql'),
 ('042_repair_knowledge_brakes_02_vag.sql'),
 ('043_repair_knowledge_brakes_03_nonvag.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '043_repair_knowledge_brakes_03_nonvag.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
