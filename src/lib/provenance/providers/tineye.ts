import { config } from "../../config";
import { httpJson } from "../../util/http";
import { isEngineUrl, type Hit, type Provider, type SearchFrame } from "../hits";

interface TinEyeResponse {
  results?: {
    matches?: {
      domain?: string;
      image_url?: string;
      score?: number;
      backlinks?: { url?: string; backlink?: string; crawl_date?: string }[];
    }[];
  };
}

/**
 * TinEye is the only engine here that reports when it first crawled each copy,
 * which makes it the best source for "no later than" dates.
 */
export const tineyeProvider: Provider = {
  name: "TinEye",
  unavailable: () => (config.tineyeKey ? undefined : "Set TINEYE_API_KEY to enable"),
  async search(frame: SearchFrame): Promise<Hit[]> {
    const form = new FormData();
    form.append("image_upload", new Blob([new Uint8Array(frame.image)], { type: "image/jpeg" }), `${frame.id}.jpg`);
    const qs = new URLSearchParams({ limit: "50", sort: "crawl_date", order: "asc", backlink_limit: "20" });
    const res = await httpJson<TinEyeResponse>(`https://api.tineye.com/rest/search/?${qs}`, {
      method: "POST",
      body: form,
      headers: { "x-api-key": config.tineyeKey! },
      timeoutMs: 45_000,
    });
    const hits: Hit[] = [];
    for (const m of res.results?.matches ?? []) {
      for (const b of m.backlinks ?? []) {
        const url = b.backlink ?? b.url;
        if (!url || isEngineUrl(url)) continue;
        hits.push({
          url,
          thumbnail: m.image_url,
          provider: "TinEye",
          frameId: frame.id,
          exact: true,
          crawlDate: b.crawl_date,
        });
      }
    }
    return hits;
  },
};
