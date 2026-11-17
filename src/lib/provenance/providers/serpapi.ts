import { config } from "../../config";
import { httpJson } from "../../util/http";
import { isEngineUrl, type Hit, type Provider, type SearchFrame } from "../hits";

type Json = Record<string, unknown>;

/**
 * SerpApi wraps Google Lens, Bing and Yandex reverse image search behind one
 * key. Result shapes differ by engine and drift over time, so after reading the
 * fields we know about we also walk the response for anything link-shaped.
 */
function collectLinks(node: unknown, out: Json[], depth = 0): void {
  if (depth > 6 || out.length > 80 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectLinks(n, out, depth + 1);
    return;
  }
  const obj = node as Json;
  const link = obj.link ?? obj.url ?? obj.host_page_url ?? obj.hostPageUrl;
  if (typeof link === "string" && /^https?:\/\//.test(link)) out.push(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === "search_metadata" || k === "search_parameters" || k === "serpapi_pagination") continue;
    if (v && typeof v === "object") collectLinks(v, out, depth + 1);
  }
}

function toHit(obj: Json, provider: string, frameId: string, exact: boolean): Hit | undefined {
  const url = (obj.link ?? obj.url ?? obj.host_page_url ?? obj.hostPageUrl) as string;
  if (isEngineUrl(url)) return undefined;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    url,
    title: str(obj.title) ?? str(obj.name),
    thumbnail: str(obj.thumbnail) ?? str(obj.thumbnail_url),
    provider,
    frameId,
    exact,
    snippetDate: str(obj.date) ?? str(obj.date_published) ?? str(obj.datePublished),
  };
}

const ENGINE_PARAMS: Record<string, (url: string) => Record<string, string>> = {
  google_lens: (url) => ({ url, type: "exact_matches" }),
  google_lens_visual: (url) => ({ url, type: "visual_matches" }),
  bing_reverse_image: (url) => ({ image_url: url }),
  yandex_images: (url) => ({ url }),
};

const LABELS: Record<string, string> = {
  google_lens: "Google Lens",
  google_lens_visual: "Google Lens (similar)",
  bing_reverse_image: "Bing",
  yandex_images: "Yandex",
};

export function serpApiProvider(engine: string): Provider {
  const name = LABELS[engine] ?? engine;
  const exact = engine !== "google_lens_visual";
  return {
    name,
    unavailable(frame) {
      if (!config.serpApiKey) return "Set SERPAPI_KEY to enable";
      if (!frame.publicUrl) return "Needs frames at a public URL (set PUBLIC_BASE_URL or use Supabase storage)";
      if (!ENGINE_PARAMS[engine]) return `Unknown engine ${engine}`;
      return undefined;
    },
    async search(frame: SearchFrame): Promise<Hit[]> {
      const params = new URLSearchParams({
        engine: engine === "google_lens_visual" ? "google_lens" : engine,
        api_key: config.serpApiKey!,
        ...ENGINE_PARAMS[engine]!(frame.publicUrl!),
      });
      const res = await httpJson<Json>(`https://serpapi.com/search.json?${params}`, { timeoutMs: 45_000 });
      if (typeof res.error === "string" && !/hasn't returned any results/i.test(res.error)) {
        throw new Error(res.error);
      }
      const objs: Json[] = [];
      collectLinks(res, objs);
      const seen = new Set<string>();
      const hits: Hit[] = [];
      for (const o of objs) {
        const h = toHit(o, name, frame.id, exact);
        if (h && !seen.has(h.url)) {
          seen.add(h.url);
          hits.push(h);
        }
      }
      return hits.slice(0, 40);
    },
  };
}
