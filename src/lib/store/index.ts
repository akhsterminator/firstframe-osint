import { config } from "../config";
import type { Report } from "../types";
import type { ReportListing } from "./listing";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";

export { toListing, type ReportListing } from "./listing";

export interface Store {
  readonly kind: "local" | "supabase";
  getReport(id: string): Promise<Report | undefined>;
  saveReport(report: Report): Promise<void>;
  findBySourceKey(key: string, maxAgeHours: number): Promise<Report | undefined>;
  listRecent(limit: number): Promise<ReportListing[]>;
  /** Store a file and return the URL the app should use for it. */
  putFile(key: string, data: Buffer, contentType: string): Promise<string>;
  getFile(key: string): Promise<Buffer | undefined>;
  /** An absolute URL a third-party service can fetch, or undefined if the file isn't public. */
  publicUrl(key: string): string | undefined;
}

const g = globalThis as unknown as { __ffStore?: Store };

export function getStore(): Store {
  if (!g.__ffStore) {
    g.__ffStore =
      config.supabaseUrl && config.supabaseServiceKey
        ? new SupabaseStore(config.supabaseUrl, config.supabaseServiceKey, config.supabaseBucket)
        : new LocalStore(config.dataDir);
  }
  return g.__ffStore;
}

export function setStore(store: Store): void {
  g.__ffStore = store;
}
