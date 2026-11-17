import { describe, expect, it } from "vitest";
import { normaliseUrl, parseSourceUrl } from "@/lib/ingest/url";

describe("parseSourceUrl", () => {
  it.each([
    ["https://www.tiktok.com/@someone/video/7106594312292453675?is_from_webapp=1", "tiktok", "tiktok:7106594312292453675"],
    ["https://x.com/someone/status/1585841080431321088/video/1", "x", "x:1585841080431321088"],
    ["twitter.com/someone/status/1585841080431321088?s=20", "x", "x:1585841080431321088"],
    ["https://www.instagram.com/reel/BsOGulcndj-/?igsh=abc", "instagram", "instagram:BsOGulcndj-"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "youtube:dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "youtube:dQw4w9WgXcQ"],
    ["https://t.me/somechannel/1234", "telegram", "telegram:somechannel/1234"],
    ["https://bsky.app/profile/someone.bsky.social/post/3jzfcijpj2z2a", "bluesky", "bluesky:3jzfcijpj2z2a"],
    ["https://mastodon.social/@someone/109372383021445123", "mastodon", "mastodon:mastodon.social:109372383021445123"],
    ["https://old.reddit.com/r/videos/comments/abc123/title/", "reddit", "reddit:abc123"],
  ])("%s", (input, platform, key) => {
    const p = parseSourceUrl(input)!;
    expect(p.platform).toBe(platform);
    expect(p.key).toBe(key);
  });

  it("flags short links for resolving", () => {
    expect(parseSourceUrl("https://vm.tiktok.com/ZMabc123/")?.needsResolve).toBe(true);
  });

  it("decodes posting time where the ID allows", () => {
    expect(parseSourceUrl("https://x.com/a/status/1585841080431321088")?.idTime).toBeGreaterThan(0);
    expect(parseSourceUrl("https://youtu.be/dQw4w9WgXcQ")?.idTime).toBeUndefined();
  });

  it("strips tracking parameters and mobile hosts", () => {
    expect(normaliseUrl("http://m.example.com/a?utm_source=x&id=2#frag")?.toString()).toBe("https://example.com/a?id=2");
  });

  it("rejects non-http input", () => {
    expect(parseSourceUrl("javascript:alert(1)")).toBeUndefined();
    expect(parseSourceUrl("")).toBeUndefined();
  });
});

describe("isPublicUrl", async () => {
  const { isPublicUrl, isPrivateAddress } = await import("@/lib/util/net");
  it.each(["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://10.0.0.5:8080", "http://localhost:3000", "file:///etc/passwd", "http://printer.local/"])(
    "blocks %s",
    async (u) => expect(await isPublicUrl(u)).toBe(false),
  );
  it("recognises private ranges", () => {
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("::ffff:10.1.2.3")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
