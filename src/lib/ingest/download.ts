import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { run } from "../util/proc";
import { parseLooseDate } from "../util/dates";
import { isPublicUrl } from "../util/net";

export interface DownloadedVideo {
  file: string;
  title?: string;
  caption?: string;
  postedAt?: number;
  canonicalUrl?: string;
  extractor?: string;
  durationSec?: number;
}

interface YtDlpInfo {
  title?: string;
  description?: string;
  timestamp?: number;
  release_timestamp?: number;
  upload_date?: string;
  webpage_url?: string;
  extractor_key?: string;
  duration?: number;
  _filename?: string;
  filename?: string;
  requested_downloads?: { filepath?: string; _filename?: string }[];
}

/**
 * Download a post's video with yt-dlp. We keep the post text (it's the claim we
 * are testing) and the posting time, and deliberately drop account details.
 */
export async function downloadWithYtDlp(url: string, workDir: string): Promise<DownloadedVideo> {
  if (!(await isPublicUrl(url))) throw new Error("That link points to a private or local address.");
  const out = path.join(workDir, "source.%(ext)s");
  const args = [
    "--no-playlist",
    "--no-progress",
    "--no-warnings",
    "--restrict-filenames",
    "--max-filesize", "250M",
    "-f", "bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b",
    "--merge-output-format", "mp4",
    "--socket-timeout", "20",
    "--retries", "2",
    "-o", out,
    "--print-json",
  ];
  if (config.ytDlpCookies) args.push("--cookies", config.ytDlpCookies);
  args.push(url);

  const { stdout } = await run(config.ytDlp, args, { timeoutMs: 180_000 });
  const line = stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
  if (!line) throw new Error("yt-dlp returned no metadata");
  const info = JSON.parse(line) as YtDlpInfo;

  const file =
    info.requested_downloads?.[0]?.filepath ??
    info._filename ??
    info.filename ??
    (await findSourceFile(workDir));
  if (!file) throw new Error("yt-dlp finished but no video file was written");

  const ts = info.timestamp ?? info.release_timestamp;
  return {
    file,
    title: info.title,
    caption: info.description?.slice(0, 2000),
    postedAt: ts ? ts * 1000 : parseLooseDate(info.upload_date),
    canonicalUrl: info.webpage_url,
    extractor: info.extractor_key,
    durationSec: info.duration,
  };
}

async function findSourceFile(dir: string): Promise<string | undefined> {
  const names = await fs.readdir(dir);
  const hit = names.find((n) => n.startsWith("source.") && !n.endsWith(".part"));
  return hit ? path.join(dir, hit) : undefined;
}

/** Follow redirects on short links (vm.tiktok.com, fb.watch) to get the post URL. */
export async function resolveShortLink(url: string): Promise<string> {
  try {
    if (!(await isPublicUrl(url))) return url;
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": config.userAgent },
    });
    return res.url || url;
  } catch {
    return url;
  }
}

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (d) => h.update(d))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}
