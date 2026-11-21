"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bounds } from "@/components/report/GeoMap";
import { Pill } from "@/components/report/ui";
import type { SearchArea } from "@/lib/geo/compile";
import { COUNTRIES } from "@/lib/geo/countries";
import { EXAMPLES } from "@/lib/geo/examples";
import { geocode } from "@/lib/geo/nominatim";
import { namedFeature, PRESETS, presetFeature, type Preset } from "@/lib/geo/presets";
import { MAX_VIEW_SPAN, searchScene, type SceneSearchResult } from "@/lib/geo/search";
import { decodeScene, encodeScene, type SceneQuery } from "@/lib/geo/share";
import type { FeatureRelation, MapFeature } from "@/lib/types";
import { errorMessage } from "@/lib/util/async";
import { formatCoord } from "@/lib/util/geo";

const GeoMap = dynamic(() => import("@/components/report/GeoMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-raised" />,
});

const IDS = "abcdef";
const GROUPS = [...new Set(PRESETS.map((p) => p.group))];

type AreaChoice = { kind: "view" } | SearchArea;

function streetView(lat: number, lon: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}`;
}
function satelliteView(lat: number, lon: number) {
  return `https://www.google.com/maps/@${lat.toFixed(6)},${lon.toFixed(6)},250m/data=!3m1!1e3`;
}

export function SceneBuilder({ initial }: { initial?: SceneQuery }) {
  const [features, setFeatures] = useState<MapFeature[]>(initial?.features ?? []);
  const [relations, setRelations] = useState<FeatureRelation[]>(initial?.relations ?? []);
  const [area, setArea] = useState<AreaChoice>(initial?.area ?? { kind: "view" });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [group, setGroup] = useState(GROUPS[0]!);
  const [signText, setSignText] = useState("");
  const [place, setPlace] = useState("");
  const [bounds, setBounds] = useState<Bounds | undefined>();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<SceneSearchResult>();
  const [selected, setSelected] = useState<string>();
  const [copied, setCopied] = useState(false);

  const load = useCallback((q: SceneQuery) => {
    setFeatures(q.features);
    setRelations(q.relations);
    setArea(q.area ?? { kind: "view" });
    setTitle(q.title ?? "");
    setResult(undefined);
    setStatus("idle");
  }, []);

  useEffect(() => {
    const m = window.location.hash.match(/s=([A-Za-z0-9_-]+)/);
    const q = m ? decodeScene(m[1]!) : undefined;
    if (q?.features.length) load(q);
  }, [load]);

  function nextId(): string | undefined {
    return [...IDS].find((c) => !features.some((f) => f.id === c));
  }

  function add(f: MapFeature) {
    if (features.length >= 6) return;
    const prev = features[features.length - 1];
    setFeatures((fs) => [...fs, f]);
    if (prev) setRelations((rs) => [...rs, { from: prev.id, to: f.id, maxDistanceM: 200 }]);
  }

  function addPreset(p: Preset) {
    const id = nextId();
    if (id) add(presetFeature(p, id));
  }

  function addSign() {
    const id = nextId();
    const text = signText.trim();
    if (id && text) {
      add(namedFeature(text.slice(0, 60), id));
      setSignText("");
    }
  }

  function remove(id: string) {
    const rest = features.filter((f) => f.id !== id);
    setFeatures(rest);
    // Re-link anything that pointed at the removed feature to the first one left.
    setRelations((rs) =>
      rs
        .filter((r) => r.to !== id)
        .map((r) => (r.from === id ? { ...r, from: rest[0]?.id ?? r.from } : r))
        .filter((r) => r.from !== r.to && rest.some((f) => f.id === r.from)),
    );
  }

  function relationFor(id: string) {
    return relations.find((r) => r.to === id);
  }

  function setRelation(id: string, patch: Partial<FeatureRelation>) {
    setRelations((rs) => rs.map((r) => (r.to === id ? { ...r, ...patch } : r)));
  }

  const query = useMemo<SceneQuery>(
    () => ({ features, relations, area: area.kind === "view" ? undefined : area, title: title || undefined }),
    [features, relations, area, title],
  );

  async function findPlace() {
    if (!place.trim()) return;
    const g = await geocode(place.trim()).catch(() => undefined);
    if (!g) {
      setMessage(`Couldn't find “${place}”.`);
      return;
    }
    setArea({ ...g.area, label: g.label.split(",")[0]! });
    setMessage(undefined);
  }

  function resolveArea(): SearchArea | undefined {
    if (area.kind !== "view") return area;
    if (!bounds) return undefined;
    const span = Math.max(bounds.north - bounds.south, bounds.east - bounds.west);
    if (span > MAX_VIEW_SPAN) return undefined;
    return { kind: "bbox", value: [bounds.south, bounds.west, bounds.north, bounds.east].map((n) => n.toFixed(4)).join(","), label: "Visible map area" };
  }

  async function run() {
    const a = resolveArea();
    if (!a) {
      setStatus("error");
      setMessage("Zoom the map in to a region (about the size of a small country), or pick a country.");
      return;
    }
    setStatus("running");
    setMessage(undefined);
    setResult(undefined);
    history.replaceState(null, "", `#s=${encodeScene(query)}`);
    try {
      const r = await searchScene(features, relations, a);
      setResult(r);
      setSelected(r.candidates[0]?.id);
      setStatus("done");
      const failed = r.searches.find((s) => s.status === "error" || s.status === "timeout");
      if (failed) setMessage(failed.status === "timeout" ? "The map server timed out. Narrow the area or add a rarer feature." : failed.note);
      else if (!r.candidates.length) setMessage("Nowhere in this area fits. Widen the distances, drop a feature, or try another area.");
    } catch (err) {
      setStatus("error");
      setMessage(errorMessage(err));
    }
  }

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}#s=${encodeScene(query)}`;
    history.replaceState(null, "", url);
    try {
      if (navigator.share && /Mobi/.test(navigator.userAgent)) await navigator.share({ url, title: title || "Can you find this place?" });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {}
  }

  const search = result?.searches.at(-1);

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
      <div className="min-w-0 space-y-7">
        {!features.length && (
          <div className="lg:hidden">
            <p className="eyebrow mb-3">Start from an example</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button key={ex.title} onClick={() => load(ex)} className="rounded-xl border border-line px-4 py-3 text-left transition hover:border-line-strong hover:bg-panel">
                  <span className="block text-sm">{ex.title}</span>
                  <span className="mt-1 block font-mono text-[11px] text-faint">{ex.area?.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <section>
          <p className="eyebrow mb-3">1 · What can you see?</p>
          {features.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted">
              Add two or three things that are visible together. Rare things narrow the search fastest.
            </p>
          ) : (
            <ol className="space-y-2">
              {features.map((f, i) => {
                const rel = relationFor(f.id);
                return (
                  <li key={f.id} className="rounded-xl border border-line bg-panel px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        <span className="mr-2 font-mono text-xs text-faint">{f.id}</span>
                        {f.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <Pill>{f.rarity}</Pill>
                        <button onClick={() => remove(f.id)} aria-label={`Remove ${f.label}`} className="px-1 text-faint hover:text-alert">
                          ×
                        </button>
                      </span>
                    </div>
                    {i > 0 && rel && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        within
                        <input
                          type="number"
                          min={25}
                          max={5000}
                          step={25}
                          value={rel.maxDistanceM}
                          onChange={(e) => setRelation(f.id, { maxDistanceM: Math.max(25, Math.min(5000, Number(e.target.value) || 25)) })}
                          className="w-20 rounded-md bg-raised px-2 py-1 font-mono text-text focus:outline-none"
                        />
                        m of
                        <select
                          value={rel.from}
                          onChange={(e) => setRelation(f.id, { from: e.target.value })}
                          className="rounded-md bg-raised px-2 py-1 text-text focus:outline-none"
                        >
                          {features.slice(0, i).map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.id} · {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {features.length < 6 && (
            <div className="mt-3 rounded-xl border border-line p-3">
              <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-1">
                {GROUPS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${g === group ? "bg-text text-ink" : "text-muted hover:text-text"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.filter((p) => p.group === group).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addPreset(p)}
                    className="rounded-full border border-line px-2.5 py-1 text-xs transition hover:border-line-strong hover:bg-raised"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addSign();
                }}
              >
                <input
                  value={signText}
                  onChange={(e) => setSignText(e.target.value)}
                  placeholder="Text on a sign, e.g. a shop name"
                  className="h-9 min-w-0 flex-1 rounded-lg bg-raised px-3 text-sm placeholder:text-faint focus:outline-none"
                />
                <button className="rounded-lg border border-line px-3 text-xs hover:border-line-strong">Add</button>
              </form>
            </div>
          )}
        </section>

        <section>
          <p className="eyebrow mb-3">2 · Where should we look?</p>
          <select
            value={area.kind === "view" ? "view" : area.kind === "country" ? area.value : "custom"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "view") setArea({ kind: "view" });
              else if (v !== "custom") setArea({ kind: "country", value: v, label: COUNTRIES.find((c) => c[0] === v)?.[1] ?? v });
            }}
            className="h-10 w-full rounded-lg bg-raised px-3 text-sm focus:outline-none"
          >
            <option value="view">The area visible on the map</option>
            {area.kind !== "view" && area.kind !== "country" && <option value="custom">{area.label}</option>}
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void findPlace();
            }}
          >
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="…or a city, region or claimed place"
              className="h-9 min-w-0 flex-1 rounded-lg bg-raised px-3 text-sm placeholder:text-faint focus:outline-none"
            />
            <button className="rounded-lg border border-line px-3 text-xs hover:border-line-strong">Use</button>
          </form>
        </section>

        <section className="space-y-3">
          <button
            onClick={run}
            disabled={!features.length || status === "running"}
            className="h-12 w-full rounded-xl bg-text font-medium text-ink transition hover:bg-white disabled:opacity-40"
          >
            {status === "running" ? "Searching OpenStreetMap…" : "Find every place it fits"}
          </button>
          {message && <p className={`text-sm ${status === "error" ? "text-alert" : "text-muted"}`}>{message}</p>}
        </section>

        {result && result.candidates.length > 0 && (
          <section>
            <p className="eyebrow mb-3">
              {result.candidates.length} place{result.candidates.length === 1 ? "" : "s"} · {search?.note ? "partial matches" : "every feature fits"}
            </p>
            <ol className="max-h-[420px] divide-y divide-line/70 overflow-y-auto rounded-xl border border-line">
              {result.candidates.map((c, i) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c.id)} className={`w-full px-4 py-3 text-left transition hover:bg-raised ${selected === c.id ? "bg-raised" : ""}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        <span className="mr-2 font-mono text-xs text-faint">{i + 1}</span>
                        {c.label}
                      </span>
                      <span className={`font-mono text-xs ${c.score >= 0.99 ? "text-ok" : "text-muted"}`}>{Math.round(c.score * 100)}%</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-faint">{formatCoord(c.lat, c.lon)}</div>
                    {c.missingFeatures.length > 0 && <div className="mt-1 text-xs text-muted">missing: {c.missingFeatures.join(", ")}</div>}
                    <span className="mt-2 flex flex-wrap gap-3 text-xs">
                      <a href={streetView(c.lat, c.lon)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-info hover:underline">
                        Street View ↗
                      </a>
                      <a href={satelliteView(c.lat, c.lon)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-info hover:underline">
                        Satellite ↗
                      </a>
                      <a href={c.osmUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-info hover:underline">
                        OpenStreetMap ↗
                      </a>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {features.length > 0 && (
          <section className="space-y-3 border-t border-line pt-6">
            <p className="eyebrow">Share this hunt</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="Give it a title, e.g. “Where was this filmed?”"
              className="h-10 w-full rounded-lg bg-raised px-3 text-sm placeholder:text-faint focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={share} className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-muted">
                {copied ? "Link copied" : "Copy share link"}
              </button>
              {search && (
                <a href={search.overpassTurboUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-text">
                  Open in Overpass Turbo ↗
                </a>
              )}
            </div>
            {search && (
              <details>
                <summary className="cursor-pointer text-xs text-muted hover:text-text">Show the Overpass query</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-panel p-3 font-mono text-[11px] leading-relaxed text-muted">{search.query}</pre>
              </details>
            )}
          </section>
        )}
      </div>

      <div className="min-w-0 space-y-6 lg:sticky lg:top-20 lg:self-start">
        <div className="h-[420px] overflow-hidden rounded-2xl border border-line bg-raised lg:h-[620px]">
          <GeoMap candidates={result?.candidates ?? []} selected={selected} onSelect={setSelected} onBounds={(b) => setBounds(b)} />
        </div>
        {!features.length && (
          <div className="hidden lg:block">
            <p className="eyebrow mb-3">Or start from an example</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button key={ex.title} onClick={() => load(ex)} className="rounded-xl border border-line px-4 py-3 text-left transition hover:border-line-strong hover:bg-panel">
                  <span className="block text-sm">{ex.title}</span>
                  <span className="mt-1 block font-mono text-[11px] text-faint">{ex.area?.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
