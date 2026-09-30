import type pg from 'pg';
import { z } from 'zod';

export const vehicleCatalogQuerySchema = z.object({
  kind: z.enum(['car','van']).optional(),
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
}).strict().refine((value) => !value.model || value.make, { message: 'make is required when model is provided' });
export type VehicleCatalogQuery = z.infer<typeof vehicleCatalogQuerySchema>;

export type VehicleCatalogFacets = {
  source: { provider: string; version: string; artifactSha256: string; license: string; attribution: string; attributionUrl: string; importedAt: string };
  makes: Array<{ sourceMakeId: string; name: string; kinds: Array<'car' | 'van'>; repairKnowledgeAvailable: boolean }>;
  models: Array<{ sourceModelId: string; sourceMakeId: string; name: string; kind: 'car' | 'van'; bodyTypes: string[];
    aliases: string[]; repairKnowledgeAvailable: boolean; repairKnowledgeTargets: Array<{ make: string; model: string }> }>;
};

export async function listVehicleCatalogFacets(client: pg.PoolClient, input: VehicleCatalogQuery): Promise<VehicleCatalogFacets> {
  const query = vehicleCatalogQuerySchema.parse(input);
  const source = (await client.query<any>(`SELECT id,provider,dataset_version,artifact_sha256,license_spdx,attribution,
    attribution_url,imported_at FROM vehicle_catalog_sources WHERE provider='VehiclesDB' AND active`)).rows[0];
  if (!source) throw new Error('VEHICLE_CATALOG_SOURCE_UNAVAILABLE');

  const makes = (await client.query<any>(`
    SELECT m.source_make_id,m.name,array_agg(DISTINCT m.kind ORDER BY m.kind) kinds,
      bool_or(EXISTS (SELECT 1 FROM vehicle_catalog_models cm JOIN vehicle_catalog_rk_model_links l ON l.model_id=cm.id
        JOIN repair_vehicle_applicabilities a ON lower(a.make)=lower(l.rk_make) AND lower(a.model)=lower(l.rk_model)
        WHERE cm.make_id=m.id)) repair_knowledge_available
    FROM vehicle_catalog_makes m WHERE m.source_id=$1 AND ($2::text IS NULL OR m.kind=$2)
      AND ($3::text IS NULL OR lower(m.source_make_id)=lower($3) OR lower(m.name)=lower($3))
    GROUP BY m.source_make_id,m.name ORDER BY lower(m.name),m.source_make_id`, [source.id, query.kind ?? null, query.make ?? null])).rows;

  const models = query.make ? (await client.query<any>(`
    SELECT mo.source_model_id,ma.source_make_id,mo.name,mo.kind,mo.body_types,mo.aliases,
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object('make',l.rk_make,'model',l.rk_model))
        FILTER (WHERE l.model_id IS NOT NULL AND a.id IS NOT NULL),'[]'::jsonb) rk_targets
    FROM vehicle_catalog_models mo JOIN vehicle_catalog_makes ma ON ma.id=mo.make_id
    LEFT JOIN vehicle_catalog_rk_model_links l ON l.source_id=mo.source_id AND l.model_id=mo.id
    LEFT JOIN repair_vehicle_applicabilities a ON lower(a.make)=lower(l.rk_make) AND lower(a.model)=lower(l.rk_model)
    WHERE mo.source_id=$1 AND ($2::text IS NULL OR mo.kind=$2)
      AND (lower(ma.source_make_id)=lower($3) OR lower(ma.name)=lower($3))
      AND ($4::text IS NULL OR lower(mo.source_model_id)=lower($4) OR lower(mo.slug)=lower($4) OR lower(mo.name)=lower($4))
    GROUP BY mo.id,ma.source_make_id ORDER BY lower(mo.name),mo.kind,mo.source_model_id`,
    [source.id, query.kind ?? null, query.make, query.model ?? null])).rows : [];

  return {
    source: { provider: source.provider, version: source.dataset_version, artifactSha256: source.artifact_sha256,
      license: source.license_spdx, attribution: source.attribution, attributionUrl: source.attribution_url,
      importedAt: source.imported_at.toISOString() },
    makes: makes.map((row: any) => ({ sourceMakeId: row.source_make_id, name: row.name, kinds: row.kinds,
      repairKnowledgeAvailable: row.repair_knowledge_available })),
    models: models.map((row: any) => ({ sourceModelId: row.source_model_id, sourceMakeId: row.source_make_id,
      name: row.name, kind: row.kind, bodyTypes: row.body_types, aliases: row.aliases,
      repairKnowledgeAvailable: row.rk_targets.length > 0, repairKnowledgeTargets: row.rk_targets })),
  };
}
