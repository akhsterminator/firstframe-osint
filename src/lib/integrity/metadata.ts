import type { ProbeResult } from "../media/probe";
import { durationOf, frameRate, videoStream } from "../media/probe";

const KEEP = [
  "encoder",
  "creation_time",
  "major_brand",
  "compatible_brands",
  "handler_name",
  "com.apple.quicktime.make",
  "com.apple.quicktime.model",
  "com.apple.quicktime.software",
  "com.apple.quicktime.creationdate",
  "com.android.version",
  "com.android.manufacturer",
  "com.android.model",
  "software",
  "comment",
  "description",
  "title",
];

/** ISO 6709, as written by phones: "+51.5074-000.1278+010.000/" */
export function parseIso6709(s: string | undefined): { lat: number; lon: number } | undefined {
  const m = s?.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
}

export function summariseMetadata(p: ProbeResult): { fields: Record<string, string>; gps?: { lat: number; lon: number } } {
  const fields: Record<string, string> = {};
  const tags = { ...(p.format.tags ?? {}) };
  const v = videoStream(p);
  for (const s of p.streams) for (const [k, val] of Object.entries(s.tags ?? {})) if (!(k in tags)) tags[k] = val;
  const lower = Object.fromEntries(Object.entries(tags).map(([k, val]) => [k.toLowerCase(), val]));

  for (const k of KEEP) if (lower[k]) fields[k] = String(lower[k]).slice(0, 200);
  if (v) {
    fields.video = [v.codec_name, v.width && v.height ? `${v.width}×${v.height}` : undefined, frameRate(v) ? `${frameRate(v)!.toFixed(2)} fps` : undefined]
      .filter(Boolean)
      .join(", ");
  }
  fields.audio = p.streams.some((s) => s.codec_type === "audio") ? "present" : "none";
  fields.container = p.format.format_name ?? "unknown";
  fields.duration = `${durationOf(p).toFixed(1)} s`;

  const gps = parseIso6709(lower["com.apple.quicktime.location.iso6709"] ?? lower["location"] ?? lower["location-eng"]);
  // Round to about 100 m: enough to verify a scene, not enough to pinpoint a doorstep.
  if (gps) fields.gps = `${gps.lat.toFixed(3)}, ${gps.lon.toFixed(3)}`;
  return { fields, gps: gps ? { lat: Math.round(gps.lat * 1000) / 1000, lon: Math.round(gps.lon * 1000) / 1000 } : undefined };
}
