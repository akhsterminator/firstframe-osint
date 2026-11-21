import type { FeatureRelation, MapFeature } from "../types";

const TAG_KEY = /^[a-z][a-z0-9_:.-]{0,39}$/i;
const TAG_VALUE = /^[^"\\\n\r]{1,80}$/;

/**
 * Feature graphs come from a model or from a shared URL, so they are untrusted
 * until cleaned. Bad tags are dropped, ids normalised, distances clamped.
 */
export function sanitiseFeatures(features: MapFeature[], relations: FeatureRelation[]) {
  const seen = new Set<string>();
  const cleanFeatures: MapFeature[] = [];
  for (const f of features) {
    const id = String(f.id ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 8) || `f${cleanFeatures.length}`;
    if (seen.has(id)) continue;
    const tagSets = (Array.isArray(f.tagSets) ? f.tagSets : [])
      .map((set) => (Array.isArray(set) ? set : []).filter((t) => t && TAG_KEY.test(String(t.key)) && (t.value === null || TAG_VALUE.test(String(t.value)))))
      .filter((set) => set.length > 0)
      .slice(0, 4);
    const name = typeof f.name === "string" && TAG_VALUE.test(f.name) ? f.name.trim() : null;
    if (!tagSets.length && !name) continue;
    const rarity = f.rarity === "rare" || f.rarity === "uncommon" ? f.rarity : "common";
    seen.add(id);
    cleanFeatures.push({ id, label: String(f.label ?? id).slice(0, 60), tagSets, name, rarity });
    if (cleanFeatures.length >= 6) break;
  }
  const cleanRelations = relations
    .map((r) => ({
      from: String(r.from ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 8),
      to: String(r.to ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 8),
      maxDistanceM: Math.round(Math.min(5000, Math.max(25, Number(r.maxDistanceM) || 200))),
    }))
    .filter((r) => r.from !== r.to && seen.has(r.from) && seen.has(r.to));
  return { features: cleanFeatures, relations: cleanRelations };
}
