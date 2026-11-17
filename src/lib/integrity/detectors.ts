import { config } from "../config";
import { httpJson } from "../util/http";
import { errorMessage } from "../util/async";

export interface DetectorRun {
  detector: string;
  status: "ok" | "skipped" | "error";
  scores: number[];
  note?: string;
}

interface Detector {
  name: string;
  enabled(): boolean;
  score(jpeg: Buffer): Promise<number>;
}

function form(jpeg: Buffer, field: string): FormData {
  const f = new FormData();
  f.append(field, new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "frame.jpg");
  return f;
}

export const sightengine: Detector = {
  name: "Sightengine",
  enabled: () => !!(config.sightengineUser && config.sightengineSecret),
  async score(jpeg) {
    const f = form(jpeg, "media");
    f.append("models", "genai");
    f.append("api_user", config.sightengineUser!);
    f.append("api_secret", config.sightengineSecret!);
    const r = await httpJson<{ status: string; type?: { ai_generated?: number }; error?: { message?: string } }>(
      "https://api.sightengine.com/1.0/check.json",
      { method: "POST", body: f, timeoutMs: 30_000 },
    );
    if (r.status !== "success" || typeof r.type?.ai_generated !== "number") throw new Error(r.error?.message ?? "unexpected response");
    return r.type.ai_generated;
  },
};

export const hive: Detector = {
  name: "Hive",
  enabled: () => !!config.hiveKey,
  async score(jpeg) {
    const r = await httpJson<{ status?: { response?: { output?: { classes?: { class: string; score: number }[] }[] } }[] }>(
      "https://api.thehive.ai/api/v2/task/sync",
      { method: "POST", body: form(jpeg, "media"), headers: { authorization: `Token ${config.hiveKey}` }, timeoutMs: 30_000 },
    );
    const classes = r.status?.[0]?.response?.output?.[0]?.classes ?? [];
    const hit = classes.find((c) => c.class === "ai_generated");
    if (!hit) throw new Error("no ai_generated class in response");
    return hit.score;
  },
};

export async function runDetectors(frames: Buffer[], detectors: Detector[] = [hive, sightengine]): Promise<DetectorRun[]> {
  return Promise.all(
    detectors.map(async (d): Promise<DetectorRun> => {
      if (!d.enabled()) return { detector: d.name, status: "skipped", scores: [], note: "No API key configured" };
      const scores: number[] = [];
      let lastError: string | undefined;
      for (const f of frames) {
        try {
          scores.push(await d.score(f));
        } catch (err) {
          lastError = errorMessage(err);
        }
      }
      return scores.length
        ? { detector: d.name, status: "ok", scores }
        : { detector: d.name, status: "error", scores, note: lastError };
    }),
  );
}
