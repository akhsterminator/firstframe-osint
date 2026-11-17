import { subscribe } from "@/lib/pipeline/jobs";
import { loadReport, publicReport } from "@/lib/server/reports";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-sent events: one "report" event per state change until the job ends. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const initial = await loadReport(id);
  if (!initial) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (r: Report) => {
        controller.enqueue(encoder.encode(`event: report\ndata: ${JSON.stringify(publicReport(r))}\n\n`));
        if (r.status === "done" || r.status === "failed") close();
      };
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      const unsubscribe = subscribe(id, send);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      cleanup = close;
      req.signal.addEventListener("abort", close);
      send(initial);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
