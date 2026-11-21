import { describe, expect, it } from "vitest";
import { PRESETS, presetFeature } from "@/lib/geo/presets";
import { searchScene } from "@/lib/geo/search";
import { decodeScene, encodeScene } from "@/lib/geo/share";
import { SAMPLE_SCENE } from "@/lib/sample";
import { ELEMENTS } from "./fixtures/osm";

describe("scene search", () => {
  it("falls back to a relaxed search and names the winner", async () => {
    const queries: string[] = [];
    const r = await searchScene(SAMPLE_SCENE.features, SAMPLE_SCENE.relations, { kind: "subdivision", value: "GB-ENG", label: "England" }, {
      overpass: async (q) => {
        queries.push(q);
        return queries.length === 1 ? [] : ELEMENTS;
      },
      reverse: async () => "Bewdley, Worcestershire",
    });
    expect(queries).toHaveLength(2);
    expect(r.searches.map((s) => s.status)).toEqual(["empty", "ok"]);
    expect(r.candidates[0]?.label).toBe("Bewdley, Worcestershire");
  });

  it("round-trips a scene through a share link and re-validates it", () => {
    const q = { ...SAMPLE_SCENE, area: { kind: "country" as const, value: "GB", label: "United Kingdom" }, title: "Bridge by a church" };
    const back = decodeScene(encodeScene(q))!;
    expect(back.features).toEqual(SAMPLE_SCENE.features);
    expect(back.relations).toEqual(SAMPLE_SCENE.relations);
    expect(back.area?.value).toBe("GB");
    expect(back.title).toBe("Bridge by a church");
  });

  it("rejects tampered share links", () => {
    expect(decodeScene("not-base64!!")).toBeUndefined();
    const evil = btoa(JSON.stringify({ f: [["a", "x", [[['x"];out;', "y"]]], null, "rare"]], r: [] })).replace(/=+$/, "");
    expect(decodeScene(evil)?.features).toEqual([]);
  });

  it("has presets with valid, unique tags", () => {
    const ids = new Set(PRESETS.map((p) => p.id));
    expect(ids.size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(presetFeature(p, "a").tagSets.length).toBeGreaterThan(0);
  });
});
