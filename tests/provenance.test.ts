import { describe, expect, it } from "vitest";
import { estimateFirstSeen, matchKey, mergeHits, pickEarliest, runProvenance } from "@/lib/provenance";
import type { Hit, Provider } from "@/lib/provenance/hits";
import { dateFromUrlPath, extractPageDate } from "@/lib/provenance/page-date";
import type { SourceInfo } from "@/lib/types";

const source: SourceInfo = {
  input: "https://www.tiktok.com/@a/video/7571234567890123456",
  platform: "tiktok",
  canonicalUrl: "https://www.tiktok.com/@a/video/7571234567890123456",
  postedAt: "2025-11-13T07:41:00.000Z",
};

describe("page dates", () => {
  it("prefers JSON-LD", () => {
    const html = `<html><head>
      <meta property="article:published_time" content="2020-01-02T00:00:00Z">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"VideoObject","uploadDate":"2019-03-14T10:00:00Z"}]}</script>
    </head></html>`;
    expect(extractPageDate(html)).toMatchObject({ source: "JSON-LD uploadDate", ms: Date.parse("2019-03-14T10:00:00Z") });
  });

  it("falls back to meta tags, then <time>", () => {
    expect(extractPageDate(`<meta name="pubdate" content="2018-07-01">`)?.source).toBe("<meta pubdate>");
    expect(extractPageDate(`<p><time datetime="2017-05-05T12:00:00Z">May</time></p>`)?.source).toBe("<time datetime>");
    expect(extractPageDate(`<p>nothing here</p>`)).toBeUndefined();
  });

  it("reads dates from URL paths", () => {
    expect(dateFromUrlPath("https://news.example/2019/03/14/flood")?.ms).toBe(Date.UTC(2019, 2, 14));
    expect(dateFromUrlPath("https://news.example/2019/13/40/flood")).toBeUndefined();
  });
});

describe("dating and merging", () => {
  it("collapses URL variants of the same post", () => {
    expect(matchKey("https://twitter.com/a/status/1585841080431321088?s=20")).toBe(matchKey("https://x.com/b/status/1585841080431321088"));
  });

  it("takes the earliest credible date and corroborates", () => {
    const r = estimateFirstSeen([
      { kind: "page-metadata", date: "2019-03-14T00:00:00Z", detail: "", bound: "exact" },
      { kind: "index-crawl", date: "2019-03-15T00:00:00Z", detail: "", bound: "no-later-than" },
    ]);
    expect(r.firstSeen).toBe("2019-03-14T00:00:00Z");
    expect(r.confidence).toBe("high");
  });

  it("ignores impossible dates", () => {
    expect(estimateFirstSeen([{ kind: "page-metadata", date: "1999-01-01T00:00:00Z", detail: "", bound: "exact" }]).firstSeen).toBeUndefined();
  });

  it("marks the submitted post as the source", () => {
    const hits: Hit[] = [
      { url: source.canonicalUrl!, provider: "Google Lens", frameId: "f0", exact: true },
      { url: "https://x.com/z/status/1585841080431321088", provider: "Google Lens", frameId: "f0", exact: true },
    ];
    const merged = mergeHits(hits, source);
    expect(merged.find((m) => m.isSource)).toBeDefined();
    expect(merged.find((m) => m.platform === "x")?.evidence[0]?.kind).toBe("post-id");
  });

  it("doesn't pick visual-only matches as the earliest copy", () => {
    const merged = mergeHits(
      [
        { url: "https://a.example/2010/01/01/similar", provider: "Lens", frameId: "f0", exact: false },
        { url: "https://b.example/2018/05/05/same", provider: "Lens", frameId: "f0", exact: true },
      ],
      source,
    );
    for (const m of merged) Object.assign(m, estimateFirstSeen(m.evidence), { firstSeenConfidence: estimateFirstSeen(m.evidence).confidence });
    expect(pickEarliest(merged)?.domain).toBe("b.example");
  });
});

describe("runProvenance", () => {
  it("builds a timeline and the lead over the analysed post", async () => {
    const provider: Provider = {
      name: "Fake",
      unavailable: () => undefined,
      search: async (f) => [
        { url: "https://localnews.example/story", provider: "Fake", frameId: f.id, exact: true, crawlDate: "2021-10-10" },
        { url: "https://x.com/q/status/1447000000000000000", provider: "Fake", frameId: f.id, exact: true },
      ],
    };
    const skipped: Provider = { name: "Off", unavailable: () => "no key", search: async () => [] };
    const r = await runProvenance([{ id: "f0", image: Buffer.alloc(0) }], source, {
      providers: [provider, skipped],
      fetchDate: async (url) => (url.includes("localnews") ? { ms: Date.parse("2021-10-09T18:00:00Z"), source: "JSON-LD datePublished", kind: "page-metadata" } : undefined),
    });
    expect(r.earliest?.domain).toBe("localnews.example");
    expect(r.earliest?.firstSeenConfidence).toBe("high");
    expect(r.leadDays).toBeGreaterThan(1400);
    expect(r.providers.find((p) => p.provider === "Off")?.status).toBe("skipped");
    expect(r.matches.at(-1)?.isSource).toBe(true);
  });
});
