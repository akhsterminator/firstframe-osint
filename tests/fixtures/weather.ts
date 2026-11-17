import type { WeatherDay } from "@/lib/weather/open-meteo";

/** A wet, overcast November day in the English Midlands. */
export function wetDay(date: string): WeatherDay {
  const start = Date.parse(`${date}T00:00:00Z`) - 86_400_000;
  return {
    timezone: "Europe/London",
    utcOffsetSeconds: 0,
    source: "fixture",
    hourly: Array.from({ length: 48 }, (_, i) => ({
      t: new Date(start + i * 3_600_000).toISOString(),
      code: 63,
      precipitation: i >= 30 && i <= 40 ? 1.3 : 0,
      cloud: 98,
      snowDepth: 0,
      temp: 8,
    })),
    daily: { code: 63, precipitation: 14.3, tempMax: 9, tempMin: 5, sunrise: `${date}T07:15:00.000Z`, sunset: `${date}T16:20:00.000Z` },
  };
}
