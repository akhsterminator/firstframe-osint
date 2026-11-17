import { describe, expect, it } from "vitest";
import { buildIntegrity } from "@/lib/integrity";
import { readManifest } from "@/lib/integrity/c2pa";
import { parseIso6709 } from "@/lib/integrity/metadata";

describe("integrity signals", () => {
  it("reads an AI source type from a C2PA manifest", () => {
    const r = readManifest({
      active_manifest: "m1",
      manifests: {
        m1: {
          claim_generator_info: [{ name: "Some Video Model" }],
          assertions: [
            {
              label: "c2pa.actions.v2",
              data: { actions: [{ action: "c2pa.created", digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" }] },
            },
          ],
        },
      },
    });
    expect(r).toEqual({ generator: "Some Video Model", actions: ["created"], aiSource: true });
  });

  it("parses phone GPS tags", () => {
    expect(parseIso6709("+51.5074-000.1278+010.000/")).toEqual({ lat: 51.5074, lon: -0.1278 });
    expect(parseIso6709("nonsense")).toBeUndefined();
  });

  it("treats detector scores as signals, never stronger than moderate", () => {
    const r = buildIntegrity({
      metadata: { audio: "present" },
      c2pa: { present: false, parsed: false },
      detectors: [{ detector: "Hive", status: "ok", scores: [0.97, 0.99, 0.95] }],
      fromPlatform: true,
    });
    const s = r.signals.find((x) => x.source === "Hive")!;
    expect(s.strength).toBe("moderate");
    expect(s.direction).toBe("suggests-manipulation");
  });

  it("treats declared AI provenance as strong", () => {
    const r = buildIntegrity({
      metadata: {},
      c2pa: { present: true, parsed: true, aiSource: true, generator: "X" },
      detectors: [],
      fromPlatform: false,
    });
    expect(r.signals[0]).toMatchObject({ id: "c2pa-ai", strength: "strong" });
  });

  it("notes missing credentials without counting them against the video", () => {
    const r = buildIntegrity({ metadata: { encoder: "Lavf60.16.100" }, c2pa: { present: false, parsed: false }, detectors: [], fromPlatform: true });
    expect(r.signals.every((s) => s.direction !== "suggests-manipulation")).toBe(true);
  });
});
