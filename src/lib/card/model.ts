import type { FindingTone, Platform, Report } from "../types";
import { formatDay, humanSpan } from "../util/dates";
import { formatCoord } from "../util/geo";
import { localTime } from "../util/tz";

export type Tone = FindingTone;

export interface Fact {
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
}

export interface CardModel {
  id: string;
  sample: boolean;
  platform: string;
  posted?: string;
  headline: string;
  detail: string;
  tone: Tone;
  /** Further alert-level findings, shown as one-liners under the headline. */
  also: { title: string; tone: Tone }[];
  heroFrameId?: string;
  heroCaption?: string;
  firstSeen?: Fact & { timeline: { at: number; earliest: boolean; source: boolean }[] };
  where?: Fact & { lat?: number; lon?: number };
  when?: Fact;
  weather?: Fact;
  signals: { label: string; tone: Tone }[];
  checks: number;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  x: "X",
  instagram: "Instagram",
  threads: "Threads",
  youtube: "YouTube",
  facebook: "Facebook",
  reddit: "Reddit",
  telegram: "Telegram",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  upload: "Uploaded file",
  web: "Web",
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function cardModel(r: Report): CardModel {
  const top = r.findings[0];
  const prov = r.stages.provenance.data;
  const geo = r.stages.geolocation.data;
  const sun = r.stages.chronolocation.data;
  const wx = r.stages.weather.data;
  const integ = r.stages.integrity.data;
  const hero = r.frames.find((f) => f.id === r.heroFrameId) ?? r.frames[0];

  const model: CardModel = {
    id: r.id,
    sample: !!r.sample,
    platform: PLATFORM_LABEL[r.source.platform],
    posted: r.source.postedAt ? formatDay(r.source.postedAt) : undefined,
    headline: clip(top?.title ?? (r.status === "done" ? "Nothing conclusive yet" : "Verification in progress"), 64),
    detail: clip(top?.detail ?? "Each check below is a signal with its own confidence, not a verdict.", 170),
    tone: top?.tone ?? "neutral",
    also: r.findings
      .slice(1)
      .filter((f) => f.tone === "alert" || f.tone === "caution")
      .slice(0, 2)
      .map((f) => ({ title: clip(f.title, 60), tone: f.tone })),
    heroFrameId: hero?.id,
    heroCaption: hero ? `FRAME ${String(hero.index).padStart(2, "0")} · ${hero.t.toFixed(1)}s${hero.facesBlurred ? ` · ${hero.facesBlurred} face${hero.facesBlurred === 1 ? "" : "s"} blurred` : ""}` : undefined,
    signals: [],
    checks: Object.values(r.stages).filter((s) => s.status === "done").length,
  };

  if (prov) {
    const e = prov.earliest;
    const dated = prov.matches.filter((m) => m.firstSeen && m.exact);
    const recycled = e && !e.isSource && (prov.leadDays ?? 0) >= 2;
    model.firstSeen = {
      label: "First seen",
      value: e?.firstSeen ? formatDay(e.firstSeen) : "No earlier copy",
      sub: e ? (recycled ? `${e.domain} · ${humanSpan(prov.leadDays!)} earlier` : `${dated.length} cop${dated.length === 1 ? "y" : "ies"} found`) : `${prov.providers.filter((p) => p.status === "ok").length} engines searched`,
      tone: recycled ? "alert" : "neutral",
      timeline: dated.slice(0, 24).map((m) => ({ at: Date.parse(m.firstSeen!), earliest: m.id === e?.id, source: m.isSource })),
    };
  }

  if (geo?.best) {
    model.where = {
      label: "Filmed near",
      value: clip(geo.best.label.split(",")[0]!, 28),
      sub: `${formatCoord(geo.best.lat, geo.best.lon, 3)} · ${geo.best.matchedFeatures.length}/${geo.best.matchedFeatures.length + geo.best.missingFeatures.length} features`,
      tone: r.findings.some((f) => f.stage === "geolocation" && f.tone === "alert") ? "alert" : "neutral",
      lat: geo.best.lat,
      lon: geo.best.lon,
    };
  } else if (r.stages.scene.data?.regions[0]) {
    const region = r.stages.scene.data.regions[0];
    model.where = { label: "Clues point to", value: clip(region.name, 28), sub: `${region.confidence} confidence · no exact map match`, tone: "neutral" };
  }

  if (sun) {
    const w = sun.windows[0];
    model.when = {
      label: "Sun position",
      value:
        sun.verdict === "inconsistent"
          ? "Doesn't fit date"
          : w
            ? sun.windows.slice(0, 2).map((x) => `${localTime(x.start, sun.timezone)}–${localTime(x.end, sun.timezone)}`).join(" · ")
            : "Unreadable",
      sub: sun.estimatedAltitude ? `Sun ≈${sun.estimatedAltitude.value}° on ${sun.date}` : clip(sun.explanation, 48),
      tone: sun.verdict === "inconsistent" ? "alert" : "neutral",
    };
  }

  if (wx) {
    model.weather = {
      label: "Weather",
      value: wx.verdict === "inconsistent" ? "Doesn't match" : wx.verdict === "consistent" ? "Matches records" : "Inconclusive",
      sub: `${wx.location} · ${wx.date}`,
      tone: wx.verdict === "inconsistent" ? "alert" : wx.verdict === "consistent" ? "ok" : "neutral",
    };
  }

  if (integ) {
    model.signals = integ.signals
      .filter((s) => s.strength !== "info")
      .slice(0, 3)
      .map((s) => ({
        label: clip(s.label, 30),
        tone: s.direction === "suggests-manipulation" ? (s.strength === "strong" ? "alert" : "caution") : s.direction === "supports-authentic" ? "ok" : "neutral",
      }));
    if (!model.signals.length) model.signals = [{ label: "No tampering signals", tone: "neutral" }];
  }

  return model;
}
