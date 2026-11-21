import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readMp4Metadata, type ByteReader } from "@/lib/web/mp4";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const reader = (buf: Buffer): ByteReader => async (o, l) => new Uint8Array(buf.subarray(o, o + l));

function make(ext: string, args: string[]): Buffer {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-mp4-"));
  const out = path.join(dir, `clip.${ext}`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x120:rate=10:duration=1", "-c:v", "libx264", "-preset", "ultrafast", ...args, out]);
  return fs.readFileSync(out);
}

describe.skipIf(!hasFfmpeg)("MP4 metadata", () => {
  it("reads creation time, device and GPS from a QuickTime file", async () => {
    const buf = make("mov", ["-metadata", "creation_time=2019-03-14T10:00:00Z", "-metadata", "location=+51.5074-000.1278/", "-metadata", "make=Apple", "-metadata", "model=iPhone 15"]);
    const m = await readMp4Metadata(reader(buf), buf.length);
    expect(m.createdAt).toBe("2019-03-14T10:00:00.000Z");
    expect(m.gps).toEqual({ lat: 51.507, lon: -0.128 });
    expect(m.fields.make).toBe("Apple");
    expect(m.fields.model).toBe("iPhone 15");
    expect(m.c2paBox).toBe(false);
  });

  it("reads moov at the front (faststart) and the encoder tag", async () => {
    const buf = make("mp4", ["-movflags", "+faststart", "-metadata", "creation_time=2021-10-09T18:20:00Z"]);
    const m = await readMp4Metadata(reader(buf), buf.length);
    expect(m.createdAt).toBe("2021-10-09T18:20:00.000Z");
    expect(m.fields.encoder).toMatch(/^Lavf/);
  });

  it("survives garbage", async () => {
    const buf = Buffer.from("not a video at all, just some bytes that go on for a while");
    const m = await readMp4Metadata(reader(buf), buf.length);
    expect(m.createdAt).toBeUndefined();
  });
});
