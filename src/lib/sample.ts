import { chronolocate } from "./chrono/sun";
import { buildFindings } from "./findings";
import { compileQuery, overpassTurboUrl } from "./geo/compile";
import { emptyStages } from "./stages";
import type { MapFeature, FeatureRelation, Report, SceneAnalysis } from "./types";
import { osmBrowseUrl } from "./util/geo";

/**
 * An illustrative report used for the demo page, screenshots and tests. Every
 * domain uses the reserved .example TLD and the card is stamped as a sample, so
 * it can't be mistaken for a real verification.
 */

const FEATURES: MapFeature[] = [
  { id: "a", label: "Multi-arch stone bridge", tagSets: [[{ key: "bridge", value: "yes" }, { key: "highway", value: null }], [{ key: "man_made", value: "bridge" }]], name: null, rarity: "uncommon" },
  { id: "b", label: "Church with spire", tagSets: [[{ key: "amenity", value: "place_of_worship" }, { key: "religion", value: "christian" }], [{ key: "building", value: "church" }]], name: null, rarity: "uncommon" },
  { id: "c", label: "River", tagSets: [[{ key: "waterway", value: "river" }]], name: null, rarity: "uncommon" },
  { id: "d", label: "Roundabout", tagSets: [[{ key: "junction", value: "roundabout" }]], name: null, rarity: "common" },
];

const RELATIONS: FeatureRelation[] = [
  { from: "a", to: "c", maxDistanceM: 60 },
  { from: "a", to: "b", maxDistanceM: 350 },
  { from: "a", to: "d", maxDistanceM: 300 },
];

export const SAMPLE_SCENE: SceneAnalysis = {
  summary:
    "A riverside town at dusk: a multi-arched stone road bridge, a church with a slender spire behind it, terraced houses and a small roundabout. The river is high but within its banks; there is no flooding of the street. Road markings and the triangular warning sign are British.",
  clues: [
    { kind: "road", description: "Triangular red-bordered warning sign for a roundabout ahead, UK design", frameIndex: 0, confidence: "high", text: null, script: null, language: null },
    { kind: "road", description: "White dashed centre line, traffic implied on the left", frameIndex: 0, confidence: "medium", text: null, script: null, language: null },
    { kind: "architecture", description: "Brick terraced houses with chimney stacks", frameIndex: 0, confidence: "medium", text: null, script: null, language: null },
    { kind: "landmark", description: "Five-arch masonry bridge over a wide river", frameIndex: 0, confidence: "high", text: null, script: null, language: null },
    { kind: "architecture", description: "Parish church with tall broach spire", frameIndex: 0, confidence: "high", text: null, script: null, language: null },
  ],
  regions: [
    { name: "England", countryCode: "GB", subdivisionCode: "GB-ENG", reasoning: "UK road signs and markings, English vernacular terraces, broach spire typical of English parish churches.", confidence: "high" },
    { name: "Wales", countryCode: "GB", subdivisionCode: "GB-WLS", reasoning: "Same signage, less typical church style.", confidence: "low" },
  ],
  features: FEATURES,
  relations: RELATIONS,
  sky: {
    sunVisible: true,
    shadowsVisible: true,
    shadowRatio: 3.2,
    shadowRatioConfidence: "medium",
    shadowNotes: "Lamp post shadow on the road, roughly three times its height.",
    precipitation: "none",
    ground: "dry",
    cloudCover: "partly",
    daylight: "twilight",
    foliage: "leafy",
  },
  anomalies: [],
  model: "sample",
};

export function sampleReport(): Report {
  const now = "2026-11-14T09:12:00.000Z";
  const best = { lat: 52.3766, lon: -2.3176 };
  const compiled = compileQuery(FEATURES, RELATIONS, { kind: "subdivision", value: "GB-ENG", label: "England" });
  const sun = chronolocate({ lat: best.lat, lon: best.lon, date: "2026-11-12", dateBasis: "claim", timeZone: "Europe/London", sky: SAMPLE_SCENE.sky });

  const report: Report = {
    id: "sample",
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: "done",
    sample: true,
    sourceKey: "sample",
    source: {
      input: "https://www.tiktok.com/@example/video/7571234567890123456",
      platform: "tiktok",
      canonicalUrl: "https://www.tiktok.com/@example/video/7571234567890123456",
      title: "Sample: river footage shared as 'last night's floods'",
      caption: "Hereford underwater last night 😳 #flood #breaking",
      postedAt: "2026-11-13T07:41:00.000Z",
      postedAtSource: "id",
      durationSec: 14.2,
      width: 1280,
      height: 720,
    },
    claim: { place: "Hereford", date: "2026-11-12" },
    frames: [
      { id: "f0", index: 0, t: 0, key: "sample/hero.jpg", url: "/api/files/sample/hero.jpg", width: 1280, height: 720, facesBlurred: 0, dhash: "0", sharpness: 900 },
    ],
    heroFrameId: "f0",
    stages: emptyStages(),
    findings: [],
    elapsedMs: 41_800,
  };

  const s = report.stages;
  const stamp = { status: "done" as const, startedAt: now, finishedAt: now };
  s.ingest = { ...stamp, data: report.source };
  s.keyframes = { ...stamp, data: { count: 1, candidates: 14 } };
  s.provenance = {
    ...stamp,
    data: {
      providers: [
        { provider: "Google Lens", status: "ok", results: 23 },
        { provider: "TinEye", status: "ok", results: 9 },
        { provider: "Yandex", status: "ok", results: 6 },
        { provider: "Bing", status: "skipped", results: 0, note: "Engine disabled for the sample" },
      ],
      leadDays: 1855.6,
      matches: [
        {
          id: "m1", url: "https://localnews.example/2021/10/09/river-levels-rise", domain: "localnews.example", title: "River levels rise after weekend rain",
          platform: "web", providers: ["TinEye", "Google Lens"], frameIds: ["f0"], exact: true, isSource: false,
          evidence: [
            { kind: "page-metadata", date: "2021-10-09T18:20:00.000Z", detail: "JSON-LD datePublished", bound: "exact" },
            { kind: "index-crawl", date: "2021-10-10T00:00:00.000Z", detail: "TinEye first crawled this copy", bound: "no-later-than" },
          ],
          firstSeen: "2021-10-09T18:20:00.000Z", firstSeenConfidence: "high",
        },
        {
          id: "m2", url: "https://x.com/example/status/1447000000000000000", domain: "x.com", title: "Repost",
          platform: "x", providers: ["Google Lens"], frameIds: ["f0"], exact: true, isSource: false,
          evidence: [{ kind: "post-id", date: "2021-10-10T00:32:41.000Z", detail: "Decoded from x post ID", bound: "exact" }],
          firstSeen: "2021-10-10T00:32:41.000Z", firstSeenConfidence: "high",
        },
        {
          id: "m3", url: "https://forum.example/t/towns-on-the-river/2231", domain: "forum.example", title: "Towns on the river (photo thread)",
          platform: "web", providers: ["Yandex"], frameIds: ["f0"], exact: true, isSource: false,
          evidence: [{ kind: "index-crawl", date: "2023-02-01T00:00:00.000Z", detail: "TinEye first crawled this copy", bound: "no-later-than" }],
          firstSeen: "2023-02-01T00:00:00.000Z", firstSeenConfidence: "low",
        },
        {
          id: "m4", url: report.source.canonicalUrl!, domain: "tiktok.com", title: report.source.title,
          platform: "tiktok", providers: ["Submitted link"], frameIds: ["source"], exact: true, isSource: true,
          evidence: [{ kind: "post-id", date: report.source.postedAt!, detail: "Decoded from tiktok post ID", bound: "exact" }],
          firstSeen: report.source.postedAt, firstSeenConfidence: "high",
        },
      ],
    },
  };
  s.provenance.data!.earliest = s.provenance.data!.matches[0];
  s.scene = { ...stamp, data: SAMPLE_SCENE };
  s.geolocation = {
    ...stamp,
    data: {
      basis: "candidate",
      point: { ...best, label: "Bewdley, Worcestershire" },
      best: {
        id: "c1", ...best, label: "Bewdley, Worcestershire", region: "England",
        matchedFeatures: FEATURES.map((f) => f.label), missingFeatures: [], score: 1, osmUrl: osmBrowseUrl(best.lat, best.lon),
      },
      candidates: [
        { id: "c1", ...best, label: "Bewdley, Worcestershire", region: "England", matchedFeatures: FEATURES.map((f) => f.label), missingFeatures: [], score: 1, osmUrl: osmBrowseUrl(best.lat, best.lon) },
        { id: "c2", lat: 52.0559, lon: -2.7155, label: "Hereford", region: "Claimed: Hereford", matchedFeatures: ["Multi-arch stone bridge", "Church with spire", "River"], missingFeatures: ["Roundabout"], score: 0.78, osmUrl: osmBrowseUrl(52.0559, -2.7155) },
        { id: "c3", lat: 52.5865, lon: -2.1288, label: "Bridgnorth, Shropshire", region: "England", matchedFeatures: ["Multi-arch stone bridge", "River", "Roundabout"], missingFeatures: ["Church with spire"], score: 0.67, osmUrl: osmBrowseUrl(52.5865, -2.1288) },
      ],
      searches: [
        { region: "Claimed: Hereford", area: { kind: "bbox", value: "51.99,-2.80,52.11,-2.64" }, query: compiled.query, overpassTurboUrl: overpassTurboUrl(compiled.query), status: "empty", elements: 61 },
        { region: "England", area: { kind: "subdivision", value: "GB-ENG" }, query: compiled.query, overpassTurboUrl: overpassTurboUrl(compiled.query), status: "ok", elements: 412 },
      ],
    },
  };
  s.chronolocation = { ...stamp, data: sun };
  s.weather = {
    ...stamp,
    data: {
      date: "2026-11-12",
      location: "Bewdley",
      source: "Open-Meteo historical (ERA5 reanalysis)",
      hourly: [],
      daily: { code: 63, precipitation: 14.6, tempMax: 9.1, tempMin: 5.4 },
      checks: [
        { aspect: "precipitation", observed: "dry, with sunshine", recorded: "14.6 mm over 9 h during daylight", result: "inconsistent", weight: "moderate" },
        { aspect: "cloud", observed: "clear sky, direct sun", recorded: "97% average cloud cover during daylight", result: "inconsistent", weight: "moderate" },
      ],
      verdict: "inconsistent",
      headline: "Records for Bewdley on 2026-11-12 show 14.6 mm of rain over 9 h during daylight; the footage shows dry, with sunshine.",
    },
  };
  s.integrity = {
    ...stamp,
    data: {
      c2pa: { present: false, parsed: false },
      metadata: { container: "mov,mp4,m4a,3gp,3g2,mj2", video: "h264, 1280×720, 30.00 fps", audio: "present", encoder: "Lavf60.16.100" },
      signals: [
        { id: "detector-hive", source: "Hive", label: "AI-detector score 4%", detail: "Median across 3 frames, highest 7%.", direction: "supports-authentic", strength: "weak", score: 0.04 },
        { id: "meta-reencoded", source: "File metadata", label: "Re-encoded or edited", detail: "Processed with Lavf.", direction: "neutral", strength: "info" },
        { id: "c2pa-none", source: "Content Credentials", label: "No Content Credentials", detail: "Expected: social platforms strip C2PA data on upload.", direction: "neutral", strength: "info" },
      ],
    },
  };

  report.findings = buildFindings(report, { lat: 52.0559, lon: -2.7155, label: "Hereford, Herefordshire", bbox: [52.02, -2.77, 52.09, -2.67] });
  return report;
}
