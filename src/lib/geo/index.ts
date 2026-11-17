import type { GeoCandidate, GeoSearch, GeolocationResult, SceneAnalysis } from "../types";
import { errorMessage } from "../util/async";
import { compileQuery, overpassTurboUrl, type SearchArea } from "./compile";
import { geocode, reverseGeocode, type Geocoded } from "./nominatim";
import { OverpassTimeout, runOverpass, type OsmElement } from "./overpass";
import { rankCandidates } from "./rank";

export interface GeolocationInput {
  scene: SceneAnalysis;
  claimPlace?: string;
  gps?: { lat: number; lon: number };
}

export interface GeolocationDeps {
  overpass?: (query: string) => Promise<OsmElement[]>;
  geocode?: (place: string) => Promise<Geocoded | undefined>;
  reverse?: (lat: number, lon: number) => Promise<string | undefined>;
}

const MAX_SEARCHES = 4;
/** A candidate this good means the whole scene fits; no need to keep querying. */
const CONFIDENT = 0.99;

export function searchAreas(scene: SceneAnalysis, claim?: Geocoded, gps?: { lat: number; lon: number }): SearchArea[] {
  const areas: SearchArea[] = [];
  if (gps) {
    const d = 0.03;
    areas.push({ kind: "bbox", value: [gps.lat - d, gps.lon - d, gps.lat + d, gps.lon + d].join(","), label: "Around the GPS position in the file" });
  }
  if (claim) areas.push({ ...claim.area, label: `Claimed: ${claim.label}` });
  for (const r of scene.regions) {
    const area: SearchArea = r.subdivisionCode
      ? { kind: "subdivision", value: r.subdivisionCode, label: r.name }
      : { kind: "country", value: r.countryCode, label: r.name };
    if (!areas.some((a) => a.kind === area.kind && a.value === area.value)) areas.push(area);
  }
  return areas.slice(0, MAX_SEARCHES);
}

export async function runGeolocation(input: GeolocationInput, deps: GeolocationDeps = {}): Promise<GeolocationResult> {
  const overpass = deps.overpass ?? ((q: string) => runOverpass(q));
  const lookup = deps.geocode ?? geocode;
  const { scene } = input;

  let claim: Geocoded | undefined;
  if (input.claimPlace) claim = await lookup(input.claimPlace).catch(() => undefined);

  const searches: GeoSearch[] = [];
  const candidates: GeoCandidate[] = [];

  if (scene.features.length >= 2) {
    for (const area of searchAreas(scene, claim, input.gps)) {
      for (const mode of ["strict", "relaxed"] as const) {
        const compiled = compileQuery(scene.features, scene.relations, area, mode);
        const search: GeoSearch = {
          region: area.label,
          area: { kind: area.kind, value: area.value },
          query: compiled.query,
          overpassTurboUrl: overpassTurboUrl(compiled.query),
          status: "ok",
          elements: 0,
          note: mode === "relaxed" ? "Relaxed search: places matching only some of the features" : undefined,
        };
        searches.push(search);
        try {
          const elements = await overpass(compiled.query);
          search.elements = elements.length;
          const ranked = rankCandidates(elements, scene.features, compiled, area.label);
          if (!ranked.length) search.status = "empty";
          candidates.push(...ranked);
          if (ranked.length) break;
        } catch (err) {
          search.status = err instanceof OverpassTimeout ? "timeout" : "error";
          search.note = errorMessage(err);
          break;
        }
      }
      if (candidates.some((c) => c.score >= CONFIDENT)) break;
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 15);
  const best = top[0] && top[0].score >= 0.6 ? top[0] : undefined;

  if (best) {
    const town = await (deps.reverse ?? reverseGeocode)(best.lat, best.lon).catch(() => undefined);
    if (town) best.label = town;
  }
  if (best) return { candidates: top, searches, best, basis: "candidate", point: { lat: best.lat, lon: best.lon, label: best.label } };
  if (input.gps) return { candidates: top, searches, basis: "metadata", point: { ...input.gps, label: "GPS position in file metadata" } };
  if (claim) return { candidates: top, searches, basis: "claim", point: { lat: claim.lat, lon: claim.lon, label: claim.label } };

  const region = scene.regions[0];
  if (region && region.confidence !== "low") {
    const centroid = await lookup(region.subdivisionCode ? region.name : region.countryCode).catch(() => undefined);
    if (centroid) return { candidates: top, searches, basis: "region-centroid", point: { lat: centroid.lat, lon: centroid.lon, label: region.name } };
  }
  return { candidates: top, searches, basis: "none" };
}
