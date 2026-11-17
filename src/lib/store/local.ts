import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import type { Report } from "../types";
import type { Store } from "./index";
import { toListing, type ReportListing } from "./listing";

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;

export class LocalStore implements Store {
  readonly kind = "local" as const;

  constructor(private readonly root: string) {}

  private reportPath(id: string) {
    if (!/^[a-z0-9]{4,32}$/i.test(id)) throw new Error("invalid report id");
    return path.join(this.root, "reports", `${id}.json`);
  }

  private filePath(key: string) {
    if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("invalid file key");
    return path.join(this.root, "files", key);
  }

  async getReport(id: string): Promise<Report | undefined> {
    try {
      return JSON.parse(await fs.readFile(this.reportPath(id), "utf8")) as Report;
    } catch {
      return undefined;
    }
  }

  async saveReport(report: Report): Promise<void> {
    const file = this.reportPath(report.id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(report));
    await fs.rename(tmp, file);
  }

  private async all(): Promise<Report[]> {
    const dir = path.join(this.root, "reports");
    let names: string[] = [];
    try {
      names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
    } catch {
      return [];
    }
    const reports = await Promise.all(names.map((n) => this.getReport(n.slice(0, -5))));
    return reports.filter((r): r is Report => !!r);
  }

  async findBySourceKey(key: string, maxAgeHours: number): Promise<Report | undefined> {
    const cutoff = Date.now() - maxAgeHours * 3_600_000;
    return (await this.all())
      .filter((r) => r.sourceKey === key && r.status !== "failed" && Date.parse(r.createdAt) >= cutoff)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  async listRecent(limit: number): Promise<ReportListing[]> {
    return (await this.all())
      .filter((r) => r.status === "done" && !r.sample)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toListing);
  }

  async putFile(key: string, data: Buffer): Promise<string> {
    const file = this.filePath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return `/api/files/${key}`;
  }

  async getFile(key: string): Promise<Buffer | undefined> {
    try {
      return await fs.readFile(this.filePath(key));
    } catch {
      return undefined;
    }
  }

  publicUrl(key: string): string | undefined {
    const base = config.publicBaseUrl;
    if (!base || /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(base)) return undefined;
    return `${base}/api/files/${key}`;
  }
}
