import { config } from "../config";
import { hasCommand } from "../util/proc";
import { getStore } from "../store";

export interface Capabilities {
  scene: boolean;
  reverseSearch: string[];
  aiDetectors: string[];
  ytDlp: boolean;
  ffmpeg: boolean;
  c2patool: boolean;
  storage: "local" | "supabase";
  publicFrames: boolean;
}

let cached: { at: number; value: Capabilities } | undefined;

export async function capabilities(): Promise<Capabilities> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const store = getStore();
  const publicFrames = !!store.publicUrl("probe");
  const [ytDlp, ffmpeg, c2patool] = await Promise.all([
    hasCommand(config.ytDlp),
    hasCommand(config.ffmpeg, "-version"),
    hasCommand(config.c2patool),
  ]);
  const reverseSearch = [
    ...(config.tineyeKey ? ["TinEye"] : []),
    ...(config.serpApiKey && publicFrames ? config.serpApiEngines : []),
  ];
  const value: Capabilities = {
    scene: !!config.anthropicKey,
    reverseSearch,
    aiDetectors: [...(config.hiveKey ? ["Hive"] : []), ...(config.sightengineUser && config.sightengineSecret ? ["Sightengine"] : [])],
    ytDlp,
    ffmpeg,
    c2patool,
    storage: store.kind,
    publicFrames,
  };
  cached = { at: Date.now(), value };
  return value;
}
