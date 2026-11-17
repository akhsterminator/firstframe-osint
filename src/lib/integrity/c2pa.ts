import { createReadStream } from "node:fs";
import { config } from "../config";
import { run } from "../util/proc";

export interface C2paResult {
  present: boolean;
  parsed: boolean;
  generator?: string;
  aiSource?: boolean;
  actions?: string[];
}

const MARKERS = [Buffer.from("jumb"), Buffer.from("c2pa")];
// UUID of the C2PA box in ISO BMFF (MP4/MOV) files.
const MP4_UUID = Buffer.from("d8fec3d61b0e483c92975828877ec481", "hex");

/** Cheap presence check that works without any extra tooling. */
export function scanForManifest(file: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let tail = Buffer.alloc(0);
    let jumb = false;
    let c2pa = false;
    const stream = createReadStream(file, { highWaterMark: 1 << 20 });
    stream.on("data", (chunk: string | Buffer) => {
      const buf = Buffer.concat([tail, chunk as Buffer]);
      if (buf.includes(MP4_UUID)) {
        stream.destroy();
        return resolve(true);
      }
      jumb ||= buf.includes(MARKERS[0]!);
      c2pa ||= buf.includes(MARKERS[1]!);
      if (jumb && c2pa) {
        stream.destroy();
        return resolve(true);
      }
      tail = buf.subarray(Math.max(0, buf.length - 32));
    });
    stream.on("end", () => resolve(false));
    stream.on("error", reject);
  });
}

interface ManifestStore {
  active_manifest?: string;
  manifests?: Record<
    string,
    {
      claim_generator?: string;
      claim_generator_info?: { name?: string; version?: string }[];
      assertions?: { label?: string; data?: { actions?: { action?: string; digitalSourceType?: string; softwareAgent?: unknown }[] } }[];
    }
  >;
}

const AI_SOURCE = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;

export function readManifest(store: ManifestStore): Omit<C2paResult, "present" | "parsed"> {
  const active = store.active_manifest ? store.manifests?.[store.active_manifest] : undefined;
  if (!active) return {};
  const generator = active.claim_generator_info?.[0]?.name ?? active.claim_generator;
  const actions: string[] = [];
  let aiSource = false;
  for (const a of active.assertions ?? []) {
    if (!a.label?.startsWith("c2pa.actions")) continue;
    for (const act of a.data?.actions ?? []) {
      if (act.action) actions.push(act.action.replace(/^c2pa\./, ""));
      if (act.digitalSourceType && AI_SOURCE.test(act.digitalSourceType)) aiSource = true;
    }
  }
  return { generator, actions: [...new Set(actions)], aiSource };
}

/**
 * Social platforms strip most Content Credentials on upload, so absence tells
 * us very little. Presence, especially with an AI source type, tells us a lot.
 */
export async function checkC2pa(file: string): Promise<C2paResult> {
  const present = await scanForManifest(file).catch(() => false);
  if (!present) return { present: false, parsed: false };
  try {
    const { stdout } = await run(config.c2patool, [file], { timeoutMs: 30_000 });
    return { present: true, parsed: true, ...readManifest(JSON.parse(stdout) as ManifestStore) };
  } catch {
    return { present: true, parsed: false };
  }
}
