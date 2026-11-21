import { plausible } from "../util/dates";

/**
 * Several platforms build post IDs from the creation timestamp. Decoding the ID
 * gives a posting time without a network request, and that time can't be edited
 * after the fact. Each decoder returns epoch milliseconds or undefined.
 */

const TWITTER_EPOCH = 1288834974657n;
const INSTAGRAM_EPOCH = 1314220021721n;
const DISCORD_EPOCH = 1420070400000n;

function bigint(id: string): bigint | undefined {
  if (!/^\d{1,20}$/.test(id)) return undefined;
  try {
    return BigInt(id);
  } catch {
    return undefined;
  }
}

function checked(ms: bigint | number): number | undefined {
  const n = Number(ms);
  return plausible(n) ? n : undefined;
}

/** X / Twitter snowflake: 41 bits of ms since 2010-11-04, shifted 22. */
export function twitterIdTime(id: string): number | undefined {
  const n = bigint(id);
  // IDs below this predate snowflakes (sequential IDs, no timestamp).
  if (n === undefined || n < 29700859247n) return undefined;
  return checked((n >> 22n) + TWITTER_EPOCH);
}

/** TikTok: the top 32 bits of the 64-bit video ID are unix seconds. */
export function tiktokIdTime(id: string): number | undefined {
  const n = bigint(id);
  if (n === undefined || id.length < 18) return undefined;
  return checked((n >> 32n) * 1000n);
}

const IG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Instagram / Threads shortcode to numeric media ID. */
export function instagramShortcodeToId(shortcode: string): bigint | undefined {
  // Private posts append extra characters after the 11-char public code.
  const code = shortcode.length > 11 ? shortcode.slice(0, 11) : shortcode;
  let id = 0n;
  for (const ch of code) {
    const v = IG_ALPHABET.indexOf(ch);
    if (v < 0) return undefined;
    id = id * 64n + BigInt(v);
  }
  return id;
}

/** Instagram media ID: 41 bits of ms since the Instagram epoch, shifted 23. */
export function instagramIdTime(shortcodeOrId: string): number | undefined {
  const id = /^\d+$/.test(shortcodeOrId) ? bigint(shortcodeOrId) : instagramShortcodeToId(shortcodeOrId);
  if (id === undefined) return undefined;
  return checked((id >> 23n) + INSTAGRAM_EPOCH);
}

export function discordIdTime(id: string): number | undefined {
  const n = bigint(id);
  if (n === undefined) return undefined;
  return checked((n >> 22n) + DISCORD_EPOCH);
}

/** Mastodon: 48 bits of ms since unix epoch, shifted 16. */
export function mastodonIdTime(id: string): number | undefined {
  const n = bigint(id);
  if (n === undefined || id.length < 17) return undefined;
  return checked(n >> 16n);
}

const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";

/** Bluesky / AT Protocol TID: 13 base32-sortable chars, microseconds shifted 10. */
export function blueskyTidTime(tid: string): number | undefined {
  if (!/^[2-7a-z]{13}$/.test(tid)) return undefined;
  let n = 0n;
  for (const ch of tid) n = n * 32n + BigInt(TID_ALPHABET.indexOf(ch));
  const micros = n >> 10n;
  return checked(micros / 1000n);
}

export interface IdAnatomy {
  /** The ID as the platform stores it, in binary, most significant bit first. */
  bits: string;
  /** Range of `bits` (inclusive start, exclusive end) that holds the timestamp. */
  timestamp: [number, number];
  /** Plain-language recipe, e.g. "first 41 bits = milliseconds since 4 Nov 2010". */
  recipe: string;
  unit: "ms" | "s" | "µs";
}

function pad(n: bigint, width: number): string {
  return n.toString(2).padStart(width, "0").slice(-width);
}

/**
 * How the timestamp sits inside an ID, for showing the decode step by step.
 * Returns undefined for platforms whose IDs don't carry a time.
 */
export function idAnatomy(platform: string, id: string): IdAnatomy | undefined {
  try {
    switch (platform) {
      case "x": {
        const n = BigInt(id);
        return { bits: pad(n, 64), timestamp: [1, 42], recipe: "Bits 1–41 count milliseconds since 4 Nov 2010, X's own epoch. The rest identify the server and sequence.", unit: "ms" };
      }
      case "tiktok": {
        const n = BigInt(id);
        return { bits: pad(n, 64), timestamp: [0, 32], recipe: "The first 32 bits are a plain Unix timestamp in seconds. The rest are a counter and a random part.", unit: "s" };
      }
      case "instagram":
      case "threads": {
        const n = /^\d+$/.test(id) ? BigInt(id) : instagramShortcodeToId(id);
        if (n === undefined) return undefined;
        return { bits: pad(n, 64), timestamp: [0, 41], recipe: "The shortcode is base-64 for a 64-bit ID. Its first 41 bits count milliseconds since 22 Aug 2011, Instagram's epoch.", unit: "ms" };
      }
      case "mastodon": {
        const n = BigInt(id);
        return { bits: pad(n, 64), timestamp: [0, 48], recipe: "The first 48 bits are milliseconds since 1970. The last 16 make the ID unique.", unit: "ms" };
      }
      case "bluesky": {
        let n = 0n;
        for (const ch of id) n = n * 32n + BigInt(TID_ALPHABET.indexOf(ch));
        return { bits: pad(n, 64), timestamp: [1, 54], recipe: "The record key is a TID: 13 base-32 characters holding microseconds since 1970 in bits 1–53, then a clock ID.", unit: "µs" };
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
