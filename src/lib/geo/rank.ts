import type { GeoCandidate, MapFeature } from "../types";
import { haversine, formatCoord, osmBrowseUrl } from "../util/geo";
import { shortId } from "../util/id";
import type { CompiledQuery } from "./compile";
import { position, type OsmElement } from "./overpass";

const WEIGHT = { rare: 3, uncommon: 2, common: 1 } as const;
const DEDUPE_M = 150;

function tagsMatch(tags: Record<string, string> | undefined, f: MapFeature): boolean {
  if (!tags) return false;
  if (f.name && !(tags.name ?? "").toLowerCase().includes(f.name.toLowerCase())) return false;
  if (!f.tagSets.length) return true;
  return f.tagSets.some((set) => set.every((t) => (t.value === null ? t.key in tags : tags[t.key] === t.value)));
}

/** Overpass doesn't say which named set an element came from, so we re-derive it from tags. */
export function assignElements(elements: OsmElement[], features: MapFeature[]): Map<string, OsmElement[]> {
  const out = new Map<string, OsmElement[]>(features.map((f) => [f.id, []]));
  const seen = new Set<string>();
  for (const el of elements) {
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const f of features) if (tagsMatch(el.tags, f)) out.get(f.id)!.push(el);
  }
  return out;
}

function describe(anchor: OsmElement, feature: MapFeature, region: string, nearby: OsmElement[]): string {
  const pos = position(anchor)!;
  const name = anchor.tags?.name ?? nearby.find((e) => e.tags?.name)?.tags?.name;
  return name ? `${name}, ${region}` : `${feature.label} at ${formatCoord(pos.lat, pos.lon, 3)}`;
}

export function rankCandidates(
  elements: OsmElement[],
  features: MapFeature[],
  compiled: CompiledQuery,
  region: string,
  limit = 12,
): GeoCandidate[] {
  const byFeature = assignElements(elements, features);
  const anchorFeature = features.find((f) => f.id === compiled.anchor)!;
  const others = features.filter((f) => f.id !== compiled.anchor);
  const total = features.reduce((s, f) => s + WEIGHT[f.rarity], 0);

  const scored: GeoCandidate[] = [];
  for (const anchor of byFeature.get(compiled.anchor) ?? []) {
    const a = position(anchor);
    if (!a) continue;
    const matched = [anchorFeature.label];
    const missing: string[] = [];
    const near: OsmElement[] = [];
    let weight = WEIGHT[anchorFeature.rarity];
    for (const f of others) {
      const reach = compiled.reach[f.id] ?? 500;
      const hit = (byFeature.get(f.id) ?? []).find((el) => {
        const p = position(el);
        return p && haversine(a, p) <= reach;
      });
      if (hit) {
        matched.push(f.label);
        near.push(hit);
        weight += WEIGHT[f.rarity];
      } else {
        missing.push(f.label);
      }
    }
    scored.push({
      id: shortId(),
      lat: a.lat,
      lon: a.lon,
      label: describe(anchor, anchorFeature, region, near),
      region,
      matchedFeatures: matched,
      missingFeatures: missing,
      score: Math.round((weight / total) * 100) / 100,
      osmUrl: osmBrowseUrl(a.lat, a.lon),
    });
  }

  scored.sort((x, y) => y.score - x.score);
  const kept: GeoCandidate[] = [];
  for (const c of scored) {
    if (kept.some((k) => haversine(k, c) < DEDUPE_M)) continue;
    kept.push(c);
    if (kept.length >= limit) break;
  }
  return kept;
}
