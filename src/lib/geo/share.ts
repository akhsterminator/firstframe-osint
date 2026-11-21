import type { FeatureRelation, MapFeature } from "../types";
import type { SearchArea } from "./compile";
import { sanitiseFeatures } from "./sanitise";

export interface SceneQuery {
  features: MapFeature[];
  relations: FeatureRelation[];
  area?: SearchArea;
  title?: string;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Pack a scene into a URL-safe string so a search can be shared as a link. */
export function encodeScene(q: SceneQuery): string {
  const compact = {
    v: 1,
    f: q.features.map((f) => [f.id, f.label, f.tagSets.map((s) => s.map((t) => [t.key, t.value])), f.name, f.rarity]),
    r: q.relations.map((r) => [r.from, r.to, r.maxDistanceM]),
    a: q.area ? [q.area.kind, q.area.value, q.area.label] : undefined,
    t: q.title,
  };
  return toBase64Url(JSON.stringify(compact));
}

/** Inverse of encodeScene. Shared links are untrusted, so everything is re-validated. */
export function decodeScene(s: string): SceneQuery | undefined {
  try {
    const c = JSON.parse(fromBase64Url(s)) as {
      f?: [string, string, [string, string | null][][], string | null, MapFeature["rarity"]][];
      r?: [string, string, number][];
      a?: [SearchArea["kind"], string, string];
      t?: string;
    };
    const features: MapFeature[] = (c.f ?? []).map(([id, label, sets, name, rarity]) => ({
      id,
      label,
      tagSets: (sets ?? []).map((set) => set.map(([key, value]) => ({ key, value }))),
      name,
      rarity,
    }));
    const relations = (c.r ?? []).map(([from, to, maxDistanceM]) => ({ from, to, maxDistanceM }));
    const clean = sanitiseFeatures(features, relations);
    let area: SearchArea | undefined;
    if (c.a && ["country", "subdivision", "bbox"].includes(c.a[0]) && typeof c.a[1] === "string") {
      area = { kind: c.a[0], value: c.a[1].slice(0, 80), label: String(c.a[2] ?? c.a[1]).slice(0, 80) };
    }
    return { ...clean, area, title: typeof c.t === "string" ? c.t.slice(0, 120) : undefined };
  } catch {
    return undefined;
  }
}
