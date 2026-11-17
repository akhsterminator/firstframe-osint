import { describe, expect, it } from "vitest";
import type { SkyReading } from "@/lib/types";
import { compareWeather } from "@/lib/weather/compare";
import type { WeatherDay } from "@/lib/weather/open-meteo";

function day(precip: number, cloud: number, extra: Partial<WeatherDay["daily"]> = {}): WeatherDay {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    t: new Date(Date.UTC(2024, 2, 13, i)).toISOString(),
    code: precip ? 63 : 0,
    precipitation: i >= 24 && i >= 31 && i <= 40 ? precip : 0,
    cloud,
    snowDepth: 0,
    temp: 9,
  }));
  return {
    timezone: "Europe/London",
    utcOffsetSeconds: 0,
    source: "test",
    hourly,
    daily: { code: precip ? 63 : 0, precipitation: precip * 10, tempMax: 12, tempMin: 4, sunrise: "2024-03-14T06:10:00.000Z", sunset: "2024-03-14T18:05:00.000Z", ...extra },
  };
}

const sunny: SkyReading = {
  sunVisible: true, shadowsVisible: true, shadowRatio: 1, shadowRatioConfidence: "medium", shadowNotes: null,
  precipitation: "none", ground: "dry", cloudCover: "clear", daylight: "day", foliage: "bare",
};

describe("weather comparison", () => {
  it("flags sunny footage on a wet, overcast day", () => {
    const r = compareWeather(day(1.4, 100), sunny, { date: "2024-03-14", location: "Leeds", windows: [] });
    expect(r.verdict).toBe("inconsistent");
    expect(r.headline).toContain("Leeds");
  });

  it("accepts sunny footage on a dry day", () => {
    const r = compareWeather(day(0, 20), sunny, { date: "2024-03-14", location: "Leeds", windows: [] });
    expect(r.verdict).toBe("consistent");
  });

  it("flags snow on the ground on a warm, snowless day", () => {
    const r = compareWeather(day(0, 20, { tempMax: 18 }), { ...sunny, ground: "snow" }, { date: "2024-03-14", location: "Leeds", windows: [] });
    expect(r.checks.find((c) => c.aspect === "snow")?.result).toBe("inconsistent");
    expect(r.verdict).toBe("inconsistent");
  });

  it("doesn't call wet ground without rain a contradiction", () => {
    const r = compareWeather(day(0, 50), { ...sunny, sunVisible: false, cloudCover: "partly", ground: "wet" }, { date: "2024-03-14", location: "Leeds", windows: [] });
    expect(r.verdict).toBe("inconclusive");
  });
});
