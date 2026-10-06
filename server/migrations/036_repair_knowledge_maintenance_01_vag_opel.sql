-- 036: Repair Knowledge maintenance coverage 01.
-- Scope: normalize and expand JOB_MAINT_SERVICE (engine oil + oil filter)
-- across the VAG and Opel engine families already present in RK.
-- No new RK architecture and no paid data dependency.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_maintenance_01()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  item record;
  base_code text;
  app_code text;
  filter_edge_code text;
  oil_edge_code text;
  maint_variant text;
  filter_ref text;
  filter_oe text;
  filter_url text;
  oil_qty numeric(10,3);
  oil_spec text;
  oil_notes text;
  oil_source text;
  oil_source_url text;
BEGIN
  -- Historical PoC maintenance row used HU 7008 z for CLHA. Current MANN
  -- application data maps CLHA to HU 7020 z, so remove the legacy row before
  -- rebuilding maintenance coverage from the verified family rules below.
  DELETE FROM repair_bom_evidence
  WHERE edge_id IN (
    SELECT e.id
    FROM repair_bom_edges e
    JOIN repair_vehicle_applicabilities a ON a.id=e.applicability_id
    WHERE a.code='APP_VAG_GOLF7_16TDI_CLHA_JOB_MAINT_SERVICE'
  );
  DELETE FROM repair_bom_edges
  WHERE applicability_id=(
    SELECT id FROM repair_vehicle_applicabilities
    WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_MAINT_SERVICE'
  );
  DELETE FROM repair_vehicle_applicabilities
  WHERE code='APP_VAG_GOLF7_16TDI_CLHA_JOB_MAINT_SERVICE';

  FOR item IN
    SELECT
      make,
      model,
      generation,
      engine_code,
      min(production_from) AS production_from,
      CASE WHEN bool_or(production_to IS NULL) THEN NULL::date ELSE max(production_to) END AS production_to
    FROM repair_vehicle_applicabilities a
    JOIN repair_bom_edges e ON e.applicability_id=a.id
    JOIN repair_jobs j ON j.id=e.repair_job_id
    WHERE a.engine_code IN ('CLHA','CRMB','CAYC','BKC','BLS','BXE','A17DTR','Z17DTR')
      AND j.code='JOB_TIMING_BELT_WATER_PUMP'
    GROUP BY a.make,a.model,a.generation,a.engine_code
    ORDER BY a.make,a.model,a.generation,a.engine_code
  LOOP
    CASE item.engine_code
      WHEN 'CLHA' THEN
        maint_variant := '1.6 TDI 105';
        filter_ref := 'HU 7020 z';
        filter_oe := '04L 115 562 / 03N 115 562';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu7020z_mann-filter.html';
        oil_qty := 4.6;
        oil_spec := 'VW 507 00';
        oil_notes := 'Approximate service fill including oil filter: 4.6 L';
        oil_source := 'Škoda/VAG maintenance specification — EA288 CLHA';
        oil_source_url := 'https://www.scribd.com/document/420113979/Maintenance-05-2017';

      WHEN 'CRMB' THEN
        maint_variant := '2.0 TDI 150';
        filter_ref := 'HU 7020 z';
        filter_oe := '04L 115 562 / 03N 115 562';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu7020z_mann-filter.html';
        oil_qty := 4.7;
        oil_spec := 'VW 507 00';
        oil_notes := 'Approximate service fill including oil filter: 4.7 L';
        oil_source := 'Škoda/VAG maintenance specification — EA288 CRMB';
        oil_source_url := 'https://www.scribd.com/document/420113979/Maintenance-05-2017';

      WHEN 'CAYC' THEN
        maint_variant := '1.6 TDI 105';
        filter_ref := 'HU 7008 z';
        filter_oe := '03L 115 562 / 03L 115 466';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu7008z_mann-filter.html';
        oil_qty := 4.3;
        oil_spec := 'VW 507 00';
        oil_notes := 'Service fill including oil filter: 4.3 L';
        oil_source := 'Škoda/VAG maintenance specification — CAYC';
        oil_source_url := 'https://www.scribd.com/document/785723205/Maintenance-Octavia-II';

      WHEN 'BKC' THEN
        maint_variant := '1.9 TDI 105';
        filter_ref := 'HU 719/7 x';
        filter_oe := '071 115 562 C';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu719/7x_mann-filter.html';
        oil_qty := 3.8;
        oil_spec := 'VW 507 00';
        oil_notes := 'Service fill including oil filter: 3.8 L. OEM documentation also lists VW 505 01 for fixed-service regimes.';
        oil_source := 'Škoda/VAG maintenance specification — BKC';
        oil_source_url := 'https://www.scribd.com/document/785723205/Maintenance-Octavia-II';

      WHEN 'BXE' THEN
        maint_variant := '1.9 TDI 105';
        filter_ref := 'HU 719/7 x';
        filter_oe := '071 115 562 C';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu719/7x_mann-filter.html';
        oil_qty := 3.8;
        oil_spec := 'VW 507 00';
        oil_notes := 'Service fill including oil filter: 3.8 L. OEM documentation also lists VW 505 01 for fixed-service regimes.';
        oil_source := 'Škoda/VAG maintenance specification — BXE';
        oil_source_url := 'https://www.scribd.com/document/785723205/Maintenance-Octavia-II';

      WHEN 'BLS' THEN
        maint_variant := '1.9 TDI 105 DPF';
        filter_ref := 'HU 719/7 x';
        filter_oe := '071 115 562 C';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu719/7x_mann-filter.html';
        oil_qty := 4.3;
        oil_spec := 'VW 507 00';
        oil_notes := 'Service fill including oil filter: 4.3 L; DPF engine.';
        oil_source := 'Škoda/VAG maintenance specification — BLS';
        oil_source_url := 'https://www.scribd.com/document/785723205/Maintenance-Octavia-II';

      WHEN 'A17DTR' THEN
        maint_variant := '1.7 CDTI 125';
        filter_ref := 'HU 820/1 y';
        filter_oe := 'GM 98018448 / Opel 5650375';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu820/1y_mann-filter.html';
        oil_qty := 5.4;
        oil_spec := 'GM dexos2; SAE 5W-30 or 5W-40';
        oil_notes := 'OEM owner manual service fill including oil filter: 5.4 L';
        oil_source := 'Opel Astra J owner manual';
        oil_source_url := 'https://public-servicebox.opel.com/OVddb/OV/en_GB/Astra_J/2010_2016/2012/manual_user/om_astra_KTA-2685_4-en_eu_my12_ed0811_14_en_GB_online.pdf';

      WHEN 'Z17DTR' THEN
        maint_variant := '1.7 CDTI 125';
        filter_ref := 'HU 820/1 y';
        filter_oe := 'GM 98018448 / Opel 5650375';
        filter_url := 'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu820/1y_mann-filter.html';
        oil_qty := 5.4;
        oil_spec := 'GM dexos2; SAE 5W-30 or 5W-40';
        oil_notes := 'OEM Astra H/J documentation service fill including oil filter: 5.4 L';
        oil_source := 'Opel Astra owner manual';
        oil_source_url := 'https://manualzz.com/doc/5416230/opel-astra-h-coche-manual-de-instrucciones';

      ELSE
        CONTINUE;
    END CASE;

    base_code := regexp_replace(upper(item.make || '_' || item.model || '_' || coalesce(item.generation,'') || '_' || item.engine_code), '[^A-Z0-9]+', '_', 'g');
    base_code := trim(both '_' from base_code);
    app_code := 'APP_MAINT_' || base_code;
    filter_edge_code := 'EDGE_MAINT_' || base_code || '_OIL_FILTER';
    oil_edge_code := 'EDGE_MAINT_' || base_code || '_ENGINE_OIL';

    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      app_code,item.make,item.model,item.generation,maint_variant,item.engine_code,
      item.production_from,item.production_to,
      format('%s maintenance oil/filter family; oil filter %s; %s',item.engine_code,filter_ref,oil_spec))
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
      filter_edge_code,a.id,j.id,r.id,'PART_ROLE',NULL,
      'REQUIRED','EXPLICIT_BOM','VERIFIED_MANUFACTURER',NULL,false,
      jsonb_build_object(
        'applicability',item.engine_code || ' engine oil filter service',
        'specification','Oil filter',
        'oem_reference',filter_oe,
        'aftermarket_references',jsonb_build_object('MANN-FILTER',filter_ref)
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=app_code AND j.code='JOB_MAINT_SERVICE' AND r.code='oil_filter'
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
    SELECT e.id,'MANN-FILTER official application catalogue',filter_url,
      'TIER1_FILTER_CATALOG',DATE '2026-10-06','VERIFIED_MANUFACTURER',
      'ALLOW_FACT_DERIVATION',
      format('Official MANN-FILTER application catalogue maps %s to %s; factual fitment only.',item.engine_code,filter_ref),
      'RK Maintenance Coverage 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=filter_edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,
      checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,
      source_version=EXCLUDED.source_version;

    INSERT INTO repair_bom_edges(
      code,applicability_id,repair_job_id,part_role_id,item_kind,quantity,
      requirement_type,bom_classification,confidence_state,condition,replace_once,notes)
    SELECT
      oil_edge_code,a.id,j.id,r.id,'CONSUMABLE',oil_qty,
      'REQUIRED','EXPLICIT_BOM','VERIFIED_OEM',NULL,false,
      jsonb_build_object(
        'applicability',item.engine_code || ' engine oil service',
        'specification',oil_spec,
        'service_fill_litres',oil_qty,
        'note',oil_notes
      )::text
    FROM repair_vehicle_applicabilities a,repair_jobs j,repair_part_roles r
    WHERE a.code=app_code AND j.code='JOB_MAINT_SERVICE' AND r.code='engine_oil'
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
    SELECT e.id,oil_source,oil_source_url,
      'OEM_MAINTENANCE_SPEC',DATE '2026-10-06','VERIFIED_OEM',
      'ALLOW_FACT_DERIVATION',
      oil_notes || '; normalized RK specification: ' || oil_spec,
      'RK Maintenance Coverage 01@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=oil_edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,
      checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,
      source_version=EXCLUDED.source_version;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_maintenance_01() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_maintenance_01() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_coverage_08();
  PERFORM apply_repair_knowledge_coverage_09();
  PERFORM apply_repair_knowledge_maintenance_01();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_maintenance_01();

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
 ('035_repair_knowledge_coverage_09_dv6_legacy.sql'),('036_repair_knowledge_maintenance_01_vag_opel.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '036_repair_knowledge_maintenance_01_vag_opel.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
