-- 047: Repair Knowledge brakes coverage 04 — PSA verified expansion.
-- Scope: add exact Brembo front-brake configurations for existing PSA RK vehicles.
-- ESP/brake-system/diameter variants are explicit. Ambiguous applications remain absent.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_brakes_04()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; disc_edge text; pad_edge text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
      ('APP_BRAKE4_508I_9HR_283_TEVES','Peugeot','508 I','8D','1.6 HDi 112 — Teves — 283 mm','9HR (DV6C)','283x26 mm ventilated front disc; Teves pads for 283 mm','09.8303.11','283x26 mm ventilated','P 61 112','Teves; electric wear indicator; for 283 mm front disc','https://www.bremboparts.com/europe/es/catalogue/peugeot-508-i-8d-1-6-hdi/000000713-1'),

      ('APP_BRAKE4_207_9HY_283_BOSCH','Peugeot','207','WA_/WC_','1.6 HDi 109 — Bosch — 283 mm','9HY (DV6TED4)','Bosch front brake system; 283x26 mm ventilated front disc','09.9619.11','283x26 mm ventilated','P 23 119','Bosch; no wear indicator; for 283 mm front disc','https://www.bremboparts.com/europe/es/catalogue/peugeot-207-wa-wc-1-6-hdi/000019353-1'),

      ('APP_BRAKE4_XSARAPICASSO_9HX_266_LUCAS','Citroen','Xsara Picasso','N68','1.6 HDi 90 — Lucas — 266 mm','9HX (DV6ATED4)','TRW-Lucas front system; 266x20.5 mm ventilated front disc','09.4987.21','266x20.5 mm ventilated','P 61 069','Lucas; no wear indicator','https://www.bremboparts.com/europe/it/catalogue/citro%C3%ABn-xsara-picasso-n68-1-6-hdi/000019010-1'),

      ('APP_BRAKE4_XSARAPICASSO_9HX_266_BOSCH_NO_ESP','Citroen','Xsara Picasso','N68','1.6 HDi 90 — Bosch without ESP — 266 mm','9HX (DV6ATED4)','Without ESP; Bosch front system; 266x22 mm ventilated front disc','09.8695.11','266x22 mm ventilated','P 61 066','Bosch; without ESP; no wear indicator','https://www.bremboparts.com/europe/it/catalogue/citro%C3%ABn-xsara-picasso-n68-1-6-hdi/000019010-1'),

      ('APP_BRAKE4_XSARAPICASSO_9HX_283_BOSCH_ESP','Citroen','Xsara Picasso','N68','1.6 HDi 90 — Bosch with ESP — 283 mm','9HX (DV6ATED4)','With ESP; Bosch front system; 283x26 mm ventilated front disc','09.9619.11','283x26 mm ventilated','P 23 119','Bosch; with ESP; for 283 mm disc; no wear indicator','https://www.bremboparts.com/europe/it/catalogue/citro%C3%ABn-xsara-picasso-n68-1-6-hdi/000019010-1')
  ) AS v(app_code,make,model,generation,variant,engine_code,restrictions,disc_ref,disc_spec,pad_ref,pad_spec,source_url)
  LOOP
    INSERT INTO repair_vehicle_applicabilities(code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES(item.app_code,item.make,item.model,item.generation,item.variant,item.engine_code,NULL,NULL,item.restrictions)
    ON CONFLICT(code) DO UPDATE SET make=EXCLUDED.make,model=EXCLUDED.model,generation=EXCLUDED.generation,
      variant=EXCLUDED.variant,engine_code=EXCLUDED.engine_code,production_from=EXCLUDED.production_from,
      production_to=EXCLUDED.production_to,restrictions=EXCLUDED.restrictions;

    disc_edge:=replace(item.app_code,'APP_BRAKE4_','EDGE_BRAKE4_')||'_DISC';
    pad_edge:=replace(item.app_code,'APP_BRAKE4_','EDGE_BRAKE4_')||'_PAD';

    INSERT INTO repair_bom_edges(code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,bom_classification,
      confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT disc_edge,a.id,j.id,r.id,'PART_ROLE',2,'REQUIRED','EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,NULL,'FRONT','FRONT_AXLE',
      jsonb_build_object('specification',item.disc_spec,'aftermarket_references',jsonb_build_object('Brembo',item.disc_ref))::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_BRAKE_DISCS_PADS_FRONT' AND r.code='brake_disc_front'
    ON CONFLICT(code) DO UPDATE SET applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,part_role_id=EXCLUDED.part_role_id,
      item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,replace_once=EXCLUDED.replace_once,side=EXCLUDED.side,axle=EXCLUDED.axle,
      position=EXCLUDED.position,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_edges(code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,bom_classification,
      confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT pad_edge,a.id,j.id,r.id,'PART_ROLE',NULL,'REQUIRED','EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,NULL,'FRONT','FRONT_AXLE',
      jsonb_build_object('specification',item.pad_spec,'aftermarket_references',jsonb_build_object('Brembo',item.pad_ref))::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=item.app_code AND j.code='JOB_BRAKE_DISCS_PADS_FRONT' AND r.code='brake_pad_front'
    ON CONFLICT(code) DO UPDATE SET applicability_id=EXCLUDED.applicability_id,repair_job_id=EXCLUDED.repair_job_id,part_role_id=EXCLUDED.part_role_id,
      item_kind=EXCLUDED.item_kind,quantity=EXCLUDED.quantity,requirement_type=EXCLUDED.requirement_type,bom_classification=EXCLUDED.bom_classification,
      confidence_state=EXCLUDED.confidence_state,condition=EXCLUDED.condition,replace_once=EXCLUDED.replace_once,side=EXCLUDED.side,axle=EXCLUDED.axle,
      position=EXCLUDED.position,notes=EXCLUDED.notes;

    INSERT INTO repair_bom_evidence(edge_id,source,evidence_reference,source_type,checked_at,confidence_state,reuse_status,notes,source_version)
    SELECT e.id,'Brembo Parts official vehicle catalogue',item.source_url,'TIER1_BRAKE_CATALOG',DATE '2026-10-06',
      'VERIFIED_MANUFACTURER','ALLOW_FACT_DERIVATION',
      format('%s %s %s — %s',item.make,item.model,item.variant,item.restrictions),'RK Brakes Coverage 04@2026-10-06'
    FROM repair_bom_edges e WHERE e.code IN (disc_edge,pad_edge)
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;
ALTER FUNCTION apply_repair_knowledge_brakes_04() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_brakes_04() FROM PUBLIC;

CREATE OR REPLACE FUNCTION seed_repair_knowledge_poc_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM seed_repair_knowledge_poc_v1_legacy();
  PERFORM apply_repair_knowledge_coverage_01(); PERFORM apply_repair_knowledge_coverage_02(); PERFORM apply_repair_knowledge_coverage_03();
  PERFORM apply_repair_knowledge_coverage_04(); PERFORM apply_repair_knowledge_coverage_05(); PERFORM apply_repair_knowledge_coverage_06();
  PERFORM apply_repair_knowledge_coverage_07(); PERFORM apply_repair_knowledge_coverage_08(); PERFORM apply_repair_knowledge_coverage_09();
  PERFORM apply_repair_knowledge_maintenance_01(); PERFORM apply_repair_knowledge_maintenance_02(); PERFORM apply_repair_knowledge_maintenance_03();
  PERFORM apply_repair_knowledge_brakes_01(); PERFORM apply_repair_knowledge_clutch_01(); PERFORM apply_repair_knowledge_service_filters_01();
  PERFORM apply_repair_knowledge_brakes_02(); PERFORM apply_repair_knowledge_brakes_03(); PERFORM apply_repair_knowledge_service_filters_02();
  PERFORM apply_repair_knowledge_service_filters_03(); PERFORM apply_repair_knowledge_service_filters_04(); PERFORM apply_repair_knowledge_brakes_04();
END $$;
ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_brakes_04();

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
 ('043_repair_knowledge_brakes_03_nonvag.sql'),
 ('044_repair_knowledge_service_filters_02_vag.sql'),
 ('045_repair_knowledge_service_filters_03_vag.sql'),
 ('046_repair_knowledge_service_filters_04_touran.sql'),
 ('047_repair_knowledge_brakes_04_psa.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '047_repair_knowledge_brakes_04_psa.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;
ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
