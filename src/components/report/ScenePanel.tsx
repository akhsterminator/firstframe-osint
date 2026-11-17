import type { Frame, SceneAnalysis } from "@/lib/types";
import { Empty, Pill } from "./ui";

export function FramesStrip({ frames }: { frames: Frame[] }) {
  if (!frames.length) return null;
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
      {frames.map((f) => (
        <figure key={f.id} className="w-44 shrink-0 snap-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={`Frame ${f.index}`} className="aspect-video w-full rounded-md object-cover ring-1 ring-line" loading="lazy" />
          <figcaption className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
            <span>#{f.index} · {f.t.toFixed(1)}s</span>
            {f.facesBlurred > 0 && <span>{f.facesBlurred} blurred</span>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ScenePanel({ data, frames }: { data?: SceneAnalysis; frames: Frame[] }) {
  return (
    <div className="space-y-6">
      <FramesStrip frames={frames} />
      {!data ? (
        <Empty>The scene reading lists every visible clue, with the frame it came from.</Empty>
      ) : (
        <>
          <p className="max-w-2xl text-[15px] leading-relaxed">{data.summary}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.clues.map((c, i) => (
              <li key={i} className="rounded-lg border border-line px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow">{c.kind}</span>
                  <span className="font-mono text-[10px] text-faint">frame {c.frameIndex} · {c.confidence}</span>
                </div>
                <p className="mt-1.5 text-sm">{c.description}</p>
                {c.text && <p className="mt-1 font-mono text-xs text-info">“{c.text}”{c.language ? ` · ${c.language}` : ""}</p>}
              </li>
            ))}
          </ul>
          {data.anomalies.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Possible visual anomalies</p>
              <ul className="space-y-1.5 text-sm">
                {data.anomalies.map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <Pill tone={a.severity === "strong" ? "alert" : a.severity === "notable" ? "caution" : "neutral"}>{a.severity}</Pill>
                    <span className="text-muted">{a.observation} (frame {a.frameIndex})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="font-mono text-[11px] text-faint">Read by {data.model}. Faces were blurred before the frames were sent.</p>
        </>
      )}
    </div>
  );
}
