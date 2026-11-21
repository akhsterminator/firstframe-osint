import { config } from "../config";
import { pool } from "../util/async";
import { run } from "../util/proc";
import { dhash, meanLuma, sharpness } from "./hash";
import { candidateTimes, selectFrames, type RawFrame as GenericFrame } from "./select";

export type RawFrame = GenericFrame<Buffer>;
export { candidateTimes, selectFrames };

const SCENE_THRESHOLD = 0.3;

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

export async function extractKeyframes(
  file: string,
  durationSec: number,
): Promise<{ frames: RawFrame[]; candidates: number }> {
  const scenes = await sceneChanges(file, durationSec).catch(() => []);
  const times = candidateTimes(durationSec, scenes, config.maxDurationSec);
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
