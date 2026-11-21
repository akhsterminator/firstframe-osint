import { describe, expect, it } from "vitest";
import { BOOKMARKLET, BOOKMARKLET_SOURCE } from "@/lib/ingest/bookmarklet";
import { parseSourceUrl } from "@/lib/ingest/url";

function runBookmarklet(href: string): string {
  let shown = "";
  const location = { href, hostname: new URL(href).hostname };
  const alert = (s: string) => (shown = s);
  new Function("location", "alert", BOOKMARKLET_SOURCE.replace(/\n/g, ""))(location, alert);
  return shown;
}

describe("bookmarklet", () => {
  it.each([
    "https://x.com/someone/status/1585841080431321088",
    "https://www.tiktok.com/@someone/video/7106594312292453675",
    "https://www.instagram.com/p/BsOGulcndj-/",
    "https://bsky.app/profile/someone.bsky.social/post/3jzfcijpj2z2a",
  ])("agrees with the app on %s", (url) => {
    const expected = new Date(parseSourceUrl(url)!.idTime!).toUTCString();
    expect(runBookmarklet(url)).toContain(`Posted ${expected}`);
  });

  it("says so when there's nothing to decode", () => {
    expect(runBookmarklet("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain("no post ID");
  });

  it("is a valid javascript: URL", () => {
    expect(BOOKMARKLET.startsWith("javascript:")).toBe(true);
    expect(BOOKMARKLET).not.toContain("\n");
  });
});
