import path from "node:path";

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function int(name: string, fallback: number): number {
  const v = str(name);
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(name: string, fallback: string[]): string[] {
  const v = str(name);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : fallback;
}

/**
 * Read lazily so tests and the CLI can set env vars before first use.
 */
export const config = {
  get dataDir() {
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), str("FF_DATA_DIR") ?? ".firstframe");
  },
  get publicBaseUrl() {
    return str("PUBLIC_BASE_URL")?.replace(/\/+$/, "");
  },
  get anthropicKey() {
    return str("ANTHROPIC_API_KEY");
  },
  get visionModel() {
    return str("FF_VISION_MODEL") ?? "claude-opus-5-5";
  },
  get serpApiKey() {
    return str("SERPAPI_KEY");
  },
  get serpApiEngines() {
    return list("SERPAPI_ENGINES", ["google_lens", "bing_reverse_image", "yandex_images"]);
  },
  get tineyeKey() {
    return str("TINEYE_API_KEY");
  },
  get hiveKey() {
    return str("HIVE_API_KEY");
  },
  get sightengineUser() {
    return str("SIGHTENGINE_USER");
  },
  get sightengineSecret() {
    return str("SIGHTENGINE_SECRET");
  },
  get supabaseUrl() {
    return str("SUPABASE_URL") ?? str("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceKey() {
    return str("SUPABASE_SERVICE_ROLE_KEY");
  },
  get supabaseBucket() {
    return str("SUPABASE_BUCKET") ?? "frames";
  },
  get overpassEndpoints() {
    return list("OVERPASS_ENDPOINTS", [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]);
  },
  get nominatimUrl() {
    return str("NOMINATIM_URL") ?? "https://nominatim.openstreetmap.org";
  },
  get tileUrl() {
    return str("FF_TILE_URL") ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  },
  get ytDlp() {
    return str("YTDLP_PATH") ?? "yt-dlp";
  },
  get ytDlpCookies() {
    return str("YTDLP_COOKIES");
  },
  get ffmpeg() {
    return str("FFMPEG_PATH") ?? "ffmpeg";
  },
  get ffprobe() {
    return str("FFPROBE_PATH") ?? "ffprobe";
  },
  get c2patool() {
    return str("C2PATOOL_PATH") ?? "c2patool";
  },
  get maxFrames() {
    return int("FF_MAX_FRAMES", 8);
  },
  get searchFrames() {
    return int("FF_SEARCH_FRAMES", 3);
  },
  get maxDurationSec() {
    return int("FF_MAX_DURATION", 600);
  },
  get maxConcurrentJobs() {
    return int("FF_MAX_CONCURRENT", 2);
  },
  get rateLimitPerHour() {
    return int("FF_RATE_LIMIT", 20);
  },
  get cacheHours() {
    return int("FF_CACHE_HOURS", 24);
  },
  get userAgent() {
    return str("FF_USER_AGENT") ?? "FirstFrame/0.1 (+https://github.com/akhsterminator/firstframe-osint)";
  },
};

export type Config = typeof config;
