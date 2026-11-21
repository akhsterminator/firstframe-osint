import type { ReactNode } from "react";
import { PLATFORM_LABEL } from "@/lib/card/model";
import type { Report } from "@/lib/types";
import { formatDay } from "@/lib/util/dates";
import { GeoPanel } from "./GeoPanel";
import { IntegrityPanel } from "./IntegrityPanel";
import { ProvenancePanel } from "./ProvenancePanel";
import { ScenePanel } from "./ScenePanel";
import { SunChart } from "./SunChart";
import { WeatherPanel } from "./WeatherPanel";
import { Section, TONE_BG, TONE_TEXT } from "./ui";

/** Everything in a report except the card and the stage list. */
export function ReportBody({ report, provenance }: { report: Report; provenance?: ReactNode }) {
  const s = report.stages;
  const src = report.source;
  const link = src.canonicalUrl ?? (src.platform !== "upload" ? src.input : undefined);

  return (
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
          {provenance ?? <ProvenancePanel data={s.provenance.data} />}
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
  );
}
