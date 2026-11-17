import { config } from "../config";
import { run } from "../util/proc";

export interface ProbeStream {
  codec_type: "video" | "audio" | "data" | "subtitle";
  codec_name?: string;
  codec_tag_string?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  nb_frames?: string;
  side_data_list?: { side_data_type?: string; rotation?: number }[];
  tags?: Record<string, string>;
}

export interface ProbeResult {
  format: {
    format_name?: string;
    duration?: string;
    bit_rate?: string;
    tags?: Record<string, string>;
  };
  streams: ProbeStream[];
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run(config.ffprobe, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ], { timeoutMs: 30_000 });
  return JSON.parse(stdout) as ProbeResult;
}

export function videoStream(p: ProbeResult): ProbeStream | undefined {
  return p.streams.find((s) => s.codec_type === "video");
}

export function durationOf(p: ProbeResult): number {
  const d = Number(p.format.duration);
  return Number.isFinite(d) ? d : 0;
}

export function frameRate(s: ProbeStream | undefined): number | undefined {
  const r = s?.avg_frame_rate ?? s?.r_frame_rate;
  if (!r) return undefined;
  const [a, b] = r.split("/").map(Number);
  if (!a || !b) return undefined;
  return a / b;
}
