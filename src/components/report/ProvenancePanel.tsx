import type { DateEvidence, ProvenanceResult } from "@/lib/types";
import { formatDay, humanSpan } from "@/lib/util/dates";
import { Empty, Pill } from "./ui";

const EVIDENCE_LABEL: Record<DateEvidence["kind"], string> = {
  "post-id": "post ID",
  "page-metadata": "page metadata",
  "url-path": "URL date",
  "index-crawl": "first crawled",
  "search-snippet": "search listing",
};

export function ProvenancePanel({ data }: { data?: ProvenanceResult }) {
  if (!data) return <Empty>Reverse image search runs on the first and sharpest frames.</Empty>;
  const dated = data.matches.filter((m) => m.firstSeen);
  const undated = data.matches.filter((m) => !m.firstSeen);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {data.providers.map((p) => (
          <span key={p.provider} title={p.note} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs">
            <span className={`size-1.5 rounded-full ${p.status === "ok" ? "bg-ok" : p.status === "error" ? "bg-alert" : "bg-line-strong"}`} />
            {p.provider}
            <span className="font-mono text-faint">{p.status === "ok" ? p.results : p.status}</span>
          </span>
        ))}
      </div>

      {dated.length === 0 ? (
        <Empty>No dated copies found. {data.providers.every((p) => p.status !== "ok") && "No reverse-search engine is configured on this instance."}</Empty>
      ) : (
        <ol className="relative ml-2 border-l border-line">
          {dated.map((m) => {
            const earliest = m.id === data.earliest?.id;
            return (
              <li key={m.id} className="relative pb-6 pl-7 last:pb-0">
                <span
                  className={`absolute top-1.5 -left-[5px] size-[9px] rounded-full ring-4 ring-ink ${
                    earliest ? "bg-alert" : m.isSource ? "bg-text" : "bg-line-strong"
                  }`}
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`font-mono text-sm ${earliest ? "text-alert" : ""}`}>{formatDay(m.firstSeen!)}</span>
                  <a href={m.url} target="_blank" rel="noreferrer noopener" className="text-sm font-medium underline-offset-4 hover:underline">
                    {m.domain}
                  </a>
                  {earliest && <Pill tone="alert">earliest</Pill>}
                  {m.isSource && <Pill>this post</Pill>}
                  {!m.exact && <Pill>similar, not exact</Pill>}
                  {m.firstSeenConfidence && <span className="font-mono text-[11px] text-faint">{m.firstSeenConfidence} confidence</span>}
                </div>
                {m.title && <p className="mt-1 line-clamp-1 text-sm text-muted">{m.title}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-faint">
                  {m.evidence.map((e, i) => (
                    <span key={i} title={e.detail}>
                      {EVIDENCE_LABEL[e.kind]} {e.bound === "no-later-than" ? "≤ " : ""}
                      {formatDay(e.date)}
                    </span>
                  ))}
                  <span>via {m.providers.join(", ")}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {data.leadDays !== undefined && data.leadDays >= 2 && (
        <p className="mt-6 text-sm text-muted">
          The earliest copy appeared <span className="text-text">{humanSpan(data.leadDays)}</span> before the post you checked.
          That usually means the clip is being recirculated, not that it was filmed recently.
        </p>
      )}

      {undated.length > 0 && (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-muted hover:text-text">{undated.length} more matches without a usable date</summary>
          <ul className="mt-3 space-y-1.5">
            {undated.slice(0, 30).map((m) => (
              <li key={m.id} className="flex gap-3 font-mono text-xs">
                <a href={m.url} target="_blank" rel="noreferrer noopener" className="truncate text-muted hover:text-text">
                  {m.url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
