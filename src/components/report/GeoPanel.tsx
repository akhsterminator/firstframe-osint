"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { GeolocationResult, SceneAnalysis } from "@/lib/types";
import { formatCoord } from "@/lib/util/geo";
import { Empty, Pill } from "./ui";

const GeoMap = dynamic(() => import("./GeoMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-raised" />,
});

export function GeoPanel({ data, scene }: { data?: GeolocationResult; scene?: SceneAnalysis }) {
  const [selected, setSelected] = useState<string | undefined>(data?.candidates[0]?.id);
  const [queryIdx, setQueryIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!data && !scene) return <Empty>The map search runs once the scene has been read.</Empty>;
  const searches = data?.searches ?? [];
  const search = searches[queryIdx];

  return (
    <div className="space-y-8">
      {data && data.candidates.length > 0 ? (
        <div className="grid overflow-hidden rounded-xl border border-line lg:grid-cols-[1fr_300px]">
          <div className="h-[380px] bg-raised">
            <GeoMap candidates={data.candidates} selected={selected} onSelect={setSelected} />
          </div>
          <ol className="max-h-[380px] divide-y divide-line/70 overflow-y-auto border-t border-line lg:border-t-0 lg:border-l">
            {data.candidates.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-raised ${selected === c.id ? "bg-raised" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      <span className="mr-2 font-mono text-xs text-faint">{i + 1}</span>
                      {c.label}
                    </span>
                    <span className={`font-mono text-xs ${c.score >= 0.99 ? "text-ok" : "text-muted"}`}>{Math.round(c.score * 100)}%</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-faint">{formatCoord(c.lat, c.lon)}</div>
                  {c.missingFeatures.length > 0 && <div className="mt-1 text-xs text-muted">missing: {c.missingFeatures.join(", ")}</div>}
                  <a href={c.osmUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs text-info hover:underline" onClick={(e) => e.stopPropagation()}>
                    Open in OpenStreetMap ↗
                  </a>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Empty>
          {data?.searches.length
            ? "No place matched the features together. The query below is a good starting point for a manual search."
            : "There weren't enough distinctive, mappable features in view to search for."}
        </Empty>
      )}

      {scene && scene.features.length > 0 && (
        <div>
          <p className="eyebrow mb-3">What we searched for</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {scene.features.map((f) => (
              <div key={f.id} className="rounded-lg border border-line px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm">{f.label}</span>
                  <Pill>{f.rarity}</Pill>
                </div>
                <div className="mt-1.5 font-mono text-[11px] leading-relaxed text-faint">
                  {f.tagSets.map((set) => set.map((t) => (t.value === null ? t.key : `${t.key}=${t.value}`)).join(" + ")).join("  |  ")}
                  {f.name && `  name~"${f.name}"`}
                </div>
              </div>
            ))}
          </div>
          {scene.relations.length > 0 && (
            <p className="mt-3 font-mono text-[11px] text-faint">
              {scene.relations.map((r) => `${r.from}↔${r.to} ≤${r.maxDistanceM} m`).join("   ")}
            </p>
          )}
        </div>
      )}

      {search && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {searches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setQueryIdx(i)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${i === queryIdx ? "border-text text-text" : "border-line text-muted hover:text-text"}`}
                >
                  {s.region}
                  {s.note ? " (relaxed)" : ""}
                  <span className="ml-1.5 font-mono text-faint">{s.status === "ok" ? s.elements : s.status}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(search.query);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-full border border-line px-3 py-1 hover:border-line-strong"
              >
                {copied ? "Copied" : "Copy query"}
              </button>
              <a href={search.overpassTurboUrl} target="_blank" rel="noreferrer" className="rounded-full bg-text px-3 py-1 font-medium text-ink hover:bg-white">
                Run in Overpass Turbo ↗
              </a>
            </div>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl border border-line bg-panel p-4 font-mono text-[12px] leading-relaxed text-muted">{search.query}</pre>
        </div>
      )}

      {scene && scene.regions.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Region hypotheses</p>
          <ul className="space-y-2">
            {scene.regions.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 font-mono text-xs text-faint">
                  {r.subdivisionCode ?? r.countryCode} · {r.confidence}
                </span>
                <span>
                  <span className="font-medium">{r.name}.</span> <span className="text-muted">{r.reasoning}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
