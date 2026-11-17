import { httpJson } from "../util/http";
import { daysBetween } from "../util/dates";

export interface WeatherDay {
  timezone: string;
  utcOffsetSeconds: number;
  source: string;
  hourly: { t: string; code: number; precipitation: number; cloud: number; snowDepth: number; temp: number }[];
  daily: { code: number; precipitation: number; tempMax: number; tempMin: number; sunrise?: string; sunset?: string };
}

interface OpenMeteoResponse {
  timezone: string;
  utc_offset_seconds: number;
  hourly: Record<string, (number | null)[]> & { time: string[] };
  daily: Record<string, (number | string | null)[]> & { time: string[] };
}

const HOURLY = ["weather_code", "precipitation", "cloud_cover", "snow_depth", "temperature_2m"];
const DAILY = ["weather_code", "precipitation_sum", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset"];

/** Convert Open-Meteo's offset-less local timestamps to UTC ISO strings. */
function toUtc(local: string, offsetSeconds: number): string {
  return new Date(Date.parse(`${local}:00Z`) - offsetSeconds * 1000).toISOString();
}

/**
 * Historical weather for one local day plus the evening before, so "wet ground
 * after overnight rain" can be judged. Recent dates use the forecast API because
 * the archive lags by several days.
 */
export async function fetchWeather(lat: number, lon: number, date: string): Promise<WeatherDay> {
  const recent = daysBetween(`${date}T00:00:00Z`, Date.now()) < 7;
  const host = recent ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: prev,
    end_date: date,
    hourly: HOURLY.join(","),
    daily: DAILY.join(","),
    timezone: "auto",
  });
  const r = await httpJson<OpenMeteoResponse>(`${host}?${qs}`, { timeoutMs: 15_000 });
  const off = r.utc_offset_seconds;
  const hourly = r.hourly.time.map((t, i) => ({
    t: toUtc(t, off),
    code: r.hourly.weather_code?.[i] ?? -1,
    precipitation: r.hourly.precipitation?.[i] ?? 0,
    cloud: r.hourly.cloud_cover?.[i] ?? -1,
    snowDepth: r.hourly.snow_depth?.[i] ?? 0,
    temp: r.hourly.temperature_2m?.[i] ?? Number.NaN,
  }));
  const d = r.daily.time.indexOf(date);
  const at = <T>(k: string) => (d >= 0 ? (r.daily[k]?.[d] as T | null) : null);
  return {
    timezone: r.timezone,
    utcOffsetSeconds: off,
    source: recent ? "Open-Meteo forecast archive" : "Open-Meteo historical (ERA5 reanalysis)",
    hourly,
    daily: {
      code: at<number>("weather_code") ?? -1,
      precipitation: at<number>("precipitation_sum") ?? 0,
      tempMax: at<number>("temperature_2m_max") ?? Number.NaN,
      tempMin: at<number>("temperature_2m_min") ?? Number.NaN,
      sunrise: at<string>("sunrise") ? toUtc(at<string>("sunrise")!, off) : undefined,
      sunset: at<string>("sunset") ? toUtc(at<string>("sunset")!, off) : undefined,
    },
  };
}

const WMO: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "freezing fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "rain showers", 82: "violent rain showers",
  85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail",
};

export function describeCode(code: number): string {
  return WMO[code] ?? "unknown conditions";
}
