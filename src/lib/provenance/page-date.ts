import { parse, type HTMLElement } from "node-html-parser";
import { http, readCapped } from "../util/http";
import { parseLooseDate } from "../util/dates";
import { isPublicUrl } from "../util/net";

export interface PageDate {
  ms: number;
  source: string;
  kind: "page-metadata" | "url-path";
}

const META_KEYS = [
  "article:published_time",
  "og:published_time",
  "og:article:published_time",
  "video:release_date",
  "datepublished",
  "date",
  "pubdate",
  "publish_date",
  "publication_date",
  "parsely-pub-date",
  "sailthru.date",
  "dc.date",
  "dc.date.issued",
  "dcterms.created",
  "uploaddate",
];

const LD_KEYS = ["uploadDate", "datePublished", "dateCreated"];

function fromJsonLd(root: HTMLElement): PageDate | undefined {
  for (const node of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(node.text);
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      if (Array.isArray(cur)) {
        stack.push(...cur);
        continue;
      }
      const obj = cur as Record<string, unknown>;
      for (const k of LD_KEYS) {
        const ms = typeof obj[k] === "string" ? parseLooseDate(obj[k] as string) : undefined;
        if (ms) return { ms, source: `JSON-LD ${k}`, kind: "page-metadata" };
      }
      if (obj["@graph"]) stack.push(obj["@graph"]);
    }
  }
  return undefined;
}

function fromMeta(root: HTMLElement): PageDate | undefined {
  const metas = root.querySelectorAll("meta");
  for (const key of META_KEYS) {
    for (const m of metas) {
      const name = (m.getAttribute("property") ?? m.getAttribute("name") ?? m.getAttribute("itemprop") ?? "").toLowerCase();
      if (name !== key) continue;
      const ms = parseLooseDate(m.getAttribute("content"));
      if (ms) return { ms, source: `<meta ${name}>`, kind: "page-metadata" };
    }
  }
  return undefined;
}

function fromTimeTag(root: HTMLElement): PageDate | undefined {
  const el = root.querySelector("time[datetime]");
  const ms = parseLooseDate(el?.getAttribute("datetime"));
  return ms ? { ms, source: "<time datetime>", kind: "page-metadata" } : undefined;
}

export function dateFromUrlPath(url: string): PageDate | undefined {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  const m = path.match(/\/((?:19|20)\d{2})[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])(?:\/|-|$)/);
  if (!m) return undefined;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ms) ? { ms, source: "date in URL path", kind: "url-path" } : undefined;
}

export function extractPageDate(html: string): PageDate | undefined {
  const root = parse(html, { blockTextElements: { script: true, style: false, noscript: false, pre: false } });
  return fromJsonLd(root) ?? fromMeta(root) ?? fromTimeTag(root);
}

export async function fetchPageDate(url: string): Promise<PageDate | undefined> {
  try {
    if (!(await isPublicUrl(url))) return undefined;
    // Follow redirects by hand so each hop is checked too.
    let target = url;
    let res: Response | undefined;
    for (let hop = 0; hop < 4; hop++) {
      res = await http(target, { timeoutMs: 7_000, headers: { accept: "text/html,application/xhtml+xml" }, redirect: "manual" });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      target = new URL(next, target).toString();
      if (!(await isPublicUrl(target))) return undefined;
    }
    if (!res || res.status >= 300) return undefined;
    if (!(res.headers.get("content-type") ?? "").includes("html")) return undefined;
    return extractPageDate(await readCapped(res, 900_000));
  } catch {
    return undefined;
  }
}
