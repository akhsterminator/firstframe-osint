import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Serves stored frames and cards for the local store. Only images, only by exact key. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  const ext = joined.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext] || joined.startsWith("tiles/")) return new Response("Not found", { status: 404 });
  const buf = await getStore().getFile(joined).catch(() => undefined);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": TYPES[ext]!, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
