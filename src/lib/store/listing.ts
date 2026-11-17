import type { Report } from "../types";

export interface ReportListing {
  id: string;
  createdAt: string;
  status: Report["status"];
  platform: Report["source"]["platform"];
  title?: string;
  heroUrl?: string;
  headline?: string;
}

export function toListing(r: Report): ReportListing {
  const hero = r.frames.find((f) => f.id === r.heroFrameId) ?? r.frames[0];
  return {
    id: r.id,
    createdAt: r.createdAt,
    status: r.status,
    platform: r.source.platform,
    title: r.source.title,
    heroUrl: hero?.url,
    headline: r.findings[0]?.title,
  };
}
