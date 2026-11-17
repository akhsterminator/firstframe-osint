import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Report } from "../types";
import type { Store } from "./index";
import { toListing, type ReportListing } from "./listing";

interface Row {
  id: string;
  source_key: string;
  status: Report["status"];
  data: Report;
  created_at: string;
}

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(
    url: string,
    serviceKey: string,
    private readonly bucket: string,
  ) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async getReport(id: string): Promise<Report | undefined> {
    const { data, error } = await this.db.from("reports").select("data").eq("id", id).maybeSingle<Pick<Row, "data">>();
    if (error) throw new Error(`supabase: ${error.message}`);
    return data?.data;
  }

  async saveReport(report: Report): Promise<void> {
    const { error } = await this.db.from("reports").upsert({
      id: report.id,
      source_key: report.sourceKey,
      status: report.status,
      is_sample: !!report.sample,
      data: report,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
    });
    if (error) throw new Error(`supabase: ${error.message}`);
  }

  async findBySourceKey(key: string, maxAgeHours: number): Promise<Report | undefined> {
    const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
    const { data, error } = await this.db
      .from("reports")
      .select("data")
      .eq("source_key", key)
      .neq("status", "failed")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Row, "data">>();
    if (error) throw new Error(`supabase: ${error.message}`);
    return data?.data;
  }

  async listRecent(limit: number): Promise<ReportListing[]> {
    const { data, error } = await this.db
      .from("reports")
      .select("data")
      .eq("status", "done")
      .eq("is_sample", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`supabase: ${error.message}`);
    return (data as Pick<Row, "data">[]).map((r) => toListing(r.data));
  }

  async putFile(key: string, data: Buffer, contentType: string): Promise<string> {
    const { error } = await this.db.storage.from(this.bucket).upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`supabase storage: ${error.message}`);
    return this.publicUrl(key);
  }

  async getFile(key: string): Promise<Buffer | undefined> {
    const { data, error } = await this.db.storage.from(this.bucket).download(key);
    if (error || !data) return undefined;
    return Buffer.from(await data.arrayBuffer());
  }

  publicUrl(key: string): string {
    return this.db.storage.from(this.bucket).getPublicUrl(key).data.publicUrl;
  }
}
