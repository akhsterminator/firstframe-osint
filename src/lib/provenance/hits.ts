/** One result from one provider for one frame, before merging. */
export interface Hit {
  url: string;
  title?: string;
  thumbnail?: string;
  provider: string;
  frameId: string;
  exact: boolean;
  /** Free-text date shown next to the result, e.g. "3 years ago". */
  snippetDate?: string;
  /** Date the provider's crawler first saw the image on this page. */
  crawlDate?: string;
}

export interface SearchFrame {
  id: string;
  /** Publicly reachable URL, required by URL-based engines. */
  publicUrl?: string;
  image: Buffer;
}

export interface Provider {
  name: string;
  /** Returns a reason string if the provider can't run, else undefined. */
  unavailable(frame: SearchFrame): string | undefined;
  search(frame: SearchFrame): Promise<Hit[]>;
}

const ENGINE_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|yandex\.[a-z.]+|tineye\.com|serpapi\.com|gstatic\.com|googleusercontent\.com)$/i;

export function isEngineUrl(url: string): boolean {
  try {
    return ENGINE_HOSTS.test(new URL(url).hostname);
  } catch {
    return true;
  }
}
