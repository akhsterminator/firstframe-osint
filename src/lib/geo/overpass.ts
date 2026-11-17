import { config } from "../config";
import { HttpError, http, isTimeout } from "../util/http";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export class OverpassTimeout extends Error {}

export function position(el: OsmElement): { lat: number; lon: number } | undefined {
  if (el.lat !== undefined && el.lon !== undefined) return { lat: el.lat, lon: el.lon };
  return el.center;
}

/**
 * Public Overpass servers are shared, volunteer-run infrastructure. We send one
 * query at a time, identify ourselves, and move to the next mirror on 429/504.
 */
export async function runOverpass(query: string, endpoints = config.overpassEndpoints): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const url of endpoints) {
    try {
      const res = await http(url, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        timeoutMs: 75_000,
      });
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      if (json.remark && /timed out|out of memory/i.test(json.remark)) throw new OverpassTimeout(json.remark);
      return json.elements ?? [];
    } catch (err) {
      lastError = err;
      if (err instanceof OverpassTimeout || isTimeout(err)) continue;
      if (err instanceof HttpError && [429, 502, 503, 504].includes(err.status)) continue;
      if (err instanceof HttpError && err.status === 400) throw err;
    }
  }
  if (lastError instanceof OverpassTimeout || isTimeout(lastError)) throw new OverpassTimeout("Overpass query timed out");
  throw lastError instanceof Error ? lastError : new Error("All Overpass endpoints failed");
}
