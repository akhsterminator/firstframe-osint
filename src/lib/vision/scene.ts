import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { DEFAULT_VISION_MODEL } from "../runtime";
import { sanitiseFeatures } from "../geo/sanitise";
import type { SceneAnalysis } from "../types";
import { SceneSchema, type SceneOutput } from "./schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export interface SceneInput {
  platform: string;
  title?: string;
  caption?: string;
  claimPlace?: string;
  claimDate?: string;
  /** JPEG frames, base64-encoded, faces already blurred. */
  frames: { index: number; t: number; base64: string }[];
}

export { sanitiseFeatures };

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

export async function analyseScene(input: SceneInput, client: Anthropic, model: string = DEFAULT_VISION_MODEL): Promise<SceneAnalysis> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of input.frames) {
    content.push({ type: "text", text: `Frame #${f.index} (t=${f.t.toFixed(1)}s)` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.base64 } });
  }
  content.push({ type: "text", text: userPrompt({ ...input, frames: input.frames }) });

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
