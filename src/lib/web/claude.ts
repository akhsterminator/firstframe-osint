import { DEFAULT_VISION_MODEL } from "../runtime";

const KEY = "ff.anthropicKey";
const MODEL = "ff.model";

export const MODELS = [
  { id: DEFAULT_VISION_MODEL, label: "Claude Opus 5.5", note: "best at reading scenes" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "faster, cheaper" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "cheapest, rougher" },
];

function store(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function getApiKey(): string | undefined {
  return store()?.getItem(KEY) ?? undefined;
}

export function setApiKey(key: string | undefined): void {
  if (key) store()?.setItem(KEY, key.trim());
  else store()?.removeItem(KEY);
}

export function getModel(): string {
  return store()?.getItem(MODEL) ?? DEFAULT_VISION_MODEL;
}

export function setModel(model: string): void {
  store()?.setItem(MODEL, model);
}

/** The key never leaves the browser except in requests to api.anthropic.com. */
export async function browserClient(apiKey: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}
