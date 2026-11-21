import { renderCard } from "@/lib/card/render";
import type { CardFormat } from "@/lib/card/Card";
import { loadReport } from "@/lib/server/reports";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS: CardFormat[] = ["portrait", "story", "og"];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = (FORMATS.find((f) => f === url.searchParams.get("format")) ?? "portrait") as CardFormat;
  const report = await loadReport(id);
  if (!report) return new Response("Not found", { status: 404 });

  const etag = `"${report.id}-${report.updatedAt}-${format}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });

  const store = getStore();
  const key = `cards/${report.id}/${format}-${Date.parse(report.updatedAt)}.png`;
  const finished = report.status === "done" || report.status === "failed";
  let png = finished && !report.sample ? await store.getFile(key) : undefined;
  if (!png) {
    png = await renderCard(report, format, store);
    if (finished && !report.sample) await store.putFile(key, png, "image/png").catch(() => {});
  }

  const download = url.searchParams.has("download");
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      etag,
      "cache-control": finished ? "public, max-age=3600, stale-while-revalidate=86400" : "no-store",
      ...(download ? { "content-disposition": `attachment; filename="firstframe-${report.id}-${format}.png"` } : {}),
    },
  });
}
