"use client";

import { useEffect, useState } from "react";
import { PLATFORM_LABEL } from "@/lib/card/model";
import type { Report } from "@/lib/types";
import { formatDay } from "@/lib/util/dates";
import { CardPanel } from "./CardPanel";
import { GeoPanel } from "./GeoPanel";
import { IntegrityPanel } from "./IntegrityPanel";
import { ProvenancePanel } from "./ProvenancePanel";
import { ScenePanel } from "./ScenePanel";
import { StageList } from "./StageList";
import { SunChart } from "./SunChart";
import { WeatherPanel } from "./WeatherPanel";
import { Section, TONE_BG, TONE_TEXT } from "./ui";

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

export function ReportView({ initial }: { initial: Report }) {
  const report = useLiveReport(initial);
  const s = report.stages;
  const running = report.status === "running" || report.status === "queued";
  const src = report.source;
  const link = src.canonicalUrl ?? (src.platform !== "upload" ? src.input : undefined);

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 pt-10 lg:grid-cols-[360px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <CardPanel report={report} />
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

      <div className="min-w-0 space-y-14 pb-10">
        <header>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
            {report.sample && <span className="rounded-full bg-caution/15 px-2.5 py-0.5 font-mono text-[11px] text-caution">Sample · illustrative data</span>}
            <span className="font-medium text-text">{PLATFORM_LABEL[src.platform]}</span>
            {src.postedAt && <span>posted {formatDay(src.postedAt)}{src.postedAtSource === "id" ? " (from post ID)" : ""}</span>}
            {src.durationSec !== undefined && <span className="font-mono text-xs">{src.durationSec.toFixed(1)}s</span>}
            {link && (
              <a href={link} target="_blank" rel="noreferrer noopener" className="truncate font-mono text-xs text-faint hover:text-text">
                {link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} ↗
              </a>
            )}
          </div>
          {(src.title || src.caption) && (
            <blockquote className="mt-5 max-w-3xl border-l-2 border-line-strong pl-5 font-serif text-2xl leading-snug text-text/90 italic">
              “{(src.caption || src.title)!.slice(0, 280)}”
            </blockquote>
          )}
          {report.claim && (
            <p className="mt-4 text-sm text-muted">
              Testing the claim:{" "}
              <span className="text-text">
                {[report.claim.place, report.claim.date].filter(Boolean).join(", ")}
              </span>
            </p>
          )}
        </header>

        {report.status === "failed" && (
          <div className="rounded-xl border border-alert/40 bg-alert/5 px-5 py-4 text-sm">
            <p className="font-medium text-alert">This check couldn't finish.</p>
            <p className="mt-1 text-muted">{report.error}</p>
            {src.platform !== "upload" && <p className="mt-2 text-muted">Some platforms block downloads. Save the video and upload the file instead.</p>}
          </div>
        )}

        {report.findings.length > 0 && (
          <section>
            <p className="eyebrow mb-4">Findings</p>
            <ul className="space-y-px overflow-hidden rounded-xl border border-line bg-line">
              {report.findings.map((f) => (
                <li key={f.id} className="flex gap-4 bg-ink px-5 py-4">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${TONE_BG[f.tone]}`} />
                  <div>
                    <a href={`#${f.stage}`} className={`text-lg font-medium ${TONE_TEXT[f.tone]} hover:underline`}>
                      {f.title}
                    </a>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Section id="provenance" n="01" title="Earliest copy" status={s.provenance.status}>
          <ProvenancePanel data={s.provenance.data} />
        </Section>
        <Section id="geolocation" n="02" title="Where it was filmed" status={s.geolocation.status}>
          <GeoPanel data={s.geolocation.data} scene={s.scene.data} />
        </Section>
        <Section id="chronolocation" n="03" title="Time of day" status={s.chronolocation.status}>
          <SunChart data={s.chronolocation.data} />
        </Section>
        <Section id="weather" n="04" title="Weather on the day" status={s.weather.status}>
          <WeatherPanel data={s.weather.data} />
        </Section>
        <Section id="integrity" n="05" title="Tampering signals" status={s.integrity.status}>
          <IntegrityPanel data={s.integrity.data} />
        </Section>
        <Section id="scene" n="06" title="Scene reading" status={s.scene.status}>
          <ScenePanel data={s.scene.data} frames={report.frames} />
        </Section>

        <section className="rounded-xl border border-line bg-panel/60 p-6 text-sm leading-relaxed text-muted">
          <p className="eyebrow mb-2">What this report can't tell you</p>
          <p>
            FirstFrame narrows things down; it doesn't prove them. Reverse search only finds what search engines have
            indexed. Map candidates depend on OpenStreetMap being complete. Shadow and weather checks assume flat ground and
            gridded weather data. Confirm any finding with street-level imagery, the original uploader or local sources
            before you publish.
          </p>
        </section>
      </div>
    </div>
  );
}
