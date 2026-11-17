import { liveReport } from "../pipeline/jobs";
import { ensureSampleAssets, sampleReport } from "../sample";
import { getStore } from "../store";
import type { Report } from "../types";

export async function loadReport(id: string): Promise<Report | undefined> {
  if (id === "sample") {
    await ensureSampleAssets(getStore()).catch(() => {});
    return sampleReport();
  }
  if (!/^[a-z0-9]{4,32}$/.test(id)) return undefined;
  return liveReport(id) ?? (await getStore().getReport(id));
}

/** Strip fields the browser never needs. Hourly weather is kept for the chart. */
export function publicReport(r: Report): Report {
  return { ...r, sourceKey: "" };
}
