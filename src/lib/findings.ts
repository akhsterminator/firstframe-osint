import type { Finding, FindingTone, Report } from "./types";
import { formatDay, humanSpan } from "./util/dates";
import { haversine } from "./util/geo";
import { localTime } from "./util/tz";

const TONE_RANK: Record<FindingTone, number> = { alert: 0, caution: 1, ok: 2, neutral: 3 };
const RECYCLED_DAYS = 2;

/**
 * Plain-language findings, most important first. They describe what the
 * evidence shows and how strong it is; they never declare a video real or fake.
 */
export interface ClaimedPlace {
  lat: number;
  lon: number;
  label: string;
  /** south,west,north,east when the claim is a town or smaller. */
  bbox?: [number, number, number, number];
}

/** Inside the claimed town's bounding box (padded by ~5 km), or within 10 km of its centre. */
export function fitsClaim(claim: ClaimedPlace, p: { lat: number; lon: number }): boolean {
  if (claim.bbox) {
    const [s, w, n, e] = claim.bbox;
    const pad = 0.045;
    if (p.lat >= s - pad && p.lat <= n + pad && p.lon >= w - pad && p.lon <= e + pad) return true;
  }
  return haversine(claim, p) <= 10_000;
}

export function buildFindings(r: Report, claimPoint?: ClaimedPlace): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, "id">) => out.push({ ...f, id: `${f.stage}-${out.length}` });
  const { provenance, geolocation, chronolocation, weather, integrity, scene } = r.stages;

  const prov = provenance.data;
  if (prov) {
    const ranAny = prov.providers.some((p) => p.status === "ok");
    const e = prov.earliest;
    if (e?.firstSeen && prov.leadDays !== undefined && prov.leadDays >= RECYCLED_DAYS && !e.isSource) {
      add({
        stage: "provenance",
        tone: "alert",
        title: `Online since ${formatDay(e.firstSeen)}`,
        detail: `An earlier copy on ${e.domain} predates this post by ${humanSpan(prov.leadDays)}${e.firstSeenConfidence === "low" ? " (date is a crawl bound, so treat it as approximate)" : ""}.`,
      });
    } else if (ranAny && (!e || e.isSource)) {
      add({
        stage: "provenance",
        tone: "ok",
        title: "No earlier copy found",
        detail: `Reverse search across ${prov.providers.filter((p) => p.status === "ok").map((p) => p.provider).join(", ")} found nothing older than this post. That's not proof it's original; new uploads take time to be indexed.`,
      });
    } else if (!ranAny) {
      add({ stage: "provenance", tone: "neutral", title: "Reverse search not run", detail: "No search provider was configured for this instance." });
    }
  }

  const geo = geolocation.data;
  if (geo?.best) {
    const far = claimPoint ? haversine(claimPoint, geo.best) : undefined;
    const fits = claimPoint ? fitsClaim(claimPoint, geo.best) : undefined;
    if (far !== undefined && fits === false) {
      add({
        stage: "geolocation",
        tone: "alert",
        title: `Scene fits ${geo.best.label.split(",")[0]}, not ${claimPoint!.label.split(",")[0]}`,
        detail: `The visible features fit ${geo.best.label}, about ${Math.round(far / 1000)} km from the claimed location. Check the candidates on the map before relying on this.`,
      });
    } else {
      add({
        stage: "geolocation",
        tone: far !== undefined ? "ok" : "neutral",
        title: `Likely filmed near ${geo.best.label.split(",")[0]}`,
        detail: `${geo.best.matchedFeatures.length} of ${geo.best.matchedFeatures.length + geo.best.missingFeatures.length} visible features found together on OpenStreetMap${far !== undefined ? ", consistent with the claimed location" : ""}. Confirm with street-level imagery before relying on it.`,
      });
    }
  } else if (scene.data?.regions[0]) {
    const top = scene.data.regions[0];
    add({
      stage: "geolocation",
      tone: "neutral",
      title: `Clues point to ${top.name}`,
      detail: geo?.candidates.length
        ? "The map search found partial matches only; see the candidates below."
        : `No single place on the map matched every feature. ${top.reasoning}`,
    });
  }

  const sun = chronolocation.data;
  if (sun?.verdict === "inconsistent") {
    add({ stage: "chronolocation", tone: "alert", title: "Shadows don't fit the date", detail: sun.explanation });
  } else if (sun?.verdict === "consistent" && sun.windows.length) {
    const w = sun.windows.map((x) => `${localTime(x.start, sun.timezone)}–${localTime(x.end, sun.timezone)}`).join(" or ");
    add({ stage: "chronolocation", tone: "neutral", title: `Sun puts it at ${w}`, detail: sun.explanation });
  }

  const wx = weather.data;
  if (wx?.verdict === "inconsistent") add({ stage: "weather", tone: "alert", title: "Weather doesn't match records", detail: wx.headline });
  else if (wx?.verdict === "consistent") add({ stage: "weather", tone: "ok", title: "Weather matches records", detail: wx.headline });

  const integ = integrity.data;
  if (integ) {
    const strong = integ.signals.find((s) => s.direction === "suggests-manipulation" && s.strength === "strong");
    const moderate = integ.signals.filter((s) => s.direction === "suggests-manipulation" && s.strength === "moderate");
    if (strong) add({ stage: "integrity", tone: "alert", title: strong.label, detail: strong.detail });
    else if (moderate.length) {
      add({
        stage: "integrity",
        tone: "caution",
        title: `${moderate.length} tampering signal${moderate.length === 1 ? "" : "s"} worth checking`,
        detail: moderate.map((s) => s.label).join("; ") + ". Signals, not a verdict.",
      });
    }
  }

  return out.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}
