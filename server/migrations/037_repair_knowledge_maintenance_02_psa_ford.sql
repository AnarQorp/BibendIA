-- 037: Repair Knowledge maintenance coverage 02.
-- Scope: expand JOB_MAINT_SERVICE (engine oil + oil filter) across the PSA/Ford
-- DV6 families already present in RK. Legacy 137-tooth and later 141-tooth
-- timing families remain separate; maintenance is normalized by engine code.

CREATE OR REPLACE FUNCTION apply_repair_knowledge_maintenance_02()
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
  oil_qty numeric(10,3);
  oil_spec text;
  oil_condition text;
  oil_confidence text;
  oil_source text;
  oil_source_url text;
BEGIN
  FOR item IN
    SELECT
      a.make,
      a.model,
      a.generation,
      a.engine_code,
      min(a.production_from) AS production_from,
      CASE WHEN bool_or(a.production_to IS NULL) THEN NULL::date ELSE max(a.production_to) END AS production_to
    FROM repair_vehicle_applicabilities a
    JOIN repair_bom_edges e ON e.applicability_id=a.id
    JOIN repair_jobs j ON j.id=e.repair_job_id
    WHERE a.engine_code IN (
      '9HR (DV6C)','T1DA',
      '9HZ (DV6TED4)','9HY (DV6TED4)','9HX (DV6ATED4)'
    )
      AND j.code='JOB_TIMING_BELT_WATER_PUMP'
    GROUP BY a.make,a.model,a.generation,a.engine_code
    ORDER BY a.make,a.model,a.generation,a.engine_code
  LOOP
    CASE item.engine_code
      WHEN '9HR (DV6C)' THEN
        maint_variant := '1.6 HDi 112';
        oil_qty := 3.75;
        oil_spec := 'PSA B71 2290 / ACEA C2; SAE 5W-30';
        oil_condition := NULL;
        oil_confidence := 'MULTI_SOURCE_VERIFIED';
        oil_source := 'PSA/Citroën DV6C technical specification';
        oil_source_url := 'https://manuals.plus/m/392a33db27a9095b843c3ed605f7ed44ed87eff128ea3c8672d953599159b050.pdf';

      WHEN 'T1DA' THEN
        maint_variant := '1.6 TDCi 115';
        oil_qty := 3.8;
        oil_spec := 'Ford WSS-M2C913-D SAE 5W-30; WSS-M2C950-A SAE 0W-30 also listed by Ford';
        oil_condition := NULL;
        oil_confidence := 'VERIFIED_OEM';
        oil_source := 'Ford Service Content — capacities and specifications';
        oil_source_url := 'https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1674008&Uid=G1674005&buildtype=web&countryCode=USA&div=f&languageCode=en&userMarket=NZL&vFilteringEnabled=False&variantid=3675';

      WHEN '9HZ (DV6TED4)' THEN
        maint_variant := '1.6 HDi 109 FAP';
        oil_qty := 3.75;
        oil_spec := 'PSA B71 2290 / ACEA C2; SAE 5W-30';
        oil_condition := NULL;
        oil_confidence := 'MULTI_SOURCE_VERIFIED';
        oil_source := 'Citroën C4 technical repair manual — DV6TED4 9HZ';
        oil_source_url := 'https://manuals.plus/m/6b9b7f26b9d66fc7427f23ff0613ad8128edb39adabf08bf8e12fbf0e394df90';

      WHEN '9HY (DV6TED4)' THEN
        maint_variant := '1.6 HDi 109 FAP';
        oil_qty := 3.75;
        oil_spec := 'PSA B71 2290 / ACEA C2; SAE 5W-30';
        oil_condition := NULL;
        oil_confidence := 'MULTI_SOURCE_VERIFIED';
        oil_source := 'Citroën/PSA technical repair data — DV6TED4 9HY';
        oil_source_url := 'https://manuals.plus/m/6b9b7f26b9d66fc7427f23ff0613ad8128edb39adabf08bf8e12fbf0e394df90';

      WHEN '9HX (DV6ATED4)' THEN
        maint_variant := '1.6 HDi 90';
        oil_qty := 3.75;
        oil_spec := 'PSA B71 2290 / ACEA C2 low-SAPS where required by FAP/service plan';
        oil_condition := 'Oil capacity is verified; exact oil approval/viscosity must be confirmed against FAP/emissions configuration and vehicle service plan';
        oil_confidence := 'COMMUNITY_SUPPORTED';
        oil_source := 'Citroën C4 technical repair manual — DV6ATED4 9HX';
        oil_source_url := 'https://manuals.plus/m/6b9b7f26b9d66fc7427f23ff0613ad8128edb39adabf08bf8e12fbf0e394df90';

      ELSE
        CONTINUE;
    END CASE;

    base_code := regexp_replace(
      upper(item.make || '_' || item.model || '_' || coalesce(item.generation,'') || '_' || item.engine_code),
      '[^A-Z0-9]+','_','g'
    );
    base_code := trim(both '_' from base_code);
    app_code := 'APP_MAINT_' || base_code;
    filter_edge_code := 'EDGE_MAINT_' || base_code || '_OIL_FILTER';
    oil_edge_code := 'EDGE_MAINT_' || base_code || '_ENGINE_OIL';

    INSERT INTO repair_vehicle_applicabilities(
      code,make,model,generation,variant,engine_code,production_from,production_to,restrictions)
    VALUES (
      app_code,item.make,item.model,item.generation,maint_variant,item.engine_code,
      item.production_from,item.production_to,
      format('%s maintenance oil/filter family; MANN HU 716/2 x; %s',item.engine_code,oil_spec))
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
        'oem_reference',CASE WHEN item.make='Ford'
          THEN 'Ford 1147685 / 1254385 family'
          ELSE 'PSA 1109 Y2 / 1109 Z6 / 1109 AY family' END,
        'aftermarket_references',jsonb_build_object('MANN-FILTER','HU 716/2 x')
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
    SELECT e.id,'MANN-FILTER official application catalogue',
      'https://www.mann-filter.com/es-es/catalogo/resultados-de-la-busqueda/producto.html/hu716/2x_mann-filter.html',
      'TIER1_FILTER_CATALOG',DATE '2026-10-06','VERIFIED_MANUFACTURER',
      'ALLOW_FACT_DERIVATION',
      format('MANN application catalogue covers %s and the corresponding PSA/Ford DV6 vehicle family with HU 716/2 x.',item.engine_code),
      'RK Maintenance Coverage 02@2026-10-06'
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
      'REQUIRED','EXPLICIT_BOM',oil_confidence,oil_condition,false,
      jsonb_build_object(
        'applicability',item.engine_code || ' engine oil service',
        'specification',oil_spec,
        'service_fill_litres',oil_qty
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
      CASE WHEN item.engine_code='T1DA' THEN 'OEM_MAINTENANCE_SPEC' ELSE 'OEM_TECHNICAL_DOCUMENT_MIRROR' END,
      DATE '2026-10-06',oil_confidence,
      'ALLOW_FACT_DERIVATION',
      format('Service-fill quantity %.2s L and maintenance specification normalized for %s.',oil_qty,item.engine_code),
      'RK Maintenance Coverage 02@2026-10-06'
    FROM repair_bom_edges e WHERE e.code=oil_edge_code
    ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
      source_type=EXCLUDED.source_type,
      checked_at=EXCLUDED.checked_at,
      confidence_state=EXCLUDED.confidence_state,
      reuse_status=EXCLUDED.reuse_status,
      notes=EXCLUDED.notes,
      source_version=EXCLUDED.source_version;

    IF item.engine_code <> 'T1DA' THEN
      INSERT INTO repair_bom_evidence(
        edge_id,source,evidence_reference,source_type,checked_at,confidence_state,
        reuse_status,notes,source_version)
      SELECT e.id,'PSA B71 2290 approved oil reference',
        'https://manuals.plus/m/99f7490454fcadf84ac1ba6f3619739384038693cace695dcd256b67eee37aad.pdf',
        'APPROVED_LUBRICANT_SPEC',DATE '2026-10-06',oil_confidence,
        'ALLOW_FACT_DERIVATION',
        CASE WHEN item.engine_code='9HX (DV6ATED4)'
          THEN 'B71 2290 / ACEA C2 is a low-SAPS approved PSA oil; exact applicability remains service-plan/FAP dependent and therefore manual-review-only.'
          ELSE 'Approved PSA B71 2290 / ACEA C2 lubricant corroborates normalized 5W-30 maintenance specification.' END,
        'RK Maintenance Coverage 02@2026-10-06'
      FROM repair_bom_edges e WHERE e.code=oil_edge_code
      ON CONFLICT(edge_id,source,evidence_reference) DO UPDATE SET
        source_type=EXCLUDED.source_type,
        checked_at=EXCLUDED.checked_at,
        confidence_state=EXCLUDED.confidence_state,
        reuse_status=EXCLUDED.reuse_status,
        notes=EXCLUDED.notes,
        source_version=EXCLUDED.source_version;
    END IF;
  END LOOP;
END $$;

ALTER FUNCTION apply_repair_knowledge_maintenance_02() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION apply_repair_knowledge_maintenance_02() FROM PUBLIC;

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
  PERFORM apply_repair_knowledge_maintenance_02();
END $$;

ALTER FUNCTION seed_repair_knowledge_poc_v1() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION seed_repair_knowledge_poc_v1() FROM PUBLIC;

SELECT apply_repair_knowledge_maintenance_02();

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
 ('037_repair_knowledge_maintenance_02_psa_ford.sql')
),counts AS (
 SELECT
  (SELECT count(*) FROM expected e LEFT JOIN public.schema_migrations s USING(name) WHERE s.name IS NULL)::int missing,
  (SELECT count(*) FROM public.schema_migrations s LEFT JOIN expected e USING(name) WHERE e.name IS NULL)::int unknown
)
SELECT '037_repair_knowledge_maintenance_02_psa_ford.sql',missing=0 AND unknown=0,missing,unknown FROM counts $$;

ALTER FUNCTION runtime_schema_status() OWNER TO bibendia_migrator;
REVOKE ALL ON FUNCTION runtime_schema_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_schema_status() TO bibendia_api,bibendia_worker;
