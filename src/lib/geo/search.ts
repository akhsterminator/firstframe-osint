import type { FeatureRelation, GeoCandidate, GeoSearch, MapFeature } from "../types";
import { errorMessage } from "../util/async";
import { compileQuery, overpassTurboUrl, type SearchArea } from "./compile";
import { reverseGeocode } from "./nominatim";
import { OverpassTimeout, runOverpass, type OsmElement } from "./overpass";
import { rankCandidates } from "./rank";

export interface SceneSearchResult {
  candidates: GeoCandidate[];
  searches: GeoSearch[];
}

/** Largest map-view box we'll send to the public Overpass servers, in degrees. */
export const MAX_VIEW_SPAN = 6;

/**
 * Run one scene search in one area: strict first, relaxed if nothing fits.
 * Used by the scene-search page; the full pipeline runs several areas.
 */
export async function searchScene(
  features: MapFeature[],
  relations: FeatureRelation[],
  area: SearchArea,
  deps: { overpass?: (q: string) => Promise<OsmElement[]>; reverse?: (lat: number, lon: number) => Promise<string | undefined> } = {},
): Promise<SceneSearchResult> {
  const overpass = deps.overpass ?? ((q: string) => runOverpass(q));
  const searches: GeoSearch[] = [];
  let candidates: GeoCandidate[] = [];
  for (const mode of ["strict", "relaxed"] as const) {
    if (mode === "relaxed" && features.length < 2) break;
    const compiled = compileQuery(features, relations, area, mode);
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
      candidates = rankCandidates(elements, features, compiled, area.label, 25);
      if (!candidates.length) search.status = "empty";
    } catch (err) {
      search.status = err instanceof OverpassTimeout ? "timeout" : "error";
      search.note = errorMessage(err);
      break;
    }
    if (candidates.length) break;
  }
  // Name the top few by town; the rest keep their feature labels to spare Nominatim.
  const reverse = deps.reverse ?? reverseGeocode;
  for (const c of candidates.slice(0, 3)) {
    const town = await reverse(c.lat, c.lon).catch(() => undefined);
    if (town) c.label = town;
  }
  return { candidates, searches };
}
