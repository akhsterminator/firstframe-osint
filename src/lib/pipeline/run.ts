import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { chronolocate } from "../chrono/sun";
import { config } from "../config";
import { buildFindings, type ClaimedPlace } from "../findings";
import { geocode, type Geocoded } from "../geo/nominatim";
import { runGeolocation, type GeolocationDeps } from "../geo";
import { downloadWithYtDlp, resolveShortLink, sha256File } from "../ingest/download";
import { parseSourceUrl } from "../ingest/url";
import { checkC2pa } from "../integrity/c2pa";
import { runDetectors, type DetectorRun } from "../integrity/detectors";
import { buildIntegrity } from "../integrity";
import { summariseMetadata } from "../integrity/metadata";
import { anonymise } from "../media/faces";
import { extractKeyframes } from "../media/keyframes";
import { durationOf, probe, videoStream } from "../media/probe";
import type { Provider } from "../provenance/hits";
import type { PageDate } from "../provenance/page-date";
import { runProvenance } from "../provenance";
import type { Store } from "../store";
import type {
  ChronolocationResult,
  Frame,
  Report,
  ReportStages,
  SceneAnalysis,
  StageId,
} from "../types";
import { errorMessage } from "../util/async";
import { isoDay, parseLooseDate, toIso } from "../util/dates";
import { solarZone, isValidTimeZone } from "../util/tz";
import { analyseScene, type SceneInput } from "../vision/scene";
import { compareWeather } from "../weather/compare";
import { fetchWeather, type WeatherDay } from "../weather/open-meteo";

export type PipelineSource = { kind: "url"; url: string } | { kind: "file"; path: string; name: string };

export interface PipelineDeps {
  store: Store;
  download?: typeof downloadWithYtDlp;
  scene?: (input: SceneInput) => Promise<SceneAnalysis>;
  providers?: Provider[];
  fetchPageDate?: (url: string) => Promise<PageDate | undefined>;
  geo?: GeolocationDeps;
  geocode?: (place: string) => Promise<Geocoded | undefined>;
  weather?: (lat: number, lon: number, date: string) => Promise<WeatherDay>;
  detectors?: (frames: Buffer[]) => Promise<DetectorRun[]>;
  anonymise?: typeof anonymise;
  onUpdate?: (report: Report) => void;
}

class Skip extends Error {}

/**
 * Runs every stage for one report. Stages that can run side by side do; each
 * one records its own status so a failure in one never sinks the others.
 */
export async function runPipeline(report: Report, source: PipelineSource, deps: PipelineDeps): Promise<Report> {
  const started = Date.now();
  const workDir = path.join(config.dataDir, "tmp", report.id);
  await fs.mkdir(workDir, { recursive: true });

  let saving = Promise.resolve();
  const commit = () => {
    report.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(report);
    deps.onUpdate?.(snapshot);
    saving = saving.then(() => deps.store.saveReport(snapshot)).catch(() => {});
    return saving;
  };

  async function stage<K extends StageId>(id: K, fn: () => Promise<NonNullable<ReportStages[K]["data"]>>): Promise<ReportStages[K]["data"]> {
    const s = report.stages[id];
    s.status = "running";
    s.startedAt = new Date().toISOString();
    void commit();
    try {
      const data = await fn();
      s.data = data;
      s.status = "done";
      return data;
    } catch (err) {
      if (err instanceof Skip) {
        s.status = "skipped";
        s.note = err.message;
      } else {
        s.status = "error";
        s.error = errorMessage(err);
      }
      return undefined;
    } finally {
      s.finishedAt = new Date().toISOString();
      void commit();
    }
  }

  report.status = "running";
  await commit();

  let videoFile = "";
  let metadata: Record<string, string> = {};
  const frameJpegs = new Map<string, Buffer>();

  try {
    // 1. Ingest
    const ingest = await stage("ingest", async () => {
      const info = { ...report.source };
      if (source.kind === "url") {
        let parsed = parseSourceUrl(source.url);
        if (parsed?.needsResolve) parsed = parseSourceUrl(await resolveShortLink(parsed.url)) ?? parsed;
        const dl = await (deps.download ?? downloadWithYtDlp)(parsed?.url ?? source.url, workDir);
        videoFile = dl.file;
        info.canonicalUrl = dl.canonicalUrl ?? parsed?.url;
        info.title = dl.title;
        info.caption = dl.caption;
        info.postId = parsed?.postId;
        if (parsed?.idTime) {
          info.postedAt = toIso(parsed.idTime);
          info.postedAtSource = "id";
        } else if (dl.postedAt) {
          info.postedAt = toIso(dl.postedAt);
          info.postedAtSource = "platform";
        }
      } else {
        videoFile = source.path;
        info.title = source.name;
      }
      const p = await probe(videoFile);
      const v = videoStream(p);
      if (!v) throw new Error("No video stream found in the file");
      info.durationSec = Math.round(durationOf(p) * 10) / 10;
      info.width = v.width;
      info.height = v.height;
      info.sha256 = await sha256File(videoFile);
      const meta = summariseMetadata(p);
      metadata = meta.fields;
      info.gps = meta.gps;
      if (source.kind === "file" && !info.postedAt) {
        const created = parseLooseDate(meta.fields["com.apple.quicktime.creationdate"] ?? meta.fields.creation_time);
        if (created) {
          info.postedAt = toIso(created);
          info.postedAtSource = "file";
        }
      }
      report.source = info;
      return info;
    });
    if (!ingest) throw new Error(report.stages.ingest.error ?? "Could not fetch the video");

    // 2. Keyframes, blurred before anything is stored
    const kf = await stage("keyframes", async () => {
      const { frames: raw, candidates } = await extractKeyframes(videoFile, report.source.durationSec ?? 0);
      const blur = deps.anonymise ?? anonymise;
      const frames: Frame[] = [];
      for (const [i, f] of raw.entries()) {
        const { image, faces } = await blur(f.image);
        const id = `f${i}`;
        const key = `frames/${report.id}/${id}.jpg`;
        const url = await deps.store.putFile(key, image, "image/jpeg");
        frameJpegs.set(id, image);
        const meta = await sharp(image).metadata();
        frames.push({ id, index: i, t: Math.round(f.t * 100) / 100, key, url, width: meta.width ?? 0, height: meta.height ?? 0, facesBlurred: faces, dhash: f.dhash, sharpness: Math.round(f.sharpness) });
      }
      report.frames = frames;
      report.heroFrameId = pickHero(frames);
      return { count: frames.length, candidates };
    });
    if (!kf) throw new Error(report.stages.keyframes.error ?? "Could not extract frames");

    const searchFrames = searchOrder(report.frames, report.heroFrameId)
      .slice(0, config.searchFrames)
      .map((f) => ({ id: f.id, image: frameJpegs.get(f.id)!, publicUrl: deps.store.publicUrl(f.key) }));

    // 3. In parallel: provenance, scene reading, and the file-level integrity checks
    const provenanceP = stage("provenance", () =>
      runProvenance(searchFrames, report.source, { providers: deps.providers, fetchDate: deps.fetchPageDate }),
    );

    const sceneP = stage("scene", async () => {
      const analyse = deps.scene ?? (config.anthropicKey ? (i: SceneInput) => analyseScene(i, new Anthropic()) : undefined);
      if (!analyse) throw new Skip("Set ANTHROPIC_API_KEY to read the scene");
      return analyse({
        platform: report.source.platform,
        title: report.source.title,
        caption: report.source.caption,
        claimPlace: report.claim?.place,
        claimDate: report.claim?.date,
        frames: report.frames.map((f) => ({ index: f.index, t: f.t, jpeg: frameJpegs.get(f.id)! })),
      });
    });

    const fileChecksP = Promise.all([
      checkC2pa(videoFile).catch(() => ({ present: false, parsed: false })),
      (deps.detectors ?? runDetectors)(searchFrames.map((f) => f.image)).catch(() => [] as DetectorRun[]),
    ]);

    const claimPointP = report.claim?.place
      ? (deps.geocode ?? geocode)(report.claim.place).catch(() => undefined)
      : Promise.resolve(undefined);

    const scene = await sceneP;

    const integrityP = stage("integrity", async () => {
      const [c2pa, detectors] = await fileChecksP;
      return buildIntegrity({ metadata, c2pa, detectors, scene, fromPlatform: source.kind === "url" });
    });

    // 4. Geolocation needs the scene reading
    const geo = await stage("geolocation", async () => {
      if (!scene) throw new Skip("Needs the scene reading");
      if (scene.features.length < 2 && !report.claim?.place && !report.source.gps) {
        throw new Skip("Not enough distinctive map features in view");
      }
      return runGeolocation(
        { scene, claimPlace: report.claim?.place, gps: report.source.gps },
        { geocode: deps.geocode, ...deps.geo },
      );
    });

    const provenance = await provenanceP;

    // 5. Time and weather need a place and a date
    const point = geo?.point;
    const when = pickDate(report, provenance?.earliest?.firstSeen, provenance?.leadDays);
    let weatherDay: WeatherDay | undefined;
    if (point && when) {
      weatherDay = await (deps.weather ?? fetchWeather)(point.lat, point.lon, when.date).catch(() => undefined);
    }
    const tz = weatherDay && isValidTimeZone(weatherDay.timezone) ? weatherDay.timezone : point ? solarZone(point.lon) : "UTC";

    const sun = await stage("chronolocation", async () => {
      if (!scene) throw new Skip("Needs the scene reading");
      if (!point) throw new Skip("Needs a location");
      if (!when) throw new Skip("No date to test: add a claimed date");
      return chronolocate({ lat: point.lat, lon: point.lon, date: when.date, dateBasis: when.basis, timeZone: tz, sky: scene.sky });
    });

    await stage("weather", async () => {
      if (!scene) throw new Skip("Needs the scene reading");
      if (!point) throw new Skip("Needs a location");
      if (!when) throw new Skip("No date to test: add a claimed date");
      if (!weatherDay) throw new Error("Weather records unavailable for this date and place");
      return compareWeather(weatherDay, scene.sky, { date: when.date, location: point.label.split(",")[0]!, windows: sun?.windows ?? [] });
    });

    await integrityP;

    const claimPoint = await claimPointP;
    report.findings = buildFindings(report, claimPoint ? claimedPlace(claimPoint) : undefined);
    report.status = "done";
  } catch (err) {
    report.status = "failed";
    report.error = errorMessage(err);
  } finally {
    report.elapsedMs = Date.now() - started;
    await commit();
    await saving;
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (source.kind === "file") await fs.rm(source.path, { force: true }).catch(() => {});
  }
  return report;
}

export function claimedPlace(g: Geocoded): ClaimedPlace {
  const bbox = g.area.kind === "bbox" ? (g.area.value.split(",").map(Number) as [number, number, number, number]) : undefined;
  return { lat: g.lat, lon: g.lon, label: g.label, bbox };
}

/** The first frame if it's reasonably sharp, otherwise the sharpest one. */
export function pickHero(frames: Frame[]): string | undefined {
  if (!frames.length) return undefined;
  const sharpest = [...frames].sort((a, b) => b.sharpness - a.sharpness)[0]!;
  const first = frames[0]!;
  return first.sharpness >= sharpest.sharpness * 0.5 ? first.id : sharpest.id;
}

/** Search the first frame, then the hero, then the sharpest of the rest. */
export function searchOrder(frames: Frame[], heroId?: string): Frame[] {
  const out: Frame[] = [];
  const push = (f?: Frame) => f && !out.includes(f) && out.push(f);
  push(frames[0]);
  push(frames.find((f) => f.id === heroId));
  for (const f of [...frames].sort((a, b) => b.sharpness - a.sharpness)) push(f);
  return out;
}

export function pickDate(
  report: Report,
  earliest?: string,
  leadDays?: number,
): { date: string; basis: ChronolocationResult["dateBasis"] } | undefined {
  const claimed = parseLooseDate(report.claim?.date);
  if (claimed) return { date: isoDay(claimed), basis: "claim" };
  // A recycled clip was filmed before its first appearance, not on the repost date.
  if (earliest && leadDays !== undefined && leadDays >= 2) return { date: isoDay(earliest), basis: "earliest-copy" };
  if (report.source.postedAt) {
    return { date: isoDay(report.source.postedAt), basis: report.source.postedAtSource === "file" ? "file" : "post" };
  }
  return undefined;
}

export function emptyStages(): ReportStages {
  return {
    ingest: { status: "pending" },
    keyframes: { status: "pending" },
    provenance: { status: "pending" },
    scene: { status: "pending" },
    geolocation: { status: "pending" },
    chronolocation: { status: "pending" },
    weather: { status: "pending" },
    integrity: { status: "pending" },
  };
}
