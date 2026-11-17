import { describe, expect, it } from "vitest";
import {
  blueskyTidTime,
  instagramIdTime,
  instagramShortcodeToId,
  mastodonIdTime,
  tiktokIdTime,
  twitterIdTime,
} from "@/lib/ingest/post-id";

const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : undefined);

describe("post ID timestamps", () => {
  it("decodes X snowflakes", () => {
    expect(iso(twitterIdTime("1585841080431321088"))).toBe("2022-10-28T03:49:11.734Z");
  });

  it("ignores pre-snowflake tweet IDs", () => {
    expect(twitterIdTime("20")).toBeUndefined();
  });

  it("decodes TikTok video IDs", () => {
    expect(iso(tiktokIdTime("7106594312292453675"))).toBe("2022-06-07T20:15:27.000Z");
  });

  it("decodes Instagram shortcodes", () => {
    // The world-record egg, posted 4 January 2019.
    expect(iso(instagramIdTime("BsOGulcndj-"))?.slice(0, 10)).toBe("2019-01-04");
    expect(instagramShortcodeToId("B")).toBe(1n);
  });

  it("decodes Mastodon IDs", () => {
    expect(iso(mastodonIdTime("109372383021445123"))?.slice(0, 10)).toBe("2022-11-19");
  });

  it("decodes Bluesky TIDs", () => {
    expect(iso(blueskyTidTime("3jzfcijpj2z2a"))?.slice(0, 7)).toBe("2023-06");
    expect(blueskyTidTime("not-a-tid")).toBeUndefined();
  });

  it("rejects garbage", () => {
    expect(tiktokIdTime("123")).toBeUndefined();
    expect(twitterIdTime("abc")).toBeUndefined();
    expect(instagramIdTime("!!!")).toBeUndefined();
  });
});
