"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/types";
import { CardPanel } from "./CardPanel";
import { ReportBody } from "./ReportBody";
import { StageList } from "./StageList";

function useLiveReport(initial: Report): Report {
  const [report, setReport] = useState(initial);
  const finished = report.status === "done" || report.status === "failed";

  useEffect(() => {
    if (finished) return;
    let poll: ReturnType<typeof setInterval> | undefined;
    const es = new EventSource(`/api/reports/${initial.id}/events`);
    es.addEventListener("report", (e) => setReport(JSON.parse((e as MessageEvent).data) as Report));
    es.onerror = () => {
      es.close();
      poll ??= setInterval(async () => {
        const res = await fetch(`/api/reports/${initial.id}`).catch(() => undefined);
        if (res?.ok) setReport((await res.json()) as Report);
      }, 3000);
    };
    return () => {
      es.close();
      if (poll) clearInterval(poll);
    };
  }, [initial.id, finished]);

  return report;
}

function Elapsed({ report }: { report: Report }) {
  const [now, setNow] = useState(() => Date.now());
  const running = report.status === "running" || report.status === "queued";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);
  const ms = running ? now - Date.parse(report.createdAt) : (report.elapsedMs ?? 0);
  return <span className="font-mono tabular-nums">{(ms / 1000).toFixed(1)}s</span>;
}

export function ReportView({ initial, staticCardBase }: { initial: Report; staticCardBase?: string }) {
  const report = useLiveReport(initial);
  const running = report.status === "running" || report.status === "queued";
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 pt-10 lg:grid-cols-[360px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <CardPanel report={report} staticBase={staticCardBase} />
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="eyebrow">{running ? "Checking" : report.status === "failed" ? "Stopped" : "Checks"}</span>
            <span className="text-xs text-muted">
              <Elapsed report={report} />
            </span>
          </div>
          <StageList report={report} />
        </div>
      </aside>

      <ReportBody report={report} />
    </div>
  );
}
