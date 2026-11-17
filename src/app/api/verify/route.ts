import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { parseSourceUrl } from "@/lib/ingest/url";
import { enqueue, newReport } from "@/lib/pipeline/jobs";
import { clientKey, rateLimit } from "@/lib/pipeline/rate-limit";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD = 150 * 1024 * 1024;

const Body = z.object({
  url: z.string().trim().min(4).max(2048),
  claimPlace: z.string().trim().max(120).optional(),
  claimDate: z.string().trim().max(40).optional(),
});

function error(status: number, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(req: Request) {
  const wait = rateLimit(clientKey(req.headers));
  if (wait) return error(429, `Too many checks from this address. Try again in ${Math.ceil(wait / 60)} min.`, { "retry-after": String(wait) });

  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) return fromUpload(req);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return error(400, "Paste a link to a post with a video.");
  const { url, claimPlace, claimDate } = parsed.data;
  const source = parseSourceUrl(url);
  if (!source) return error(400, "That doesn't look like a link.");

  const claim = { place: claimPlace || undefined, date: claimDate || undefined };
  const hasClaim = !!(claim.place || claim.date);
  if (!hasClaim) {
    const existing = await getStore().findBySourceKey(source.key, config.cacheHours).catch(() => undefined);
    if (existing) return NextResponse.json({ id: existing.id, cached: true });
  }

  const report = newReport({ input: url, platform: source.platform, canonicalUrl: source.url, postId: source.postId }, source.key, claim);
  await enqueue(report, { kind: "url", url: source.url });
  return NextResponse.json({ id: report.id }, { status: 202 });
}

async function fromUpload(req: Request) {
  const form = await req.formData().catch(() => undefined);
  const file = form?.get("file");
  if (!(file instanceof File)) return error(400, "No file received.");
  if (file.size > MAX_UPLOAD) return error(413, "Files up to 150 MB, please.");
  if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name)) return error(415, "That file isn't a video.");

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  const claim = {
    place: String(form?.get("claimPlace") ?? "").trim().slice(0, 120) || undefined,
    date: String(form?.get("claimDate") ?? "").trim().slice(0, 40) || undefined,
  };
  const name = file.name.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const report = newReport({ input: name, platform: "upload" }, `file:${hash}`, claim);
  const dest = path.join(config.dataDir, "uploads", `${report.id}${path.extname(name) || ".mp4"}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  await enqueue(report, { kind: "file", path: dest, name });
  return NextResponse.json({ id: report.id }, { status: 202 });
}
