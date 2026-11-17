import { execFileSync } from "node:child_process";
import path from "node:path";

/** A six-second clip made of three shots, with hard cuts at 2 s and 4 s. */
export function makeTestVideo(dir: string): string {
  const out = path.join(dir, "clip.mp4");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=2",
    "-f", "lavfi", "-i", "smptebars=size=640x360:rate=25:duration=2",
    "-f", "lavfi", "-i", "mandelbrot=size=640x360:rate=25",
    "-filter_complex", "[2:v]trim=duration=2,setpts=PTS-STARTPTS[m];[0:v][1:v][m]concat=n=3:v=1:a=0,format=yuv420p[v]",
    "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", out,
  ]);
  return out;
}
