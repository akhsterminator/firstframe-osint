import { getPosition, getTimes } from "suncalc";
import type { ChronolocationResult, Confidence, SkyReading, SunWindow } from "../types";
import { localDate, localTime } from "../util/tz";

const DEG = 180 / Math.PI;
const STEP_MS = 2 * 60_000;
const UNCERTAINTY: Record<Confidence, number> = { high: 0.15, medium: 0.3, low: 0.5 };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Apparent sun altitude and compass azimuth, both in degrees (SunCalc v2 conventions). */
export function sunAt(ms: number, lat: number, lon: number) {
  return getPosition(new Date(ms), lat, lon);
}

/** Sun elevation implied by a vertical object's shadow, with an uncertainty band. */
export function altitudeFromShadow(ratio: number, confidence: Confidence) {
  const u = UNCERTAINTY[confidence];
  const alt = (r: number) => Math.atan(1 / r) * DEG;
  return { value: alt(ratio), min: alt(ratio * (1 + u)), max: alt(ratio * Math.max(0.05, 1 - u)) };
}

/** All instants on the local calendar day, sampled every two minutes. */
function daySamples(date: string, timeZone: string): number[] {
  const mid = Date.parse(`${date}T12:00:00Z`);
  const out: number[] = [];
  for (let t = mid - 26 * 3_600_000; t <= mid + 26 * 3_600_000; t += STEP_MS) {
    if (localDate(t, timeZone) === date) out.push(t);
  }
  return out;
}

export function sunWindows(date: string, lat: number, lon: number, timeZone: string, min: number, max: number): SunWindow[] {
  const windows: SunWindow[] = [];
  let start: number | undefined;
  const samples = daySamples(date, timeZone);
  const close = (end: number) => {
    const midT = (start! + end) / 2;
    const pos = sunAt(midT, lat, lon);
    windows.push({ start: new Date(start!).toISOString(), end: new Date(end).toISOString(), altitude: Math.round(pos.altitude * 10) / 10, azimuth: Math.round(pos.azimuth) });
    start = undefined;
  };
  for (const t of samples) {
    const { altitude } = sunAt(t, lat, lon);
    const inside = altitude > 0 && altitude >= min && altitude <= max;
    if (inside && start === undefined) start = t;
    if (!inside && start !== undefined) close(t - STEP_MS);
  }
  if (start !== undefined) close(samples[samples.length - 1]!);
  return windows;
}

/** Months in which the noon sun climbs at least as high as `minAltitude`. */
export function feasibleMonths(lat: number, lon: number, minAltitude: number, year = new Date().getUTCFullYear()): number[] {
  const months: number[] = [];
  for (let m = 0; m < 12; m++) {
    const noon = getTimes(new Date(Date.UTC(year, m, 15, 12)), lat, lon).solarNoon;
    if (noon && sunAt(noon.getTime(), lat, lon).altitude >= minAltitude) months.push(m + 1);
  }
  return months;
}

export function monthRange(months: number[]): string {
  if (!months.length) return "no month of the year";
  if (months.length === 12) return "any month";
  // Collapse into runs, treating December→January as adjacent.
  const set = new Set(months);
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? months[0]!;
  const runs: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((start - 1 + i) % 12) + 1;
    if (set.has(m)) cur.push(m);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs
    .map((r) => (r.length === 1 ? MONTH_NAMES[r[0]! - 1] : `${MONTH_NAMES[r[0]! - 1]}–${MONTH_NAMES[r[r.length - 1]! - 1]}`))
    .join(" and ");
}

export interface ChronoInput {
  lat: number;
  lon: number;
  date: string;
  dateBasis: ChronolocationResult["dateBasis"];
  timeZone: string;
  sky: SkyReading;
}

export function chronolocate(input: ChronoInput): ChronolocationResult {
  const { lat, lon, date, timeZone, sky } = input;
  const times = getTimes(new Date(`${date}T12:00:00Z`), lat, lon);
  const curve = daySamples(date, timeZone)
    .filter((_, i) => i % 5 === 0)
    .map((t) => ({ t: new Date(t).toISOString(), altitude: Math.round(sunAt(t, lat, lon).altitude * 10) / 10 }));
  const peak = Math.max(...curve.map((c) => c.altitude));
  const base = {
    date,
    dateBasis: input.dateBasis,
    timezone: timeZone,
    curve,
    sunrise: times.sunrise?.toISOString(),
    sunset: times.sunset?.toISOString(),
  };

  if (sky.shadowRatio === null || !sky.shadowsVisible) {
    const night = sky.daylight === "night";
    return {
      ...base,
      windows: [],
      feasibleMonths: [],
      verdict: "inconclusive",
      explanation: night
        ? "Filmed after dark, so there are no shadows to read the time from."
        : "No measurable shadow in the frames, so the time of day can't be estimated from the sun.",
    };
  }

  const est = altitudeFromShadow(sky.shadowRatio, sky.shadowRatioConfidence);
  const windows = sunWindows(date, lat, lon, timeZone, est.min, est.max);
  const months = feasibleMonths(lat, lon, est.min, Number(date.slice(0, 4)));
  const estimatedAltitude = { value: Math.round(est.value), min: Math.round(est.min), max: Math.round(est.max) };
  const fmt = (w: SunWindow) => `${localTime(w.start, timeZone)}–${localTime(w.end, timeZone)}`;

  if (windows.length) {
    return {
      ...base,
      estimatedAltitude,
      windows,
      feasibleMonths: months,
      verdict: "consistent",
      explanation: `Shadows put the sun about ${estimatedAltitude.value}° above the horizon. On ${date} that happens ${windows.map(fmt).join(" or ")} local time.`,
    };
  }

  return {
    ...base,
    estimatedAltitude,
    windows,
    feasibleMonths: months,
    verdict: est.min > peak ? "inconsistent" : "inconclusive",
    explanation:
      est.min > peak
        ? `Shadows put the sun about ${estimatedAltitude.value}° up, but on ${date} it never rose above ${Math.round(peak)}° here. That sun height fits ${monthRange(months)}.`
        : `Shadows suggest a sun about ${estimatedAltitude.value}° up, which this date and place only reach at the margins. Treat the time estimate as weak.`,
  };
}
