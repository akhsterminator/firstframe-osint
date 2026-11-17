import type { FeatureRelation, MapFeature, OsmTag } from "../types";

export interface SearchArea {
  kind: "country" | "subdivision" | "bbox";
  /** ISO code, or "south,west,north,east" for a bbox. */
  value: string;
  label: string;
}

export interface CompiledQuery {
  query: string;
  anchor: string;
  /** Feature ids in search order, anchor first. */
  order: string[];
  /** For each non-anchor feature, its parent in the search tree and the distance to it. */
  parents: Record<string, { parent: string; distance: number }>;
  /** Max plausible distance from the anchor to each feature, following the tree. */
  reach: Record<string, number>;
  mode: "strict" | "relaxed";
}

const RARITY_RANK = { rare: 0, uncommon: 1, common: 2 } as const;
const DEFAULT_LINK_M = 400;

function qlString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function regexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagFilter(t: OsmTag): string {
  return t.value === null ? `[${qlString(t.key)}]` : `[${qlString(t.key)}=${qlString(t.value)}]`;
}

function nameFilter(name: string): string {
  return `["name"~${qlString(regexEscape(name))},i]`;
}

/** The Overpass selectors for one feature, without the spatial part. */
export function featureSelectors(f: MapFeature): string[] {
  const name = f.name ? nameFilter(f.name) : "";
  if (!f.tagSets.length) return [`nwr${name}`];
  return f.tagSets.map((set) => `nwr${set.map(tagFilter).join("")}${name}`);
}

export function areaHeader(area: SearchArea): { header: string; filter: string } {
  if (area.kind === "bbox") {
    const parts = area.value.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) throw new Error(`invalid bbox ${area.value}`);
    return { header: "", filter: `(${parts.map((n) => n.toFixed(5)).join(",")})` };
  }
  if (!/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(area.value)) throw new Error(`invalid area code ${area.value}`);
  const key = area.kind === "country" ? "ISO3166-1" : "ISO3166-2";
  const admin = area.kind === "country" ? "[admin_level=2]" : "";
  return { header: `area[${qlString(key)}=${qlString(area.value)}]${admin}->.region;\n`, filter: "(area.region)" };
}

/** Rarest, named, best-connected feature makes the smallest starting set. */
export function chooseAnchor(features: MapFeature[], relations: FeatureRelation[]): MapFeature {
  const degree = (id: string) => relations.filter((r) => r.from === id || r.to === id).length;
  return [...features].sort(
    (a, b) =>
      RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] ||
      Number(!!b.name) - Number(!!a.name) ||
      degree(b.id) - degree(a.id) ||
      a.id.localeCompare(b.id),
  )[0]!;
}

/** Breadth-first tree over the relation graph. Unlinked features hang off the anchor. */
export function searchTree(features: MapFeature[], relations: FeatureRelation[], anchor: string) {
  const ids = new Set(features.map((f) => f.id));
  const order = [anchor];
  const parents: CompiledQuery["parents"] = {};
  const reach: Record<string, number> = { [anchor]: 0 };
  const queue = [anchor];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of relations) {
      const other = r.from === cur ? r.to : r.to === cur ? r.from : undefined;
      if (!other || !ids.has(other) || order.includes(other)) continue;
      order.push(other);
      parents[other] = { parent: cur, distance: r.maxDistanceM };
      reach[other] = reach[cur]! + r.maxDistanceM;
      queue.push(other);
    }
  }
  for (const f of features) {
    if (order.includes(f.id)) continue;
    order.push(f.id);
    parents[f.id] = { parent: anchor, distance: DEFAULT_LINK_M };
    reach[f.id] = DEFAULT_LINK_M;
  }
  return { order, parents, reach };
}

const setName = (id: string) => `.f_${id}`;

/**
 * Strict mode chains every feature off its parent, then walks back up the tree
 * so only places where the whole scene fits survive. Relaxed mode searches every
 * feature around the anchor and keeps anchors with at least one neighbour, so
 * partial matches can still be ranked when one clue is wrong or unmapped.
 */
export function compileQuery(
  features: MapFeature[],
  relations: FeatureRelation[],
  area: SearchArea,
  mode: "strict" | "relaxed" = "strict",
  limit = 200,
): CompiledQuery {
  if (!features.length) throw new Error("no features to search for");
  const byId = new Map(features.map((f) => [f.id, f]));
  const anchor = chooseAnchor(features, relations);
  const { order, parents, reach } = searchTree(features, relations, anchor.id);
  const { header, filter } = areaHeader(area);
  const lines: string[] = [];

  lines.push(`(\n${featureSelectors(anchor).map((s) => `  ${s}${filter};`).join("\n")}\n)->${setName(anchor.id)};`);

  for (const id of order.slice(1)) {
    const f = byId.get(id)!;
    const { parent, distance } = parents[id]!;
    const around = mode === "strict" ? `(around${setName(parent)}:${distance})` : `(around${setName(anchor.id)}:${reach[id]})`;
    lines.push(`(\n${featureSelectors(f).map((s) => `  ${s}${around};`).join("\n")}\n)->${setName(id)};`);
  }

  if (mode === "strict") {
    for (const id of [...order.slice(1)].reverse()) {
      const { parent, distance } = parents[id]!;
      lines.push(`nwr${setName(parent)}(around${setName(id)}:${distance})->${setName(parent)};`);
    }
  } else if (order.length > 1) {
    const near = order.slice(1).map((id) => `  nwr${setName(anchor.id)}(around${setName(id)}:${reach[id]});`);
    lines.push(`(\n${near.join("\n")}\n)->${setName(anchor.id)};`);
  }

  const outputs = order.map((id) => `${setName(id)} out tags center qt ${id === anchor.id ? limit : limit * 3};`);
  const query = `[out:json][timeout:60][maxsize:536870912];\n${header}${lines.join("\n")}\n${outputs.join("\n")}`;
  return { query, anchor: anchor.id, order, parents, reach, mode };
}

export function overpassTurboUrl(query: string): string {
  return `https://overpass-turbo.eu/?Q=${encodeURIComponent(query)}&R`;
}
