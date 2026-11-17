const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const EARLIEST_PLAUSIBLE = Date.UTC(1995, 0, 1);

/** True for timestamps between 1995 and a day from now. */
export function plausible(ms: number, now = Date.now()): boolean {
  return Number.isFinite(ms) && ms >= EARLIEST_PLAUSIBLE && ms <= now + 86_400_000;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Parse the date formats that show up in page metadata and search snippets.
 * Returns undefined rather than guessing.
 */
export function parseLooseDate(input: string | undefined | null, now = Date.now()): number | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;

  // Relative: "3 days ago", "2 yr ago", "1 month ago"
  const rel = s.match(/^(\d+)\s*(second|sec|minute|min|hour|hr|day|week|wk|month|mo|year|yr)s?\.?\s+ago$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2]!.toLowerCase();
    const day = 86_400_000;
    const span =
      unit.startsWith("sec") ? 1000 :
      unit.startsWith("min") ? 60_000 :
      unit.startsWith("h") ? 3_600_000 :
      unit === "day" ? day :
      unit.startsWith("w") ? 7 * day :
      unit.startsWith("mo") || unit === "month" ? 30.44 * day :
      365.25 * day;
    const ms = now - n * span;
    return plausible(ms, now) ? ms : undefined;
  }

  // Unix seconds or milliseconds
  if (/^\d{10}$/.test(s)) {
    const ms = Number(s) * 1000;
    return plausible(ms, now) ? ms : undefined;
  }
  if (/^\d{13}$/.test(s)) {
    const ms = Number(s);
    return plausible(ms, now) ? ms : undefined;
  }

  // yt-dlp style YYYYMMDD
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const ms = Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]));
    return plausible(ms, now) ? ms : undefined;
  }

  // ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ms = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
    return plausible(ms, now) ? ms : undefined;
  }

  // "14 Mar 2019", "Mar 14, 2019", "March 14 2019"
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  const mdy = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  const parts = dmy
    ? { d: dmy[1], m: dmy[2], y: dmy[3] }
    : mdy
      ? { d: mdy[2], m: mdy[1], y: mdy[3] }
      : undefined;
  if (parts) {
    const month = MONTHS[parts.m!.toLowerCase().slice(0, parts.m!.toLowerCase().startsWith("sept") ? 4 : 3)];
    if (month !== undefined) {
      const ms = Date.UTC(Number(parts.y), month, Number(parts.d));
      return plausible(ms, now) ? ms : undefined;
    }
  }

  const fallback = Date.parse(s);
  return plausible(fallback, now) ? fallback : undefined;
}

export function daysBetween(a: string | number, b: string | number): number {
  const ta = typeof a === "number" ? a : Date.parse(a);
  const tb = typeof b === "number" ? b : Date.parse(b);
  return (tb - ta) / 86_400_000;
}

/** "3 years", "5 months", "12 days" */
export function humanSpan(days: number): string {
  const d = Math.abs(days);
  if (d >= 365) {
    const y = Math.floor(d / 365.25);
    return `${y} year${y === 1 ? "" : "s"}`;
  }
  if (d >= 60) {
    const m = Math.floor(d / 30.44);
    return `${m} months`;
  }
  const n = Math.max(1, Math.round(d));
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function isoDay(iso: string | number): string {
  return new Date(iso).toISOString().slice(0, 10);
}
