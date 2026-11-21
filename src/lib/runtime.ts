/**
 * Settings shared by the server, the CLI and the browser build. Nothing here may
 * import Node built-ins: these modules ship to the browser on the static site.
 */

export const isBrowser = typeof window !== "undefined";

export function env(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const DEFAULT_VISION_MODEL = "claude-opus-5-5";

export const DEFAULT_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export const settings = {
  get overpassEndpoints(): string[] {
    const v = env("OVERPASS_ENDPOINTS");
    return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_OVERPASS;
  },
  get nominatimUrl(): string {
    return env("NOMINATIM_URL") ?? "https://nominatim.openstreetmap.org";
  },
  get userAgent(): string {
    return env("FF_USER_AGENT") ?? "FirstFrame/0.2 (+https://github.com/akhsterminator/firstframe-osint)";
  },
  get visionModel(): string {
    return env("FF_VISION_MODEL") ?? DEFAULT_VISION_MODEL;
  },
};
