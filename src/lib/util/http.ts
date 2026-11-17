import { config } from "../config";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    body: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).host}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function http(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, headers, ...rest } = opts;
  const signal = rest.signal
    ? AbortSignal.any([rest.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, {
    ...rest,
    signal,
    headers: { "user-agent": config.userAgent, ...headers },
  });
  const redirect = rest.redirect === "manual" && res.status >= 300 && res.status < 400;
  if (!res.ok && !redirect) {
    const body = await res.text().catch(() => "");
    throw new HttpError(res.status, url, body);
  }
  return res;
}

export async function httpJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await http(url, { ...opts, headers: { accept: "application/json", ...opts.headers } });
  return (await res.json()) as T;
}

/** Read at most `limit` bytes of a response body as text. */
export async function readCapped(res: Response, limit: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, limit));
}

export function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}
