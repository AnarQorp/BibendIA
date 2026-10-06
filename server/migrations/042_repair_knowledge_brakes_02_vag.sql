-- 042: Repair Knowledge brakes coverage 02 — VAG expansion.
-- Scope: extend JOB_BRAKE_DISCS_PADS_FRONT across already-covered RK vehicles.
-- Brake PR-code / diameter variants are explicit. No engine-family brake inference.
-- New APP_BRAKE2_/EDGE_BRAKE2_ prefixes preserve historical RK039 regression counts.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_brakes_02()
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
      ('APP_BRAKE2_GOLF7_CRMB_PR1ZE_288','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2','2.0 TDI CRMB — PR 1ZE/1ZP — 288 mm','CRMB','PR 1ZE/1ZP; 288x25 mm ventilated front disc; TRW front pad set','09.9145.11','288x25 mm ventilated','P 85 126','TRW; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-vii-5g1-bq1-be1-be2-2-0-tdi/000056147-1'),

      ('APP_BRAKE2_GOLF7_CRMB_PR1ZA_312','Volkswagen','Golf VII','5G1/BQ1/BE1/BE2','2.0 TDI CRMB — PR 1ZA/1ZB/1ZD — 312 mm','CRMB','PR 1ZA/1ZB/1ZD; 312x25 mm ventilated front disc; TRW front pad set','09.9772.11','312x25 mm ventilated','P 85 126','TRW; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-vii-5g1-bq1-be1-be2-2-0-tdi/000056147-1'),

      ('APP_BRAKE2_LEON5F_CRMB_PR1ZE_288','Seat','León 5F','5F1','2.0 TDI CRMB — PR 1ZE — 288 mm','CRMB','PR 1ZE; 288x25 mm ventilated front disc; TRW front pad set','09.9145.11','288x25 mm ventilated','P 85 126','TRW; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/seat-leon-5f1-2-0-tdi/000057594-1'),

      ('APP_BRAKE2_LEON5F_CRMB_PR1ZA_312','Seat','León 5F','5F1','2.0 TDI CRMB — PR 1ZA — 312 mm','CRMB','PR 1ZA; 312x25 mm ventilated front disc; TRW front pad set','09.9772.11','312x25 mm ventilated','P 85 126','TRW; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/seat-leon-5f1-2-0-tdi/000057594-1'),

      ('APP_BRAKE2_OCTAVIA3_CRMB_PR1ZE_288','Skoda','Octavia III','5E3/NL3/NR3','2.0 TDI CRMB — PR 1ZE — 288 mm','CRMB','PR 1ZE; 288x25 mm ventilated front disc; TRW front pad set','09.9145.11','288x25 mm ventilated','P 85 126','TRW; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-iii-5e3-nl3-nr3-2-0-tdi/000058761-1'),

      ('APP_BRAKE2_OCTAVIA3_CRMB_PR1ZA_312','Skoda','Octavia III','5E3/NL3/NR3','2.0 TDI CRMB — PR 1ZA/1ZB — 312 mm','CRMB','PR 1ZA/1ZB; 312x25 mm ventilated front disc; TRW front pad set','09.9772.11','312x25 mm ventilated','P 85 126','TRW; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-iii-5e3-nl3-nr3-2-0-tdi/000058761-1'),

      ('APP_BRAKE2_A3_8P_CAYC_PR1ZF_280','Audi','A3 Sportback 8P','8PA','1.6 TDI CAYC — PR 1ZF/1ZM — 280 mm','CAYC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-6-tdi/000031317-1'),

      ('APP_BRAKE2_A3_8P_CAYC_PR1ZE_288','Audi','A3 Sportback 8P','8PA','1.6 TDI CAYC — PR 1ZE — 288 mm','CAYC','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-6-tdi/000031317-1'),

      ('APP_BRAKE2_LEON2_CAYC_PR1ZF_280','Seat','León II','1P1','1.6 TDI CAYC — PR 1ZF/1ZM — 280 mm','CAYC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/seat-leon-1p1-1-6-tdi/000000762-1'),

      ('APP_BRAKE2_LEON2_CAYC_PR1ZE_288','Seat','León II','1P1','1.6 TDI CAYC — PR 1ZE — 288 mm','CAYC','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/seat-leon-1p1-1-6-tdi/000000762-1'),

      ('APP_BRAKE2_OCTAVIA2_CAYC_PR1ZF_280','Skoda','Octavia II','1Z3','1.6 TDI CAYC — PR 1ZF/1ZM — 280 mm','CAYC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-1z3-1-6-tdi/000031590-1'),

      ('APP_BRAKE2_OCTAVIA2_CAYC_PR1ZE_288','Skoda','Octavia II','1Z3','1.6 TDI CAYC — PR 1ZE — 288 mm','CAYC','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-1z3-1-6-tdi/000031590-1'),

      ('APP_BRAKE2_ALTEA_CAYC_PR1ZF_280','Seat','Altea','5P1','1.6 TDI CAYC — PR 1ZF — 280 mm','CAYC','PR 1ZF; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/seat-altea-5p1-1-6-tdi/000032744-1'),

      ('APP_BRAKE2_ALTEA_CAYC_PR1ZE_288','Seat','Altea','5P1','1.6 TDI CAYC — PR 1ZE — 288 mm','CAYC','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/seat-altea-5p1-1-6-tdi/000032744-1'),

      ('APP_BRAKE2_ROOMSTER_CAYC_PR1LQ_256','Skoda','Roomster','5J7','1.6 TDI CAYC — PR 1LQ/1LR/1ZG — 256 mm','CAYC','PR 1LQ/1LR/1ZG; 256x22 mm ventilated front disc; ATE/Teves front pad set','09.7011.11','256x22 mm ventilated','P 85 041','ATE/Teves; no wear contact','https://www.bremboparts.com/europe/es/catalogue/skoda-roomster-5j7-1-6-tdi/000033321-1'),

      ('APP_BRAKE2_ROOMSTER_CAYC_PR1ZC_288','Skoda','Roomster','5J7','1.6 TDI CAYC — PR 1ZC — 288 mm','CAYC','PR 1ZC; 288x25 mm ventilated front disc; Teves front pad set','09.7010.21','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-roomster-5j7-1-6-tdi/000033321-1'),

      ('APP_BRAKE2_TOURAN1T3_CAYC_PR1ZP_288','Volkswagen','Touran','1T3','1.6 TDI CAYC — PR 1ZP — 288 mm','CAYC','PR 1ZP; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 146','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-touran-1t3-1-6-tdi/000055508-1'),

      ('APP_BRAKE2_GOLF5_BKC_PR1ZF_280','Volkswagen','Golf V','1K1','1.9 TDI BKC — PR 1ZF/1ZM — 280 mm','BKC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-v-1k1-1-9-tdi/000017484-1'),

      ('APP_BRAKE2_GOLF5_BKC_PR1ZE_288','Volkswagen','Golf V','1K1','1.9 TDI BKC — PR 1ZE/1ZP — 288 mm','BKC','PR 1ZE/1ZP; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 146','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-v-1k1-1-9-tdi/000017484-1'),

      ('APP_BRAKE2_GOLF5_BLS_PR1ZF_280','Volkswagen','Golf V','1K1','1.9 TDI BLS — PR 1ZF/1ZM — 280 mm','BLS','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-v-1k1-1-9-tdi/000017484-1'),

      ('APP_BRAKE2_GOLF5_BLS_PR1ZE_288','Volkswagen','Golf V','1K1','1.9 TDI BLS — PR 1ZE/1ZP — 288 mm','BLS','PR 1ZE/1ZP; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 146','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-v-1k1-1-9-tdi/000017484-1'),

      ('APP_BRAKE2_GOLF5_BXE_PR1ZF_280','Volkswagen','Golf V','1K1','1.9 TDI BXE — PR 1ZF/1ZM — 280 mm','BXE','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-v-1k1-1-9-tdi/000017484-1'),

      ('APP_BRAKE2_GOLF5_BXE_PR1ZE_288','Volkswagen','Golf V','1K1','1.9 TDI BXE — PR 1ZE/1ZP — 288 mm','BXE','PR 1ZE/1ZP; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 146','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/vw-golf-v-1k1-1-9-tdi/000017484-1'),

      ('APP_BRAKE2_A3_8P_BKC_PR1ZF_280','Audi','A3 8P','8P1','1.9 TDI BKC — PR 1ZF/1ZM — 280 mm','BKC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-9-tdi/000017398-1'),

      ('APP_BRAKE2_A3_8P_BKC_PR1ZE_288','Audi','A3 8P','8P1','1.9 TDI BKC — PR 1ZE — 288 mm','BKC','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-9-tdi/000017398-1'),

      ('APP_BRAKE2_A3_8P_BLS_PR1ZF_280','Audi','A3 8P','8P1','1.9 TDI BLS — PR 1ZF/1ZM — 280 mm','BLS','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-9-tdi/000017398-1'),

      ('APP_BRAKE2_A3_8P_BLS_PR1ZE_288','Audi','A3 8P','8P1','1.9 TDI BLS — PR 1ZE — 288 mm','BLS','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-9-tdi/000017398-1'),

      ('APP_BRAKE2_A3_8P_BXE_PR1ZF_280','Audi','A3 8P','8P1','1.9 TDI BXE — PR 1ZF/1ZM — 280 mm','BXE','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-9-tdi/000017398-1'),

      ('APP_BRAKE2_A3_8P_BXE_PR1ZE_288','Audi','A3 8P','8P1','1.9 TDI BXE — PR 1ZE — 288 mm','BXE','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/en/catalogue/audi-a3-8p1-1-9-tdi/000017398-1'),

      ('APP_BRAKE2_OCTAVIA2COMBI_BKC_PR1ZF_280','Skoda','Octavia II Combi','1Z5','1.9 TDI BKC — PR 1ZF/1ZM — 280 mm','BKC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-combi-1z5-1-9-tdi/000018248-1'),

      ('APP_BRAKE2_OCTAVIA2COMBI_BKC_PR1ZE_288','Skoda','Octavia II Combi','1Z5','1.9 TDI BKC — PR 1ZE — 288 mm','BKC','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-combi-1z5-1-9-tdi/000018248-1'),

      ('APP_BRAKE2_OCTAVIA2COMBI_BLS_PR1ZF_280','Skoda','Octavia II Combi','1Z5','1.9 TDI BLS — PR 1ZF/1ZM — 280 mm','BLS','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-combi-1z5-1-9-tdi/000018248-1'),

      ('APP_BRAKE2_OCTAVIA2COMBI_BLS_PR1ZE_288','Skoda','Octavia II Combi','1Z5','1.9 TDI BLS — PR 1ZE — 288 mm','BLS','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-combi-1z5-1-9-tdi/000018248-1'),

      ('APP_BRAKE2_OCTAVIA2COMBI_BXE_PR1ZF_280','Skoda','Octavia II Combi','1Z5','1.9 TDI BXE — PR 1ZF/1ZM — 280 mm','BXE','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-combi-1z5-1-9-tdi/000018248-1'),

      ('APP_BRAKE2_OCTAVIA2COMBI_BXE_PR1ZE_288','Skoda','Octavia II Combi','1Z5','1.9 TDI BXE — PR 1ZE — 288 mm','BXE','PR 1ZE; 288x25 mm ventilated front disc; Teves front pad set','09.9145.11','288x25 mm ventilated','P 85 075','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/skoda-octavia-ii-combi-1z5-1-9-tdi/000018248-1'),

      ('APP_BRAKE2_LEON2_BKC_PR1ZF_280','Seat','León II','1P1','1.9 TDI BKC — PR 1ZF/1ZM — 280 mm','BKC','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/seat-leon-1p1-1-9-tdi/000018769-1'),

      ('APP_BRAKE2_LEON2_BLS_PR1ZF_280','Seat','León II','1P1','1.9 TDI BLS — PR 1ZF/1ZM — 280 mm','BLS','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/seat-leon-1p1-1-9-tdi/000018769-1'),

      ('APP_BRAKE2_LEON2_BXE_PR1ZF_280','Seat','León II','1P1','1.9 TDI BXE — PR 1ZF/1ZM — 280 mm','BXE','PR 1ZF/1ZM; 280x22 mm ventilated front disc; Teves front pad set','09.9167.11','280x22 mm ventilated','P 85 072','Teves; electric wear indicator','https://www.bremboparts.com/europe/es/catalogue/seat-leon-1p1-1-9-tdi/000018769-1')
    ) AS v(app_code,make,model,generation,variant,engine_code,restrictions,disc_ref,disc_spec,pad_ref,pad_spec,source_url)
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

    disc_edge := replace(item.app_code,'APP_BRAKE2_','EDGE_BRAKE2_') || '_DISC';
    pad_edge := replace(item.app_code,'APP_BRAKE2_','EDGE_BRAKE2_') || '_PAD';

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,requirement_type,
      bom_classification,confidence_state,condition,replace_once,side,axle,position,notes)
    SELECT disc_edge,a.id,j.id,r.id,'PART_ROLE',2,'REQUIRED',
      'EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,NULL,'FRONT','FRONT_AXLE',
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
      'EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,NULL,'FRONT','FRONT_AXLE',
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
      edge_id,source,evidence_reference,source_type,checked_at,confidence_state,
      reuse_status,notes,source_version)
    SELECT e.id,'Brembo Parts official vehicle catalogue',item.source_url,
      'TIER1_BRAKE_CATALOG',DATE '2026-10-06','VERIFIED_MANUFACTURER',
      'ALLOW_FACT_DERIVATION',
      format('%s %s %s — %s',item.make,item.model,item.variant,item.restrictions),
      'RK Brakes Coverage 02@2026-10-06'
    FROM repair_bom_edges e
    WHERE e.code IN (disc_edge,pad_edge)
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_brakes_02() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_brakes_02() FROM PUBLIC;

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
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_brakes_02();

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
 ('042_repair_knowledge_brakes_02_vag.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '042_repair_knowledge_brakes_02_vag.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
