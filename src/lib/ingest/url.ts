import type { Platform } from "../types";
import {
  blueskyTidTime,
  discordIdTime,
  instagramIdTime,
  mastodonIdTime,
  tiktokIdTime,
  twitterIdTime,
} from "./post-id";

export interface ParsedSource {
  platform: Platform;
  url: string;
  /** Stable key used to cache reports: platform + post ID where possible. */
  key: string;
  postId?: string;
  /** Posting time decoded from the ID, epoch ms. */
  idTime?: number;
  /** Short links need resolving before the ID is known. */
  needsResolve?: boolean;
}

const TRACKING = /^(utm_\w+|fbclid|gclid|igsh|igshid|ref|ref_src|ref_url|is_from_webapp|sender_device|_r|_t|mibextid)$/i;

export function normaliseUrl(raw: string): URL | undefined {
  let s = raw.trim();
  if (!s) return undefined;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
  u.protocol = "https:";
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  return u;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  } catch {
    return url;
  }
}

export function parseSourceUrl(raw: string): ParsedSource | undefined {
  const u = normaliseUrl(raw);
  if (!u) return undefined;
  const host = u.hostname;
  const p = u.pathname;
  const url = u.toString();
  let m: RegExpMatchArray | null;

  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    if ((m = p.match(/\/(?:video|photo)\/(\d{15,21})/))) {
      return { platform: "tiktok", url: `https://www.tiktok.com${p}`, key: `tiktok:${m[1]}`, postId: m[1], idTime: tiktokIdTime(m[1]!) };
    }
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com" || p.startsWith("/t/")) {
      return { platform: "tiktok", url, key: `url:${url}`, needsResolve: true };
    }
    return { platform: "tiktok", url, key: `url:${url}` };
  }

  if (["x.com", "twitter.com", "fxtwitter.com", "vxtwitter.com", "fixupx.com", "nitter.net"].includes(host)) {
    if ((m = p.match(/\/status(?:es)?\/(\d{5,20})/))) {
      return { platform: "x", url: `https://x.com${p.replace(/\/(photo|video)\/\d+$/, "")}`, key: `x:${m[1]}`, postId: m[1], idTime: twitterIdTime(m[1]!) };
    }
    return { platform: "x", url, key: `url:${url}` };
  }

  if (host === "instagram.com" || host === "instagr.am") {
    if ((m = p.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/))) {
      return { platform: "instagram", url: `https://www.instagram.com/p/${m[1]}/`, key: `instagram:${m[1]}`, postId: m[1], idTime: instagramIdTime(m[1]!) };
    }
    return { platform: "instagram", url, key: `url:${url}` };
  }

  if (host === "threads.net" || host === "threads.com") {
    if ((m = p.match(/\/post\/([A-Za-z0-9_-]{5,})/))) {
      return { platform: "threads", url, key: `threads:${m[1]}`, postId: m[1], idTime: instagramIdTime(m[1]!) };
    }
    return { platform: "threads", url, key: `url:${url}` };
  }

  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") {
    const id =
      host === "youtu.be"
        ? p.slice(1).split("/")[0]
        : (p.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/)?.[1] ?? u.searchParams.get("v") ?? undefined);
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      return { platform: "youtube", url: `https://www.youtube.com/watch?v=${id}`, key: `youtube:${id}`, postId: id };
    }
    return { platform: "youtube", url, key: `url:${url}` };
  }

  if (host === "facebook.com" || host === "fb.watch" || host.endsWith(".facebook.com")) {
    const id = p.match(/\/(?:videos|reel|watch)\/(?:[^/]+\/)?(\d{6,})/)?.[1] ?? u.searchParams.get("v") ?? undefined;
    return id
      ? { platform: "facebook", url, key: `facebook:${id}`, postId: id }
      : { platform: "facebook", url, key: `url:${url}`, needsResolve: host === "fb.watch" };
  }

  if (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it" || host === "v.redd.it") {
    const id = p.match(/\/comments\/([a-z0-9]{4,10})/)?.[1] ?? (host === "redd.it" ? p.slice(1) : undefined);
    return id
      ? { platform: "reddit", url: `https://www.reddit.com/comments/${id}/`, key: `reddit:${id}`, postId: id }
      : { platform: "reddit", url, key: `url:${url}` };
  }

  if (host === "t.me" || host === "telegram.me") {
    if ((m = p.match(/^\/(?:s\/)?([A-Za-z0-9_]{4,})\/(\d+)/))) {
      return { platform: "telegram", url: `https://t.me/${m[1]}/${m[2]}`, key: `telegram:${m[1]}/${m[2]}`, postId: `${m[1]}/${m[2]}` };
    }
    return { platform: "telegram", url, key: `url:${url}` };
  }

  if (host === "bsky.app") {
    if ((m = p.match(/\/profile\/([^/]+)\/post\/([2-7a-z]{13})/))) {
      return { platform: "bluesky", url, key: `bluesky:${m[2]}`, postId: m[2], idTime: blueskyTidTime(m[2]!) };
    }
    return { platform: "bluesky", url, key: `url:${url}` };
  }

  if (host.endsWith("discordapp.com") || host.endsWith("discordapp.net")) {
    const id = p.match(/\/attachments\/\d+\/(\d{17,20})\//)?.[1];
    return { platform: "web", url, key: `url:${url}`, postId: id, idTime: id ? discordIdTime(id) : undefined };
  }

  // Mastodon and other fediverse servers: /@user/123456789012345678
  if ((m = p.match(/^\/@[A-Za-z0-9_.]+(?:@[^/]+)?\/(\d{17,19})$/))) {
    return { platform: "mastodon", url, key: `mastodon:${host}:${m[1]}`, postId: m[1], idTime: mastodonIdTime(m[1]!) };
  }

  return { platform: "web", url, key: `url:${url}` };
}

/** Classify an arbitrary page URL found by reverse search. */
export function platformOf(url: string): Platform {
  return parseSourceUrl(url)?.platform ?? "web";
}

/** Posting time decoded from a URL's post ID, if the platform encodes one. */
export function idTimeFromUrl(url: string): number | undefined {
  return parseSourceUrl(url)?.idTime;
}
