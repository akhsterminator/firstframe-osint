import { settings } from "../runtime";
import { httpJson } from "../util/http";
import type { SearchArea } from "./compile";

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string];
  place_rank?: number;
  address?: { country_code?: string };
}

export interface Geocoded {
  lat: number;
  lon: number;
  label: string;
  area: SearchArea;
}

/** Nominatim's usage policy allows one request a second; we make at most one per report. */
export async function geocode(place: string): Promise<Geocoded | undefined> {
  const qs = new URLSearchParams({ q: place, format: "jsonv2", limit: "1", addressdetails: "1" });
  const hits = await httpJson<NominatimHit[]>(`${settings.nominatimUrl}/search?${qs}`, {
    timeoutMs: 10_000,
    headers: { "accept-language": "en" },
  });
  const hit = hits[0];
  if (!hit) return undefined;
  const [s, n, w, e] = hit.boundingbox.map(Number) as [number, number, number, number];
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  const label = hit.display_name.split(",").slice(0, 3).join(",").trim();
  const span = Math.max(n - s, e - w);
  const country = hit.address?.country_code?.toUpperCase();

  if (span > 4 && country) {
    return { lat, lon, label, area: { kind: "country", value: country, label } };
  }
  // Pad small places so features just outside the official boundary still count.
  const pad = Math.max(0.01, span * 0.15);
  const bbox = [s - pad, w - pad, n + pad, e + pad].map((v) => v.toFixed(5)).join(",");
  return { lat, lon, label, area: { kind: "bbox", value: bbox, label } };
}

interface ReverseHit {
  address?: Record<string, string>;
}

/** Town-level name for a point, e.g. "Bewdley, Worcestershire". */
export async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  const qs = new URLSearchParams({ lat: lat.toFixed(6), lon: lon.toFixed(6), format: "jsonv2", zoom: "14", addressdetails: "1" });
  const hit = await httpJson<ReverseHit>(`${settings.nominatimUrl}/reverse?${qs}`, { timeoutMs: 8_000, headers: { "accept-language": "en" } });
  const a = hit.address ?? {};
  const place = a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality ?? a.hamlet;
  const area = a.county ?? a.state_district ?? a.state ?? a.country;
  return place ? [place, area].filter(Boolean).join(", ") : undefined;
}
