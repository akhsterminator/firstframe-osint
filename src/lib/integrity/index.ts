import type { IntegrityResult, IntegritySignal, SceneAnalysis, SignalStrength } from "../types";
import type { C2paResult } from "./c2pa";
import type { DetectorRun } from "./detectors";

const AI_TOOLS = /\b(sora|runway|gen-?[234]|pika|kling|veo|luma|dream ?machine|hailuo|minimax|midjourney|stable ?video|synthesia|heygen|d-id|firefly)\b/i;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface IntegrityInput {
  metadata: Record<string, string>;
  c2pa: C2paResult;
  detectors: DetectorRun[];
  scene?: SceneAnalysis;
  fromPlatform: boolean;
}

/**
 * Turn raw checks into signals. Each one says which way it points and how much
 * weight it can bear. Nothing here returns "real" or "fake": detectors are
 * unreliable on recompressed social video and the report says so.
 */
export function buildIntegrity(input: IntegrityInput): IntegrityResult {
  const signals: IntegritySignal[] = [];
  const { c2pa, metadata } = input;

  if (c2pa.present && c2pa.aiSource) {
    signals.push({
      id: "c2pa-ai",
      source: "Content Credentials",
      label: "Declared AI-generated",
      detail: `The file's C2PA manifest${c2pa.generator ? ` from ${c2pa.generator}` : ""} records an AI-generated source.`,
      direction: "suggests-manipulation",
      strength: "strong",
    });
  } else if (c2pa.present && c2pa.parsed) {
    signals.push({
      id: "c2pa",
      source: "Content Credentials",
      label: "Signed provenance found",
      detail: `C2PA manifest${c2pa.generator ? ` from ${c2pa.generator}` : ""}${c2pa.actions?.length ? `, actions: ${c2pa.actions.join(", ")}` : ""}.`,
      direction: c2pa.actions?.some((a) => a !== "created" && a !== "opened") ? "neutral" : "supports-authentic",
      strength: "moderate",
    });
  } else if (c2pa.present) {
    signals.push({
      id: "c2pa-unparsed",
      source: "Content Credentials",
      label: "Content Credentials present",
      detail: "A C2PA manifest is embedded. Install c2patool to read and validate it.",
      direction: "neutral",
      strength: "info",
    });
  } else {
    signals.push({
      id: "c2pa-none",
      source: "Content Credentials",
      label: "No Content Credentials",
      detail: input.fromPlatform
        ? "Expected: social platforms strip C2PA data on upload. Absence says nothing either way."
        : "No C2PA manifest in this file. Most cameras and phones don't add one yet.",
      direction: "neutral",
      strength: "info",
    });
  }

  const allTags = Object.values(metadata).join(" ");
  const tool = allTags.match(AI_TOOLS)?.[0];
  if (tool) {
    signals.push({
      id: "meta-ai-tool",
      source: "File metadata",
      label: `Metadata mentions ${tool}`,
      detail: "A generative video tool is named in the file's metadata.",
      direction: "suggests-manipulation",
      strength: "strong",
    });
  }
  if (/lavf|ffmpeg|handbrake|capcut|inshot|premiere|davinci|final cut/i.test(allTags)) {
    const editor = allTags.match(/lavf|ffmpeg|handbrake|capcut|inshot|premiere|davinci|final cut/i)![0];
    signals.push({
      id: "meta-reencoded",
      source: "File metadata",
      label: "Re-encoded or edited",
      detail: `Processed with ${editor}. Common for reposts; it doesn't mean the content was altered, but the file isn't a camera original.`,
      direction: "neutral",
      strength: "info",
    });
  }
  if (metadata["com.apple.quicktime.make"] || metadata["com.android.manufacturer"]) {
    signals.push({
      id: "meta-device",
      source: "File metadata",
      label: "Camera metadata intact",
      detail: `Recorded on ${[metadata["com.apple.quicktime.make"] ?? metadata["com.android.manufacturer"], metadata["com.apple.quicktime.model"] ?? metadata["com.android.model"]].filter(Boolean).join(" ")}.`,
      direction: "supports-authentic",
      strength: "weak",
    });
  }
  if (metadata.audio === "none") {
    signals.push({
      id: "meta-no-audio",
      source: "File metadata",
      label: "No audio track",
      detail: "Silent clips are common in edits, screen recordings and generated video.",
      direction: "neutral",
      strength: "info",
    });
  }

  for (const d of input.detectors) {
    if (d.status !== "ok" || !d.scores.length) continue;
    const med = median(d.scores);
    const max = Math.max(...d.scores);
    let strength: SignalStrength = "info";
    let direction: IntegritySignal["direction"] = "neutral";
    if (med >= 0.9) [strength, direction] = ["moderate", "suggests-manipulation"];
    else if (med >= 0.6 || max >= 0.9) [strength, direction] = ["weak", "suggests-manipulation"];
    else if (max <= 0.15) [strength, direction] = ["weak", "supports-authentic"];
    signals.push({
      id: `detector-${d.detector.toLowerCase()}`,
      source: d.detector,
      label: `AI-detector score ${Math.round(med * 100)}%`,
      detail: `Median across ${d.scores.length} frame${d.scores.length === 1 ? "" : "s"}, highest ${Math.round(max * 100)}%. Detectors are often wrong on compressed social video; treat this as one signal among several.`,
      direction,
      strength,
      score: med,
    });
  }

  for (const [i, a] of (input.scene?.anomalies ?? []).entries()) {
    signals.push({
      id: `visual-${i}`,
      source: "Visual read",
      label: a.severity === "strong" ? "Visual inconsistency" : "Possible visual artefact",
      detail: `${a.observation} (frame ${a.frameIndex}).`,
      direction: "suggests-manipulation",
      strength: a.severity === "strong" ? "moderate" : a.severity === "notable" ? "weak" : "info",
    });
  }

  const order: Record<SignalStrength, number> = { strong: 0, moderate: 1, weak: 2, info: 3 };
  signals.sort((a, b) => order[a.strength] - order[b.strength]);
  return { signals, c2pa, metadata };
}
