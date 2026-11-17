/** Local calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function localDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

export function localTime(iso: string | number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    typeof iso === "number" ? iso : Date.parse(iso),
  );
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fixed-offset zone for when we only know longitude. Etc/GMT signs are inverted
 * by convention: Etc/GMT-2 is two hours ahead of UTC.
 */
export function solarZone(lon: number): string {
  const h = Math.round(lon / 15);
  if (h === 0) return "UTC";
  return `Etc/GMT${h > 0 ? "-" : "+"}${Math.abs(h)}`;
}
