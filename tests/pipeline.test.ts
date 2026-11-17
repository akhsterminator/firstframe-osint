import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { renderCard } from "@/lib/card/render";
import { newReport } from "@/lib/pipeline/jobs";
import { runPipeline } from "@/lib/pipeline/run";
import type { Provider } from "@/lib/provenance/hits";
import { SAMPLE_SCENE } from "@/lib/sample";
import { LocalStore } from "@/lib/store/local";
import { ELEMENTS } from "./fixtures/osm";
import { wetDay } from "./fixtures/weather";
import { makeTestVideo } from "./fixtures/video";

const hasTools = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasTools)("pipeline, end to end with stubbed services", () => {
  let dir = "";
  let video = "";
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-pipe-"));
    process.env.FF_DATA_DIR = dir;
    process.env.FF_TILE_URL = "off";
    video = makeTestVideo(dir);
  });

  it("runs every stage and writes findings and a card", async () => {
    const store = new LocalStore(dir);
    const url = "https://www.tiktok.com/@someone/video/7571234567890123456";
    const report = newReport({ input: url, platform: "tiktok" }, "tiktok:7571234567890123456", { place: "Hereford", date: "2025-11-12" });

    const provider: Provider = {
      name: "Stub",
      unavailable: () => undefined,
      search: async (f) => [{ url: "https://localnews.example/2021/10/09/river", provider: "Stub", frameId: f.id, exact: true }],
    };

    const updates: string[] = [];
    const done = await runPipeline(report, { kind: "url", url }, {
      store,
      download: async (_u, workDir) => {
        const file = path.join(workDir, "source.mp4");
        fs.copyFileSync(video, file);
        return { file, title: "River footage", caption: "Hereford underwater last night" };
      },
      scene: async () => SAMPLE_SCENE,
      providers: [provider],
      fetchPageDate: async () => undefined,
      geocode: async () => ({ lat: 52.056, lon: -2.716, label: "Hereford, Herefordshire", area: { kind: "bbox", value: "52.02,-2.77,52.09,-2.67", label: "Hereford" } }),
      geo: { overpass: async (q) => (q.includes("GB-ENG") ? ELEMENTS : []), reverse: async () => "Bewdley, Worcestershire" },
      weather: async (_lat, _lon, date) => wetDay(date),
      detectors: async () => [{ detector: "Stub", status: "ok", scores: [0.02, 0.05] }],
      onUpdate: (r) => updates.push(r.status),
    });

    expect(done.error).toBeUndefined();
    expect(done.status).toBe("done");
    for (const [id, stage] of Object.entries(done.stages)) expect([id, stage.status]).toEqual([id, "done"]);

    expect(done.source.postedAtSource).toBe("id");
    expect(done.frames.length).toBeGreaterThanOrEqual(3);
    expect(fs.existsSync(path.join(dir, "files", done.frames[0]!.key))).toBe(true);
    expect(done.stages.provenance.data?.earliest?.domain).toBe("localnews.example");
    expect(done.stages.geolocation.data?.best?.label).toContain("Bewdley");
    expect(done.stages.weather.data?.verdict).toBe("inconsistent");

    const titles = done.findings.map((f) => f.title);
    expect(titles[0]).toMatch(/^Online since/);
    expect(titles).toContain("Scene fits Bewdley, not Hereford");
    expect(titles).toContain("Weather doesn't match records");

    expect(updates.length).toBeGreaterThan(8);
    expect(fs.existsSync(path.join(dir, "tmp", report.id))).toBe(false);

    const png = await renderCard(done, "portrait", store);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("fails cleanly when the download fails", async () => {
    const store = new LocalStore(dir);
    const report = newReport({ input: "https://x.com/a/status/1", platform: "x" }, "x:1");
    const done = await runPipeline(report, { kind: "url", url: "https://x.com/a/status/1" }, {
      store,
      download: async () => {
        throw new Error("This post is private");
      },
    });
    expect(done.status).toBe("failed");
    expect(done.stages.ingest.status).toBe("error");
    expect(done.error).toContain("private");
    expect((await store.getReport(report.id))?.status).toBe("failed");
  });
});
