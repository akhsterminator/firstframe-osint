import type { ReportStages } from "./types";

export function emptyStages(): ReportStages {
  return {
    ingest: { status: "pending" },
    keyframes: { status: "pending" },
    provenance: { status: "pending" },
    scene: { status: "pending" },
    geolocation: { status: "pending" },
    chronolocation: { status: "pending" },
    weather: { status: "pending" },
    integrity: { status: "pending" },
  };
}
