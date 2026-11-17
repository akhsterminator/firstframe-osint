import { config } from "../config";
import { domainOf, normaliseUrl, parseSourceUrl } from "../ingest/url";
import type { Confidence, DateEvidence, ProvenanceMatch, ProvenanceResult, ProviderRun, SourceInfo } from "../types";
import { pool, errorMessage } from "../util/async";
import { daysBetween, parseLooseDate, toIso } from "../util/dates";
import { shortId } from "../util/id";
import type { Hit, Provider, SearchFrame } from "./hits";
import { dateFromUrlPath, fetchPageDate, type PageDate } from "./page-date";
import { serpApiProvider } from "./providers/serpapi";
import { tineyeProvider } from "./providers/tineye";

export type { SearchFrame } from "./hits";

/** Nothing we can match was published before online video was common. */
const FLOOR = Date.UTC(2004, 0, 1);

export function defaultProviders(): Provider[] {
  return [tineyeProvider, ...config.serpApiEngines.map(serpApiProvider)];
}

/** Collapse tracking params, mobile hosts and platform URL variants into one key. */
export function matchKey(url: string): string {
  const parsed = parseSourceUrl(url);
  if (parsed && parsed.postId) return parsed.key;
  const u = normaliseUrl(url);
  if (!u) return url;
  return `${u.hostname}${u.pathname.replace(/\/+$/, "")}${u.search}`;
}

const CONFIDENCE_BY_KIND: Record<DateEvidence["kind"], Confidence> = {
  "post-id": "high",
  "page-metadata": "medium",
  "url-path": "medium",
  "index-crawl": "low",
  "search-snippet": "low",
};

/**
 * The earliest credible date wins. Every kind of evidence is either an estimate
 * of publication or an upper bound on it, so the minimum is the best estimate,
 * and its kind sets how much we trust it.
 */
export function estimateFirstSeen(evidence: DateEvidence[]): { firstSeen?: string; confidence?: Confidence } {
  const usable = evidence.filter((e) => Date.parse(e.date) >= FLOOR);
  if (!usable.length) return {};
  const best = usable.reduce((a, b) => (Date.parse(b.date) < Date.parse(a.date) ? b : a));
  let confidence = CONFIDENCE_BY_KIND[best.kind];
  // Two independent sources within two days of each other raise our trust.
  const corroborated = usable.some(
    (e) => e !== best && e.kind !== best.kind && Math.abs(daysBetween(e.date, best.date)) <= 2,
  );
  if (corroborated && confidence === "low") confidence = "medium";
  if (corroborated && confidence === "medium") confidence = "high";
  return { firstSeen: best.date, confidence };
}

export function mergeHits(hits: Hit[], source: SourceInfo): ProvenanceMatch[] {
  const sourceKey = source.canonicalUrl ? matchKey(source.canonicalUrl) : matchKey(source.input);
  const byKey = new Map<string, ProvenanceMatch>();

  for (const h of hits) {
    const key = matchKey(h.url);
    let m = byKey.get(key);
    if (!m) {
      const parsed = parseSourceUrl(h.url);
      m = {
        id: shortId(),
        url: h.url,
        domain: domainOf(h.url),
        title: h.title,
        thumbnail: h.thumbnail,
        platform: parsed?.platform ?? "web",
        providers: [],
        frameIds: [],
        exact: h.exact,
        isSource: key === sourceKey,
        evidence: [],
      };
      if (parsed?.idTime) {
        m.evidence.push({ kind: "post-id", date: toIso(parsed.idTime), detail: `Decoded from ${parsed.platform} post ID`, bound: "exact" });
      }
      const fromPath = dateFromUrlPath(h.url);
      if (fromPath) m.evidence.push({ kind: "url-path", date: toIso(fromPath.ms), detail: fromPath.source, bound: "exact" });
      byKey.set(key, m);
    }
    if (!m.providers.includes(h.provider)) m.providers.push(h.provider);
    if (!m.frameIds.includes(h.frameId)) m.frameIds.push(h.frameId);
    m.exact ||= h.exact;
    m.title ??= h.title;
    m.thumbnail ??= h.thumbnail;

    const crawl = parseLooseDate(h.crawlDate);
    if (crawl && !m.evidence.some((e) => e.kind === "index-crawl" && e.date === toIso(crawl))) {
      m.evidence.push({ kind: "index-crawl", date: toIso(crawl), detail: `${h.provider} first crawled this copy`, bound: "no-later-than" });
    }
    const snippet = parseLooseDate(h.snippetDate);
    if (snippet && !m.evidence.some((e) => e.kind === "search-snippet")) {
      m.evidence.push({ kind: "search-snippet", date: toIso(snippet), detail: `${h.provider} listed it as "${h.snippetDate}"`, bound: "exact" });
    }
  }
  return [...byKey.values()];
}

export function sortTimeline(matches: ProvenanceMatch[]): ProvenanceMatch[] {
  const rank = (m: ProvenanceMatch) => (m.firstSeen ? Date.parse(m.firstSeen) : Number.POSITIVE_INFINITY);
  return [...matches].sort((a, b) => rank(a) - rank(b) || Number(b.exact) - Number(a.exact) || b.frameIds.length - a.frameIds.length);
}

/** Earliest exact match we have reasonable confidence in. */
export function pickEarliest(matches: ProvenanceMatch[]): ProvenanceMatch | undefined {
  const dated = sortTimeline(matches).filter((m) => m.firstSeen && m.exact);
  return dated.find((m) => m.firstSeenConfidence !== "low") ?? dated[0];
}

export interface ProvenanceOptions {
  providers?: Provider[];
  fetchDate?: (url: string) => Promise<PageDate | undefined>;
}

export async function runProvenance(
  frames: SearchFrame[],
  source: SourceInfo,
  opts: ProvenanceOptions = {},
): Promise<ProvenanceResult> {
  const providers = opts.providers ?? defaultProviders();
  const fetchDate = opts.fetchDate ?? fetchPageDate;
  const runs: ProviderRun[] = [];
  const hits: Hit[] = [];

  await Promise.all(
    providers.map(async (p) => {
      const reason = frames[0] ? p.unavailable(frames[0]) : "No frames";
      if (reason) {
        runs.push({ provider: p.name, status: "skipped", results: 0, note: reason });
        return;
      }
      let count = 0;
      const errors: string[] = [];
      await pool(frames, 2, async (f) => {
        try {
          const found = await p.search(f);
          count += found.length;
          hits.push(...found);
        } catch (err) {
          errors.push(errorMessage(err));
        }
      });
      runs.push({
        provider: p.name,
        status: errors.length === frames.length ? "error" : "ok",
        results: count,
        note: errors[0],
      });
    }),
  );

  // The analysed post itself is always part of the story.
  const sourceUrl = source.canonicalUrl ?? (source.platform !== "upload" ? source.input : undefined);
  if (sourceUrl) hits.push({ url: sourceUrl, provider: "Submitted link", frameId: "source", exact: true, title: source.title });

  const matches = mergeHits(hits, source);
  const src = matches.find((m) => m.isSource);
  if (src && source.postedAt && !src.evidence.some((e) => e.kind === "post-id")) {
    src.evidence.push({ kind: "page-metadata", date: source.postedAt, detail: "Posting time reported by the platform", bound: "exact" });
  }

  // Look up publication dates for pages that don't already carry a strong one.
  const needDates = matches
    .filter((m) => !m.isSource && !m.evidence.some((e) => e.kind === "post-id" || e.kind === "page-metadata"))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.frameIds.length - a.frameIds.length)
    .slice(0, 16);
  await pool(needDates, 4, async (m) => {
    const d = await fetchDate(m.url);
    if (d) m.evidence.push({ kind: d.kind, date: toIso(d.ms), detail: d.source, bound: "exact" });
  });

  for (const m of matches) {
    const { firstSeen, confidence } = estimateFirstSeen(m.evidence);
    m.firstSeen = firstSeen;
    m.firstSeenConfidence = confidence;
  }

  const timeline = sortTimeline(matches).slice(0, 60);
  const earliest = pickEarliest(timeline);
  const anchor = src?.firstSeen ?? source.postedAt;
  const leadDays = earliest?.firstSeen && anchor ? daysBetween(earliest.firstSeen, anchor) : undefined;

  return {
    matches: timeline,
    earliest,
    providers: runs.sort((a, b) => a.provider.localeCompare(b.provider)),
    leadDays: leadDays !== undefined ? Math.round(leadDays * 10) / 10 : undefined,
  };
}
