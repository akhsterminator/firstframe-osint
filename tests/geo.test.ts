import { describe, expect, it } from "vitest";
import { chooseAnchor, compileQuery, featureSelectors, searchTree } from "@/lib/geo/compile";
import { runGeolocation } from "@/lib/geo";
import { rankCandidates } from "@/lib/geo/rank";
import { ELEMENTS } from "./fixtures/osm";
import { SAMPLE_SCENE } from "@/lib/sample";
import type { MapFeature } from "@/lib/types";
import { sanitiseFeatures } from "@/lib/vision/scene";

const { features, relations } = SAMPLE_SCENE;
const england = { kind: "subdivision" as const, value: "GB-ENG", label: "England" };

describe("Overpass compiler", () => {
  it("anchors on the rarest, best-connected feature", () => {
    expect(chooseAnchor(features, relations).id).toBe("a");
  });

  it("builds a spanning tree with cumulative reach", () => {
    const t = searchTree(features, relations, "a");
    expect(t.order[0]).toBe("a");
    expect(t.parents.c).toEqual({ parent: "a", distance: 60 });
    expect(t.reach.d).toBe(300);
  });

  it("emits a strict query that prunes back up the tree", () => {
    const q = compileQuery(features, relations, england).query;
    expect(q).toContain('area["ISO3166-2"="GB-ENG"]->.region;');
    expect(q).toContain('nwr["bridge"="yes"]["highway"](area.region);');
    expect(q).toContain('nwr["waterway"="river"](around.f_a:60);');
    expect(q).toContain("nwr.f_a(around.f_c:60)->.f_a;");
    expect(q).toMatch(/\.f_a out tags center qt 200;/);
  });

  it("emits a relaxed query that keeps partial matches", () => {
    const q = compileQuery(features, relations, england, "relaxed").query;
    expect(q).toContain("(around.f_a:300)");
    expect(q).not.toContain("nwr.f_a(around.f_c:60)->.f_a;");
  });

  it("escapes names so model output can't break out of the query", () => {
    const evil: MapFeature = { id: "x", label: "sign", tagSets: [], name: 'St. Mary"];out;', rarity: "rare" };
    const [sel] = featureSelectors(evil);
    // The quote is escaped for the QL string and the bracket for the regex.
    expect(sel).toBe(String.raw`nwr["name"~"St\\. Mary\"\\];out;",i]`);
  });

  it("drops invalid tags before they reach a query", () => {
    const { features: clean, relations: rel } = sanitiseFeatures(
      [
        { id: "a", label: "ok", tagSets: [[{ key: "amenity", value: "cafe" }]], name: null, rarity: "common" },
        { id: "b", label: "bad", tagSets: [[{ key: 'x"]', value: "y" }]], name: null, rarity: "common" },
      ],
      [{ from: "a", to: "b", maxDistanceM: 100 }],
    );
    expect(clean.map((f) => f.id)).toEqual(["a"]);
    expect(rel).toEqual([]);
  });

  it("validates area codes", () => {
    expect(() => compileQuery(features, relations, { kind: "country", value: 'GB"];', label: "x" })).toThrow();
  });
});

describe("candidate ranking", () => {
  it("ranks the place where the whole scene fits first", () => {
    const compiled = compileQuery(features, relations, england, "relaxed");
    const ranked = rankCandidates(ELEMENTS, features, compiled, "England");
    expect(ranked[0]!.score).toBe(1);
    expect(ranked[0]!.label).toBe("Bewdley Bridge, England");
    expect(ranked[0]!.missingFeatures).toEqual([]);
    expect(ranked[1]!.score).toBeLessThan(1);
  });

  it("searches the claim first, then falls back to region hypotheses", async () => {
    const seen: string[] = [];
    const result = await runGeolocation(
      { scene: SAMPLE_SCENE, claimPlace: "Hereford" },
      {
        geocode: async () => ({ lat: 52.056, lon: -2.716, label: "Hereford", area: { kind: "bbox", value: "52.02,-2.77,52.09,-2.67", label: "Hereford" } }),
        overpass: async (q) => {
          seen.push(q.includes("(52.02000") ? "claim" : q.includes("GB-ENG") ? "england" : "other");
          return q.includes("GB-ENG") ? ELEMENTS : [];
        },
        reverse: async () => "Bewdley, Worcestershire",
      },
    );
    expect(seen.slice(0, 3)).toEqual(["claim", "claim", "england"]);
    expect(result.basis).toBe("candidate");
    expect(result.best?.label).toContain("Bewdley");
  });

  it("uses the claimed place when the map search comes up empty", async () => {
    const result = await runGeolocation(
      { scene: SAMPLE_SCENE, claimPlace: "Hereford" },
      {
        geocode: async () => ({ lat: 52.056, lon: -2.716, label: "Hereford", area: { kind: "bbox", value: "52.02,-2.77,52.09,-2.67", label: "Hereford" } }),
        overpass: async () => [],
        reverse: async () => undefined,
      },
    );
    expect(result.basis).toBe("claim");
    expect(result.point?.label).toBe("Hereford");
  });
});
