/** Base path when the static site is served from a subdirectory (GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** Absolute URL of a page on this site, for share links. */
export function siteUrl(path: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}${BASE_PATH}${path}`;
  return `${SITE_URL}${path}`;
}
