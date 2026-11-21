"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GitHubStar } from "@/components/GitHubStar";
import { ReportBody } from "@/components/report/ReportBody";
import { StageList } from "@/components/report/StageList";
import type { CardFormat } from "@/lib/card/Card";
import { chronolocate } from "@/lib/chrono/sun";
import { buildFindings, type ClaimedPlace } from "@/lib/findings";
import { runGeolocation } from "@/lib/geo";
import { geocode, type Geocoded } from "@/lib/geo/nominatim";
import { parseSourceUrl } from "@/lib/ingest/url";
import { buildIntegrity } from "@/lib/integrity";
import { emptyStages } from "@/lib/stages";
import type { Frame, Report, ReportStages, StageId } from "@/lib/types";
import { errorMessage } from "@/lib/util/async";
import { isoDay, parseLooseDate, toIso } from "@/lib/util/dates";
import { reportId } from "@/lib/util/id";
import { isValidTimeZone, solarZone } from "@/lib/util/tz";
import { analyseScene } from "@/lib/vision/scene";
import { compareWeather } from "@/lib/weather/compare";
import { fetchWeather, type WeatherDay } from "@/lib/weather/open-meteo";
import { hasC2paManifest } from "@/lib/web/c2pa";
import { renderCardInBrowser, shareOrDownload } from "@/lib/web/card";
import { browserClient, getApiKey, getModel, MODELS, setApiKey, setModel } from "@/lib/web/claude";
import { anonymiseCanvas } from "@/lib/web/faces";
import { extractFrames, toBase64, toJpeg } from "@/lib/web/frames";
import { blobReader, readMp4Metadata } from "@/lib/web/mp4";

class Skip extends Error {}

const ENGINES = [
  { name: "Google Lens", url: "https://lens.google.com/" },
  { name: "Yandex", url: "https://yandex.com/images/" },
  { name: "Bing", url: "https://www.bing.com/visualsearch" },
  { name: "TinEye", url: "https://tineye.com/" },
];

function newReport(input: string): Report {
  const now = new Date().toISOString();
  return {
    id: reportId(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: "running",
    sourceKey: "",
    source: { input, platform: "upload" },
    frames: [],
    stages: emptyStages(),
    findings: [],
  };
}

function KeyPanel({ onChange }: { onChange: (hasKey: boolean) => void }) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [model, setM] = useState(MODELS[0]!.id);
  useEffect(() => {
    const k = getApiKey();
    setSaved(!!k);
    setM(getModel());
    onChange(!!k);
  }, [onChange]);

  if (saved) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok/5 px-4 py-3 text-sm">
        <span>
          <span className="text-ok">Claude key saved in this browser.</span>{" "}
          <select
            value={model}
            onChange={(e) => {
              setM(e.target.value);
              setModel(e.target.value);
            }}
            className="ml-1 rounded bg-raised px-2 py-0.5 text-xs"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.note}
              </option>
            ))}
          </select>
        </span>
        <button
          onClick={() => {
            setApiKey(undefined);
            setSaved(false);
            onChange(false);
          }}
          className="text-xs text-muted hover:text-alert"
        >
          Forget key
        </button>
      </div>
    );
  }

  return (
    <details className="rounded-xl border border-line px-4 py-3 text-sm">
      <summary className="cursor-pointer">
        <span className="font-medium">Optional: add a Claude API key</span>
        <span className="text-muted"> to read the scene and search the map automatically</span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-relaxed text-muted">
          Without a key you still get frames, metadata, Content Credentials, reverse-search shortcuts and the card, and you can describe the
          scene yourself in <Link href="/where" className="text-info hover:underline">scene search</Link>. With a key, Claude reads the
          face-blurred frames and FirstFrame does the rest. The key is kept in this browser&rsquo;s storage and sent only to
          api.anthropic.com. A check costs roughly $0.05–$0.30 depending on the model.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!key.trim().startsWith("sk-")) return;
            setApiKey(key);
            setSaved(true);
            onChange(true);
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-lg bg-raised px-3 font-mono text-sm placeholder:text-faint focus:outline-none"
          />
          <button className="rounded-lg bg-text px-4 text-sm font-medium text-ink hover:bg-white">Save</button>
        </form>
      </div>
    </details>
  );
}

function ReverseSearch({ frames, canvases }: { frames: Frame[]; canvases: Map<string, HTMLCanvasElement> }) {
  const [copied, setCopied] = useState<string>();
  async function copy(id: string) {
    const c = canvases.get(id);
    if (!c) return;
    const png = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopied(id);
      setTimeout(() => setCopied(undefined), 1600);
    } catch {
      await shareOrDownload(png, `frame-${id}.png`);
    }
  }
  if (!frames.length) return <p className="text-sm text-muted">Frames appear here once they&rsquo;re extracted.</p>;
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-[15px] leading-relaxed">
        Copy a frame, open a search engine, and paste (Ctrl/⌘ + V). Start with the first frame: re-edited copies usually keep the opening
        shot. Then paste the links of every copy you find into{" "}
        <Link href="/when" className="text-info hover:underline">When</Link> to see which came first.
      </p>
      <div className="flex flex-wrap gap-2">
        {ENGINES.map((e) => (
          <a key={e.name} href={e.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3.5 py-1.5 text-xs hover:border-line-strong">
            {e.name} ↗
          </a>
        ))}
      </div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {frames.map((f) => (
          <figure key={f.id} className="w-48 shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={`Frame ${f.index}`} className="aspect-video w-full rounded-md object-cover ring-1 ring-line" />
            <figcaption className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-faint">
              <span>
                #{f.index} · {f.t.toFixed(1)}s
              </span>
              <button onClick={() => copy(f.id)} className="rounded border border-line px-2 py-0.5 text-text hover:border-line-strong">
                {copied === f.id ? "Copied" : "Copy"}
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function BrowserVerify() {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [claimPlace, setClaimPlace] = useState("");
  const [claimDate, setClaimDate] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [report, setReport] = useState<Report>();
  const [progress, setProgress] = useState(0);
  const [card, setCard] = useState<string>();
  const [cardBusy, setCardBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvases = useRef(new Map<string, HTMLCanvasElement>());
  const ref = useRef<Report | undefined>(undefined);

  const running = report?.status === "running";
  const commit = () => ref.current && setReport({ ...ref.current, updatedAt: new Date().toISOString() });

  async function stage<K extends StageId>(id: K, fn: () => Promise<NonNullable<ReportStages[K]["data"]>>): Promise<ReportStages[K]["data"]> {
    const s = ref.current!.stages[id];
    s.status = "running";
    s.startedAt = new Date().toISOString();
    commit();
    try {
      s.data = await fn();
      s.status = "done";
      return s.data;
    } catch (err) {
      if (err instanceof Skip) {
        s.status = "skipped";
        s.note = err.message;
      } else {
        s.status = "error";
        s.error = errorMessage(err);
      }
      return undefined;
    } finally {
      s.finishedAt = new Date().toISOString();
      commit();
    }
  }

  async function renderCard(format: CardFormat): Promise<Blob | undefined> {
    const r = ref.current;
    if (!r) return undefined;
    const hero = r.frames.find((f) => f.id === r.heroFrameId) ?? r.frames[0];
    const canvas = hero ? canvases.current.get(hero.id) : undefined;
    return renderCardInBrowser(r, format, canvas?.toDataURL("image/jpeg", 0.85), `${window.location.host}${window.location.pathname.replace(/\/$/, "")}`, true);
  }

  async function run() {
    if (!file) return;
    const started = Date.now();
    setCard(undefined);
    canvases.current.clear();
    const r = newReport(link.trim() || file.name);
    r.claim = claimPlace || claimDate ? { place: claimPlace || undefined, date: claimDate || undefined } : undefined;
    ref.current = r;
    commit();

    let meta: Awaited<ReturnType<typeof readMp4Metadata>> | undefined;
    let c2pa = false;
    const frameData = new Map<string, string>();

    try {
      await stage("ingest", async () => {
        meta = await readMp4Metadata(blobReader(file), file.size).catch(() => undefined);
        c2pa = (await hasC2paManifest(file).catch(() => false)) || !!meta?.c2paBox;
        const parsed = link.trim() ? parseSourceUrl(link.trim()) : undefined;
        r.source = {
          input: link.trim() || file.name,
          platform: parsed?.platform ?? "upload",
          canonicalUrl: parsed?.url,
          postId: parsed?.postId,
          gps: meta?.gps,
          ...(parsed?.idTime
            ? { postedAt: toIso(parsed.idTime), postedAtSource: "id" as const }
            : meta?.createdAt
              ? { postedAt: meta.createdAt, postedAtSource: "file" as const }
              : {}),
        };
        return r.source;
      });

      const kf = await stage("keyframes", async () => {
        const { frames, duration, width, height } = await extractFrames(file, setProgress);
        r.source.durationSec = Math.round(duration * 10) / 10;
        r.source.width = width;
        r.source.height = height;
        const out: Frame[] = [];
        for (const [i, f] of frames.entries()) {
          let faces: number;
          try {
            faces = await anonymiseCanvas(f.image);
          } catch (err) {
            throw new Error(`The face detector couldn't run (${errorMessage(err)}), so frames were not processed. Try another browser.`);
          }
          const jpeg = await toJpeg(f.image);
          const id = `f${i}`;
          canvases.current.set(id, f.image);
          frameData.set(id, await toBase64(jpeg));
          out.push({ id, index: i, t: Math.round(f.t * 100) / 100, key: id, url: URL.createObjectURL(jpeg), width: f.image.width, height: f.image.height, facesBlurred: faces, dhash: f.dhash, sharpness: Math.round(f.sharpness) });
        }
        r.frames = out;
        const sharpest = [...out].sort((a, b) => b.sharpness - a.sharpness)[0]!;
        r.heroFrameId = out[0]!.sharpness >= sharpest.sharpness * 0.5 ? out[0]!.id : sharpest.id;
        return { count: out.length, candidates: frames.length };
      });
      if (!kf) throw new Error(r.stages.keyframes.error ?? "Couldn't extract frames");

      await stage("provenance", async () => {
        const src = r.source;
        return {
          providers: [{ provider: "Reverse search", status: "skipped", results: 0, note: "Use the shortcuts below; engines don't accept uploads from other sites" }],
          matches: src.canonicalUrl && src.postedAt && src.postedAtSource === "id"
            ? [{
                id: "src", url: src.canonicalUrl, domain: new URL(src.canonicalUrl).hostname.replace(/^www\./, ""), platform: src.platform,
                providers: ["Submitted link"], frameIds: [], exact: true, isSource: true,
                evidence: [{ kind: "post-id" as const, date: src.postedAt, detail: `Decoded from ${src.platform} post ID`, bound: "exact" as const }],
                firstSeen: src.postedAt, firstSeenConfidence: "high" as const,
              }]
            : [],
        };
      });

      let claim: Geocoded | undefined;
      if (claimPlace) claim = await geocode(claimPlace).catch(() => undefined);

      const key = getApiKey();
      const scene = await stage("scene", async () => {
        if (!key) throw new Skip("Add a Claude key above, or describe the scene yourself in scene search");
        const client = await browserClient(key);
        return analyseScene(
          {
            platform: r.source.platform,
            claimPlace: claimPlace || undefined,
            claimDate: claimDate || undefined,
            frames: r.frames.map((f) => ({ index: f.index, t: f.t, base64: frameData.get(f.id)! })),
          },
          client,
          getModel(),
        );
      });

      const geo = await stage("geolocation", async () => {
        if (!scene) throw new Skip("Needs the scene reading");
        return runGeolocation({ scene, claimPlace: claimPlace || undefined, gps: r.source.gps }, { geocode: async () => claim });
      });

      const point = geo?.point;
      const claimed = parseLooseDate(claimDate);
      const when = claimed
        ? { date: isoDay(claimed), basis: "claim" as const }
        : r.source.postedAt
          ? { date: isoDay(r.source.postedAt), basis: r.source.postedAtSource === "file" ? ("file" as const) : ("post" as const) }
          : undefined;
      let day: WeatherDay | undefined;
      if (point && when) day = await fetchWeather(point.lat, point.lon, when.date).catch(() => undefined);
      const tz = day && isValidTimeZone(day.timezone) ? day.timezone : point ? solarZone(point.lon) : "UTC";

      const sun = await stage("chronolocation", async () => {
        if (!scene) throw new Skip("Needs the scene reading");
        if (!point) throw new Skip("Needs a location");
        if (!when) throw new Skip("No date to test: add a claimed date or the post link");
        return chronolocate({ lat: point.lat, lon: point.lon, date: when.date, dateBasis: when.basis, timeZone: tz, sky: scene.sky });
      });

      await stage("weather", async () => {
        if (!scene) throw new Skip("Needs the scene reading");
        if (!point) throw new Skip("Needs a location");
        if (!when) throw new Skip("No date to test: add a claimed date or the post link");
        if (!day) throw new Error("Weather records unavailable for this date and place");
        return compareWeather(day, scene.sky, { date: when.date, location: point.label.split(",")[0]!, windows: sun?.windows ?? [] });
      });

      await stage("integrity", async () =>
        buildIntegrity({
          metadata: { ...(meta?.fields ?? {}), video: `${r.source.width}×${r.source.height}` },
          c2pa: { present: c2pa, parsed: false },
          detectors: [],
          scene,
          fromPlatform: !!link.trim(),
        }),
      );

      const claimedPlace: ClaimedPlace | undefined = claim
        ? { lat: claim.lat, lon: claim.lon, label: claim.label, bbox: claim.area.kind === "bbox" ? (claim.area.value.split(",").map(Number) as [number, number, number, number]) : undefined }
        : undefined;
      r.findings = buildFindings(r, claimedPlace);
      r.status = "done";
    } catch (err) {
      r.status = "failed";
      r.error = errorMessage(err);
    } finally {
      r.elapsedMs = Date.now() - started;
      commit();
    }

    if (r.status === "done") {
      try {
        const png = await renderCard("portrait");
        if (png) setCard(URL.createObjectURL(png));
      } catch {
        /* card is optional */
      }
    }
  }

  async function exportCard(format: CardFormat) {
    setCardBusy(true);
    try {
      const png = await renderCard(format);
      if (png) await shareOrDownload(png, `firstframe-${format}.png`, "Checked with FirstFrame");
    } finally {
      setCardBusy(false);
    }
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-info bg-info/5" : file ? "border-ok/40 bg-ok/5" : "border-line-strong hover:border-muted"
          }`}
        >
          <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          {file ? (
            <>
              <span className="font-mono text-sm">{file.name}</span>
              <span className="text-xs text-muted">{(file.size / 1e6).toFixed(1)} MB · click to change</span>
            </>
          ) : (
            <>
              <span className="font-serif text-3xl">Drop the video here</span>
              <span className="max-w-md text-sm text-muted">
                It never leaves your device. Frames, faces, metadata and the card are all processed in this tab.
              </span>
            </>
          )}
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link to the post (optional)"
            className="h-11 rounded-lg bg-raised px-3 text-sm placeholder:text-faint focus:outline-none sm:col-span-3"
          />
          <input
            value={claimPlace}
            onChange={(e) => setClaimPlace(e.target.value)}
            placeholder="Claimed place (optional)"
            className="h-11 rounded-lg bg-raised px-3 text-sm placeholder:text-faint focus:outline-none sm:col-span-2"
          />
          <input
            type="date"
            value={claimDate}
            onChange={(e) => setClaimDate(e.target.value)}
            aria-label="Claimed date"
            className="h-11 rounded-lg bg-raised px-3 text-sm focus:outline-none"
          />
        </div>

        <KeyPanel onChange={setHasKey} />

        <button onClick={run} disabled={!file} className="h-12 w-full rounded-xl bg-text font-medium text-ink transition hover:bg-white disabled:opacity-40">
          {hasKey ? "Verify: full check" : "Verify"}
        </button>
        <p className="text-center text-xs text-faint">
          Got only a link? Save the video first (most apps have a save or download option), or run your own server, which fetches links
          itself.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[360px_1fr]">
      <aside className="min-w-0 space-y-6 lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-lg ring-1 ring-white/5">
          {card ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card} alt="Verification card" className="w-full" />
          ) : (
            <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 overflow-hidden bg-raised text-center">
              <div className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-info/10 to-transparent" />
              <span className="eyebrow">{running ? `Working · ${Math.round(progress * 100)}% of frames` : report.status === "failed" ? "Stopped" : "Rendering card"}</span>
            </div>
          )}
        </div>
        {card && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["portrait", "story", "og"] as const).map((f) => (
                <button key={f} disabled={cardBusy} onClick={() => exportCard(f)} className="rounded-lg border border-line py-2 text-xs hover:border-line-strong hover:bg-raised disabled:opacity-50">
                  {f === "portrait" ? "Post" : f === "story" ? "Story" : "Link"}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-xs text-muted">
              <span>Useful? A star helps other people find it.</span>
              <GitHubStar />
            </div>
          </div>
        )}
        <StageList report={report} />
        {!running && (
          <button onClick={() => setReport(undefined)} className="w-full rounded-lg border border-line py-2 text-sm hover:border-line-strong">
            Check another video
          </button>
        )}
      </aside>
      <ReportBody report={report} provenance={<ReverseSearch frames={report.frames} canvases={canvases.current} />} />
    </div>
  );
}
