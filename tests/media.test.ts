import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { anonymise, nms } from "@/lib/media/faces";
import { dhash, hamming } from "@/lib/media/hash";
import { candidateTimes, extractKeyframes } from "@/lib/media/keyframes";
import { makeTestVideo } from "./fixtures/video";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("hashing", () => {
  it("gives near-identical hashes for a resized copy", async () => {
    const img = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#333" } })
      .composite([{ input: Buffer.from('<svg width="400" height="300"><circle cx="120" cy="150" r="80" fill="#fff"/></svg>') }])
      .png()
      .toBuffer();
    const small = await sharp(img).resize(200).jpeg({ quality: 60 }).toBuffer();
    expect(hamming(await dhash(img), await dhash(small))).toBeLessThanOrEqual(4);
  });
});

describe("faces", () => {
  it("merges overlapping boxes", () => {
    const kept = nms([
      { x: 0, y: 0, w: 10, h: 10, score: 0.9 },
      { x: 1, y: 1, w: 10, h: 10, score: 0.8 },
      { x: 50, y: 50, w: 10, h: 10, score: 0.7 },
    ]);
    expect(kept).toHaveLength(2);
  });

  it("loads the bundled detector and finds nothing in an empty frame", async () => {
    const blank = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#808080" } }).jpeg().toBuffer();
    const { faces, image } = await anonymise(blank);
    expect(faces).toBe(0);
    expect(image.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasFfmpeg)("keyframes", () => {
  let video = "";
  beforeAll(() => {
    video = makeTestVideo(fs.mkdtempSync(path.join(os.tmpdir(), "ff-")));
  });

  it("samples the start, every cut and a grid", () => {
    const t = candidateTimes(6, [2, 4]);
    expect(t[0]).toBe(0);
    expect(t).toContain(2.15);
    expect(t.length).toBeLessThanOrEqual(24);
  });

  it("extracts distinct frames from each shot", async () => {
    const { frames } = await extractKeyframes(video, 6);
    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames[0]!.t).toBeLessThan(0.6);
    expect(frames.some((f) => f.t >= 2 && f.t < 4)).toBe(true);
    expect(frames.some((f) => f.t >= 4)).toBe(true);
  });
});
