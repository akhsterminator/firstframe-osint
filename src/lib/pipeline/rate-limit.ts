import { config } from "../config";

const g = globalThis as unknown as { __ffRate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__ffRate ??= new Map());

/** Sliding one-hour window per client. Returns seconds to wait, or 0 if allowed. */
export function rateLimit(client: string, now = Date.now()): number {
  const limit = config.rateLimitPerHour;
  if (limit <= 0) return 0;
  const windowStart = now - 3_600_000;
  const recent = (hits.get(client) ?? []).filter((t) => t > windowStart);
  if (recent.length >= limit) {
    hits.set(client, recent);
    return Math.ceil((recent[0]! - windowStart) / 1000);
  }
  recent.push(now);
  hits.set(client, recent);
  return 0;
}

export function clientKey(headers: Headers): string {
  return (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "local").trim();
}
