import type { IntegrityResult, SignalStrength } from "@/lib/types";
import { Empty, KV } from "./ui";

const LEVEL: Record<SignalStrength, number> = { info: 1, weak: 2, moderate: 3, strong: 4 };

export function IntegrityPanel({ data }: { data?: IntegrityResult }) {
  if (!data) return <Empty>Checks Content Credentials, metadata and AI-detector scores.</Empty>;
  return (
    <div>
      <ul className="divide-y divide-line/70 rounded-xl border border-line">
        {data.signals.map((s) => {
          const color = s.direction === "suggests-manipulation" ? "bg-alert" : s.direction === "supports-authentic" ? "bg-ok" : "bg-muted";
          return (
            <li key={s.id} className="flex gap-4 px-4 py-3.5">
              <span className="mt-1 flex h-3 shrink-0 gap-[3px]" title={`${s.strength} signal`}>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-3 w-1 rounded-full ${i <= LEVEL[s.strength] ? color : "bg-line"}`} />
                ))}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="font-mono text-[11px] text-faint">{s.source}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-faint">
        No single signal here decides anything. AI detectors are trained on clean images and often misfire on recompressed
        social video; platforms strip Content Credentials on upload. Read these alongside provenance, place and time.
      </p>
      {Object.keys(data.metadata).length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-muted hover:text-text">File metadata</summary>
          <div className="mt-3 rounded-xl border border-line px-4 py-1">
            {Object.entries(data.metadata).map(([k, v]) => (
              <KV key={k} k={k} v={v} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
