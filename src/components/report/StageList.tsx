import { STAGE_LABELS, STAGE_ORDER, type Report, type StageStatus } from "@/lib/types";

function Icon({ status }: { status: StageStatus }) {
  if (status === "running") return <span className="size-2 animate-pulse-dot rounded-full bg-info" />;
  if (status === "done") return <span className="text-[13px] leading-none text-ok">✓</span>;
  if (status === "error") return <span className="text-[13px] leading-none text-alert">✕</span>;
  if (status === "skipped") return <span className="text-[13px] leading-none text-faint">–</span>;
  return <span className="size-1.5 rounded-full bg-line-strong" />;
}

function duration(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  const s = (Date.parse(end) - Date.parse(start)) / 1000;
  return s < 0.05 ? undefined : `${s.toFixed(1)}s`;
}

export function StageList({ report }: { report: Report }) {
  return (
    <ol className="space-y-0.5">
      {STAGE_ORDER.map((id, i) => {
        const s = report.stages[id];
        const note = s.status === "error" ? s.error : s.status === "skipped" ? s.note : undefined;
        return (
          <li key={id} className="group">
            <a href={`#${id}`} className="flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-raised">
              <span className="flex h-5 w-4 items-center justify-center">
                <Icon status={s.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`flex justify-between text-sm ${s.status === "pending" ? "text-faint" : s.status === "skipped" ? "text-muted" : "text-text"}`}>
                  <span>
                    <span className="mr-2 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                    {STAGE_LABELS[id]}
                  </span>
                  <span className="font-mono text-[11px] text-faint">{duration(s.startedAt, s.finishedAt)}</span>
                </span>
                {note && <span className={`mt-0.5 block text-xs ${s.status === "error" ? "text-alert/80" : "text-faint"}`}>{note}</span>}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
