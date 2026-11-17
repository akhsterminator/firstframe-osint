import { config } from "../config";
import { pool } from "../util/async";
import { run } from "../util/proc";
import { dhash, hamming, meanLuma, sharpness } from "./hash";

export interface RawFrame {
  t: number;
  image: Buffer;
  dhash: string;
  sharpness: number;
}

const SCENE_THRESHOLD = 0.3;
const MAX_CANDIDATES = 24;
const DUPLICATE_DISTANCE = 8;

export async function sceneChanges(file: string, durationSec: number): Promise<number[]> {
  const limit = Math.min(durationSec || config.maxDurationSec, config.maxDurationSec);
  const { stdout } = await run(
    config.ffmpeg,
    [
      "-hide_banner", "-nostats",
      "-t", String(limit),
      "-i", file,
      "-an", "-sn", "-dn",
      "-vf", `scale=320:-2,select='gt(scene,${SCENE_THRESHOLD})',metadata=print:file=-`,
      "-f", "null", "-",
    ],
    { timeoutMs: 120_000, allowFailure: true },
  );
  const times: number[] = [];
  for (const m of stdout.matchAll(/pts_time:([\d.]+)/g)) times.push(Number(m[1]));
  return times;
}

export function candidateTimes(durationSec: number, scenes: number[]): number[] {
  const d = Math.max(0.1, Math.min(durationSec, config.maxDurationSec));
  // Opening frames and the moment just after each cut come first; the regular
  // grid only fills gaps, so it never crowds out a new shot.
  const priority = [0, Math.min(0.5, d / 4), ...scenes.map((s) => Math.min(d - 0.05, s + 0.15))];
  const grid = Array.from({ length: 9 }, (_, i) => (d * (i + 1)) / 10);
  const chosen: number[] = [];
  for (const t of [...priority, ...grid]) {
    if (t < 0 || t >= d) continue;
    if (chosen.some((c) => Math.abs(c - t) < 0.4)) continue;
    chosen.push(Math.round(t * 1000) / 1000);
  }
  chosen.sort((a, b) => a - b);
  if (chosen.length <= MAX_CANDIDATES) return chosen;
  const step = chosen.length / MAX_CANDIDATES;
  return Array.from({ length: MAX_CANDIDATES }, (_, i) => chosen[Math.floor(i * step)]!);
}

export async function grabFrame(file: string, t: number): Promise<Buffer | undefined> {
  const { stdout } = await runBinary(config.ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-ss", t.toFixed(3),
    "-i", file,
    "-frames:v", "1",
    "-vf", "scale='min(1280,iw)':-2",
    "-q:v", "2",
    "-f", "image2pipe", "-vcodec", "mjpeg", "-",
  ]);
  return stdout.length > 1000 ? stdout : undefined;
}

async function runBinary(cmd: string, args: string[]): Promise<{ stdout: Buffer }> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("close", () => {
      clearTimeout(timer);
      resolve({ stdout: Buffer.concat(chunks) });
    });
  });
}

/**
 * Pick frames that are sharp, not black, not near-duplicates, and spread across
 * the clip. The earliest usable frame is always kept: it's the one most likely
 * to match an original upload before someone re-cut it.
 */
export function selectFrames(frames: RawFrame[], max: number): RawFrame[] {
  const unique: RawFrame[] = [];
  for (const f of [...frames].sort((a, b) => a.t - b.t)) {
    const dup = unique.findIndex((u) => hamming(u.dhash, f.dhash) <= DUPLICATE_DISTANCE);
    if (dup === -1) unique.push(f);
    else if (f.sharpness > unique[dup]!.sharpness * 1.5 && dup !== 0) unique[dup] = f;
  }
  if (unique.length <= max) return unique;

  const first = unique[0]!;
  const rest = unique.slice(1);
  const span = rest[rest.length - 1]!.t - rest[0]!.t || 1;
  const buckets = max - 1;
  const chosen = new Set<RawFrame>([first]);
  for (let b = 0; b < buckets; b++) {
    const lo = rest[0]!.t + (span * b) / buckets;
    const hi = rest[0]!.t + (span * (b + 1)) / buckets;
    const inBucket = rest.filter((f) => f.t >= lo && (b === buckets - 1 ? f.t <= hi : f.t < hi));
    const best = inBucket.sort((x, y) => y.sharpness - x.sharpness)[0];
    if (best) chosen.add(best);
  }
  for (const f of [...rest].sort((x, y) => y.sharpness - x.sharpness)) {
    if (chosen.size >= max) break;
    chosen.add(f);
  }
  return [...chosen].sort((a, b) => a.t - b.t);
}

export async function extractKeyframes(
  file: string,
  durationSec: number,
): Promise<{ frames: RawFrame[]; candidates: number }> {
  const scenes = await sceneChanges(file, durationSec).catch(() => []);
  const times = candidateTimes(durationSec, scenes);
  const grabbed = await pool(times, 4, async (t) => {
    const image = await grabFrame(file, t).catch(() => undefined);
    if (!image) return undefined;
    const luma = await meanLuma(image);
    if (luma < 12 || luma > 248) return undefined;
    return { t, image, dhash: await dhash(image), sharpness: await sharpness(image) } satisfies RawFrame;
  });
  const usable = grabbed.filter((f): f is RawFrame => !!f);
  if (!usable.length) throw new Error("Could not extract any usable frames from the video");
  return { frames: selectFrames(usable, config.maxFrames), candidates: usable.length };
}
