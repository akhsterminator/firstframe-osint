export type StageId =
  | "ingest"
  | "keyframes"
  | "provenance"
  | "scene"
  | "geolocation"
  | "chronolocation"
  | "weather"
  | "integrity";

export const STAGE_ORDER: StageId[] = [
  "ingest",
  "keyframes",
  "provenance",
  "scene",
  "geolocation",
  "chronolocation",
  "weather",
  "integrity",
];

export const STAGE_LABELS: Record<StageId, string> = {
  ingest: "Fetch video",
  keyframes: "Extract keyframes",
  provenance: "Trace earliest copy",
  scene: "Read the scene",
  geolocation: "Search the map",
  chronolocation: "Read the sun",
  weather: "Check the weather",
  integrity: "Look for tampering",
};

export type StageStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface StageState<T = unknown> {
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  /** Short human-readable explanation, e.g. why a stage was skipped. */
  note?: string;
  error?: string;
  data?: T;
}

export type Confidence = "low" | "medium" | "high";

export type Platform =
  | "tiktok"
  | "x"
  | "instagram"
  | "threads"
  | "youtube"
  | "facebook"
  | "reddit"
  | "telegram"
  | "bluesky"
  | "mastodon"
  | "upload"
  | "web";

export interface SourceInfo {
  input: string;
  platform: Platform;
  canonicalUrl?: string;
  postId?: string;
  title?: string;
  /** Caption text as posted. Treated as a claim to test, never as evidence. */
  caption?: string;
  /** When the platform says this copy was posted. */
  postedAt?: string;
  postedAtSource?: "id" | "platform" | "file";
  durationSec?: number;
  width?: number;
  height?: number;
  sha256?: string;
  /** Rounded GPS position from file metadata, if the file kept one. */
  gps?: { lat: number; lon: number };
}

export interface Claim {
  place?: string;
  date?: string;
}

export interface Frame {
  id: string;
  index: number;
  /** Seconds from start of video. */
  t: number;
  /** Storage key; the file is always the face-blurred version. */
  key: string;
  url: string;
  width: number;
  height: number;
  facesBlurred: number;
  /** 64-bit difference hash as 16 hex chars. */
  dhash: string;
  sharpness: number;
}

// ---------- provenance ----------

export type DateEvidenceKind =
  | "post-id"
  | "page-metadata"
  | "url-path"
  | "index-crawl"
  | "search-snippet";

export interface DateEvidence {
  kind: DateEvidenceKind;
  date: string;
  detail: string;
  /** Whether the date is when it was published, or only a bound on it. */
  bound: "exact" | "no-later-than";
}

export interface ProvenanceMatch {
  id: string;
  url: string;
  domain: string;
  title?: string;
  thumbnail?: string;
  platform: Platform;
  providers: string[];
  frameIds: string[];
  exact: boolean;
  isSource: boolean;
  evidence: DateEvidence[];
  /** Best estimate of when this copy first appeared. */
  firstSeen?: string;
  firstSeenConfidence?: Confidence;
}

export interface ProviderRun {
  provider: string;
  status: "ok" | "skipped" | "error";
  results: number;
  note?: string;
}

export interface ProvenanceResult {
  matches: ProvenanceMatch[];
  earliest?: ProvenanceMatch;
  providers: ProviderRun[];
  /** Days between the earliest copy and the analysed post, if both are dated. */
  leadDays?: number;
}

// ---------- scene ----------

export type ClueKind =
  | "text"
  | "road"
  | "architecture"
  | "infrastructure"
  | "vegetation"
  | "terrain"
  | "vehicle"
  | "landmark"
  | "other";

export interface SceneClue {
  kind: ClueKind;
  description: string;
  frameIndex: number;
  confidence: Confidence;
  text: string | null;
  script: string | null;
  language: string | null;
}

export interface RegionHypothesis {
  name: string;
  countryCode: string;
  subdivisionCode: string | null;
  reasoning: string;
  confidence: Confidence;
}

export interface OsmTag {
  key: string;
  value: string | null;
}

export interface MapFeature {
  id: string;
  label: string;
  /** Alternative tag sets. A feature matches if any one set matches in full. */
  tagSets: OsmTag[][];
  name: string | null;
  rarity: "common" | "uncommon" | "rare";
}

export interface FeatureRelation {
  from: string;
  to: string;
  maxDistanceM: number;
}

export interface SkyReading {
  sunVisible: boolean;
  shadowsVisible: boolean;
  /** Shadow length divided by the height of the object casting it. */
  shadowRatio: number | null;
  shadowRatioConfidence: Confidence;
  shadowNotes: string | null;
  precipitation: "none" | "rain" | "snow" | "unknown";
  ground: "dry" | "wet" | "snow" | "unknown";
  cloudCover: "clear" | "partly" | "overcast" | "unknown";
  daylight: "day" | "twilight" | "night" | "unknown";
  foliage: "leafy" | "bare" | "mixed" | "unknown";
}

export interface VisualAnomaly {
  observation: string;
  frameIndex: number;
  severity: "minor" | "notable" | "strong";
}

export interface SceneAnalysis {
  summary: string;
  clues: SceneClue[];
  regions: RegionHypothesis[];
  features: MapFeature[];
  relations: FeatureRelation[];
  sky: SkyReading;
  anomalies: VisualAnomaly[];
  model: string;
}

// ---------- geolocation ----------

export interface GeoCandidate {
  id: string;
  lat: number;
  lon: number;
  label: string;
  region: string;
  matchedFeatures: string[];
  missingFeatures: string[];
  score: number;
  osmUrl: string;
}

export interface GeoSearch {
  region: string;
  area: { kind: "country" | "subdivision" | "bbox"; value: string };
  query: string;
  overpassTurboUrl: string;
  status: "ok" | "empty" | "error" | "timeout";
  elements: number;
  note?: string;
}

export interface GeolocationResult {
  candidates: GeoCandidate[];
  searches: GeoSearch[];
  best?: GeoCandidate;
  /** Where the location used by later stages came from. */
  basis: "candidate" | "claim" | "metadata" | "region-centroid" | "none";
  point?: { lat: number; lon: number; label: string };
}

// ---------- chronolocation ----------

export interface SunWindow {
  start: string;
  end: string;
  /** Sun altitude in degrees at the midpoint. */
  altitude: number;
  azimuth: number;
}

export interface ChronolocationResult {
  date: string;
  dateBasis: "claim" | "earliest-copy" | "post" | "file";
  timezone: string;
  estimatedAltitude?: { value: number; min: number; max: number };
  windows: SunWindow[];
  /** Months of the year in which the sun can reach the estimated altitude at this place. */
  feasibleMonths: number[];
  curve: { t: string; altitude: number }[];
  sunrise?: string;
  sunset?: string;
  verdict: "consistent" | "inconsistent" | "inconclusive";
  explanation: string;
}

// ---------- weather ----------

export interface WeatherCheck {
  aspect: "precipitation" | "ground" | "cloud" | "snow" | "daylight";
  observed: string;
  recorded: string;
  result: "consistent" | "inconsistent" | "inconclusive";
  weight: "weak" | "moderate" | "strong";
}

export interface WeatherResult {
  date: string;
  location: string;
  source: string;
  hourly: { t: string; code: number; precipitation: number; cloud: number; snowDepth: number; temp: number }[];
  daily: { code: number; precipitation: number; tempMax: number; tempMin: number; sunrise?: string; sunset?: string };
  checks: WeatherCheck[];
  verdict: "consistent" | "inconsistent" | "inconclusive";
  headline: string;
}

// ---------- integrity ----------

export type SignalDirection = "supports-authentic" | "suggests-manipulation" | "neutral";
export type SignalStrength = "info" | "weak" | "moderate" | "strong";

export interface IntegritySignal {
  id: string;
  source: string;
  label: string;
  detail: string;
  direction: SignalDirection;
  strength: SignalStrength;
  /** 0..1 where a detector reports one. Shown as a signal, never a verdict. */
  score?: number;
}

export interface IntegrityResult {
  signals: IntegritySignal[];
  c2pa: { present: boolean; parsed: boolean; generator?: string; aiSource?: boolean; actions?: string[] };
  metadata: Record<string, string>;
}

// ---------- report ----------

export type FindingTone = "alert" | "caution" | "ok" | "neutral";

export interface Finding {
  id: string;
  stage: StageId;
  tone: FindingTone;
  title: string;
  detail: string;
}

export interface ReportStages {
  ingest: StageState<SourceInfo>;
  keyframes: StageState<{ count: number; candidates: number }>;
  provenance: StageState<ProvenanceResult>;
  scene: StageState<SceneAnalysis>;
  geolocation: StageState<GeolocationResult>;
  chronolocation: StageState<ChronolocationResult>;
  weather: StageState<WeatherResult>;
  integrity: StageState<IntegrityResult>;
}

export type ReportStatus = "queued" | "running" | "done" | "failed";

export interface Report {
  id: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  error?: string;
  sourceKey: string;
  source: SourceInfo;
  claim?: Claim;
  frames: Frame[];
  heroFrameId?: string;
  stages: ReportStages;
  findings: Finding[];
  /** Total wall time in milliseconds once finished. */
  elapsedMs?: number;
  sample?: boolean;
}
