import type { SkyReading, SunWindow, WeatherCheck, WeatherResult } from "../types";
import type { WeatherDay } from "./open-meteo";
import { describeCode } from "./open-meteo";

const RAIN_MM = 0.2;

function window(day: WeatherDay, date: string, windows: SunWindow[]) {
  const inDay = day.hourly.filter((h) => {
    const t = Date.parse(h.t);
    const local = new Date(t + day.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
    return local === date;
  });
  if (windows.length) {
    const hit = inDay.filter((h) => {
      const t = Date.parse(h.t);
      return windows.some((w) => t >= Date.parse(w.start) - 3_600_000 && t <= Date.parse(w.end) + 3_600_000);
    });
    if (hit.length) return { hours: hit, label: "around the times the sun matches" };
  }
  const rise = day.daily.sunrise ? Date.parse(day.daily.sunrise) : undefined;
  const set = day.daily.sunset ? Date.parse(day.daily.sunset) : undefined;
  const daylight = rise && set ? inDay.filter((h) => Date.parse(h.t) >= rise && Date.parse(h.t) <= set) : inDay;
  return { hours: daylight.length ? daylight : inDay, label: "during daylight" };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : Number.NaN);

export function compareWeather(
  day: WeatherDay,
  sky: SkyReading,
  ctx: { date: string; location: string; windows: SunWindow[] },
): WeatherResult {
  const { hours, label } = window(day, ctx.date, ctx.windows);
  const checks: WeatherCheck[] = [];
  const rainHours = hours.filter((h) => h.precipitation >= RAIN_MM).length;
  const rainTotal = Math.round(sum(hours.map((h) => h.precipitation)) * 10) / 10;
  const cloud = Math.round(mean(hours.filter((h) => h.cloud >= 0).map((h) => h.cloud)));
  const firstHour = hours[0] ? Date.parse(hours[0].t) : Date.now();
  const before = day.hourly.filter((h) => Date.parse(h.t) < firstHour && Date.parse(h.t) >= firstHour - 12 * 3_600_000);
  const rainBefore = sum(before.map((h) => h.precipitation));
  const snowDepth = Math.max(0, ...hours.map((h) => h.snowDepth));
  const recordedPrecip = rainHours ? `${rainTotal} mm over ${rainHours} h ${label}` : `no precipitation ${label}`;

  if (sky.precipitation === "rain" || sky.precipitation === "snow") {
    checks.push({
      aspect: "precipitation",
      observed: `${sky.precipitation} falling`,
      recorded: recordedPrecip,
      result: rainHours > 0 ? "consistent" : rainBefore > 0.5 ? "inconclusive" : "inconsistent",
      weight: "moderate",
    });
  } else if (sky.precipitation === "none" && (sky.cloudCover === "clear" || sky.sunVisible)) {
    const wetFraction = hours.length ? rainHours / hours.length : 0;
    checks.push({
      aspect: "precipitation",
      observed: "dry, with sunshine",
      recorded: recordedPrecip,
      result: wetFraction >= 0.75 && rainTotal >= 3 ? "inconsistent" : "consistent",
      weight: "moderate",
    });
  }

  if (sky.ground === "wet") {
    checks.push({
      aspect: "ground",
      observed: "wet ground",
      recorded: rainHours || rainBefore > 0.2 ? `rain that day or the night before` : "no rain in the preceding 12 hours",
      result: rainHours || rainBefore > 0.2 ? "consistent" : "inconclusive",
      weight: "weak",
    });
  }

  if (sky.ground === "snow") {
    const warm = day.daily.tempMax > 10 && snowDepth === 0;
    checks.push({
      aspect: "snow",
      observed: "snow on the ground",
      recorded: snowDepth > 0 ? `${Math.round(snowDepth * 100)} cm snow depth` : `no snow cover, high of ${Math.round(day.daily.tempMax)}°C`,
      result: snowDepth > 0 ? "consistent" : warm ? "inconsistent" : "inconclusive",
      weight: warm ? "strong" : "weak",
    });
  }

  if (Number.isFinite(cloud)) {
    if (sky.cloudCover === "clear" && sky.sunVisible) {
      checks.push({
        aspect: "cloud",
        observed: "clear sky, direct sun",
        recorded: `${cloud}% average cloud cover ${label}`,
        result: cloud >= 90 ? "inconsistent" : cloud <= 60 ? "consistent" : "inconclusive",
        weight: "moderate",
      });
    } else if (sky.cloudCover === "overcast") {
      checks.push({
        aspect: "cloud",
        observed: "overcast sky",
        recorded: `${cloud}% average cloud cover ${label}`,
        result: cloud <= 15 ? "inconsistent" : cloud >= 60 ? "consistent" : "inconclusive",
        weight: "moderate",
      });
    }
  }

  const against = checks.filter((c) => c.result === "inconsistent" && c.weight !== "weak");
  const support = checks.filter((c) => c.result === "consistent");
  const verdict = against.length ? "inconsistent" : support.length ? "consistent" : "inconclusive";
  const daySummary = `${describeCode(day.daily.code)}, ${Math.round(day.daily.precipitation * 10) / 10} mm`;

  let headline: string;
  if (against.length) {
    const c = against.find((x) => x.weight === "strong") ?? against[0]!;
    headline = `Records for ${ctx.location} on ${ctx.date} show ${c.recorded}; the footage shows ${c.observed}.`;
  } else if (support.length) {
    headline = `The footage matches recorded weather for ${ctx.location} on ${ctx.date} (${daySummary}).`;
  } else {
    headline = `Weather in the frames is too ambiguous to compare with records for ${ctx.date} (${daySummary}).`;
  }

  return {
    date: ctx.date,
    location: ctx.location,
    source: day.source,
    hourly: day.hourly,
    daily: day.daily,
    checks,
    verdict,
    headline,
  };
}
