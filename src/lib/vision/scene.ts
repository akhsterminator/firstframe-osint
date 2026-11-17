import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config";
import type { FeatureRelation, MapFeature, SceneAnalysis } from "../types";
import { SceneSchema, type SceneOutput } from "./schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export interface SceneInput {
  platform: string;
  title?: string;
  caption?: string;
  claimPlace?: string;
  claimDate?: string;
  frames: { index: number; t: number; jpeg: Buffer }[];
}

const TAG_KEY = /^[a-z][a-z0-9_:.-]{0,39}$/i;
const TAG_VALUE = /^[^"\\\n\r]{1,80}$/;

/**
 * The model writes map tags; we treat them as untrusted input before they go
 * anywhere near a query string.
 */
export function sanitiseFeatures(features: MapFeature[], relations: FeatureRelation[]) {
  const seen = new Set<string>();
  const cleanFeatures: MapFeature[] = [];
  for (const f of features) {
    const id = f.id.replace(/[^a-z0-9_]/gi, "").slice(0, 8) || `f${cleanFeatures.length}`;
    if (seen.has(id)) continue;
    const tagSets = f.tagSets
      .map((set) => set.filter((t) => TAG_KEY.test(t.key) && (t.value === null || TAG_VALUE.test(t.value))))
      .filter((set) => set.length > 0)
      .slice(0, 4);
    const name = f.name && TAG_VALUE.test(f.name) ? f.name.trim() : null;
    if (!tagSets.length && !name) continue;
    seen.add(id);
    cleanFeatures.push({ ...f, id, tagSets, name });
    if (cleanFeatures.length >= 6) break;
  }
  const cleanRelations = relations
    .map((r) => ({
      from: r.from.replace(/[^a-z0-9_]/gi, "").slice(0, 8),
      to: r.to.replace(/[^a-z0-9_]/gi, "").slice(0, 8),
      maxDistanceM: Math.round(Math.min(5000, Math.max(25, r.maxDistanceM))),
    }))
    .filter((r) => r.from !== r.to && seen.has(r.from) && seen.has(r.to));
  return { features: cleanFeatures, relations: cleanRelations };
}

export function normaliseScene(out: SceneOutput, model: string): SceneAnalysis {
  const { features, relations } = sanitiseFeatures(out.features, out.relations);
  return {
    summary: out.summary,
    clues: out.clues.slice(0, 30),
    regions: out.regions
      .filter((r) => /^[A-Z]{2}$/i.test(r.countryCode))
      .map((r) => ({
        ...r,
        countryCode: r.countryCode.toUpperCase(),
        subdivisionCode: r.subdivisionCode && /^[A-Z]{2}-[A-Z0-9]{1,3}$/i.test(r.subdivisionCode) ? r.subdivisionCode.toUpperCase() : null,
      }))
      .slice(0, 3),
    features,
    relations,
    sky: {
      ...out.sky,
      shadowRatio: out.sky.shadowRatio !== null && out.sky.shadowRatio > 0.02 && out.sky.shadowRatio < 50 ? out.sky.shadowRatio : null,
    },
    anomalies: out.anomalies.slice(0, 12),
    model,
  };
}

export class SceneRefusedError extends Error {}

export async function analyseScene(input: SceneInput, client = new Anthropic()): Promise<SceneAnalysis> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of input.frames) {
    content.push({ type: "text", text: `Frame #${f.index} (t=${f.t.toFixed(1)}s)` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.jpeg.toString("base64") } });
  }
  content.push({ type: "text", text: userPrompt({ ...input, frames: input.frames }) });

  const model = config.visionModel;
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { effort: "high", format: betaZodOutputFormat(SceneSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new SceneRefusedError("The vision model declined to analyse these frames.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Scene analysis ran out of output tokens before finishing.");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Scene analysis returned no structured output.");
  return normaliseScene(parsed, response.model);
}
