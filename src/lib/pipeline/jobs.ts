import { config } from "../config";
import { getStore } from "../store";
import type { Claim, Report, SourceInfo } from "../types";
import { reportId } from "../util/id";
import { emptyStages, runPipeline, type PipelineSource } from "./run";

type Listener = (report: Report) => void;

interface JobState {
  queue: { report: Report; source: PipelineSource }[];
  active: number;
  listeners: Map<string, Set<Listener>>;
  live: Map<string, Report>;
}

// Route handlers can be loaded more than once in dev; keep one job table per process.
const g = globalThis as unknown as { __ffJobs?: JobState };
const state: JobState = (g.__ffJobs ??= { queue: [], active: 0, listeners: new Map(), live: new Map() });

function emit(report: Report) {
  state.live.set(report.id, report);
  for (const l of state.listeners.get(report.id) ?? []) l(report);
  if (report.status === "done" || report.status === "failed") {
    setTimeout(() => state.live.delete(report.id), 60_000);
  }
}

export function subscribe(id: string, listener: Listener): () => void {
  let set = state.listeners.get(id);
  if (!set) state.listeners.set(id, (set = new Set()));
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (!set!.size) state.listeners.delete(id);
  };
}

/** The in-memory copy is fresher than storage while a job is running. */
export function liveReport(id: string): Report | undefined {
  return state.live.get(id);
}

export function queuePosition(id: string): number {
  return state.queue.findIndex((j) => j.report.id === id) + 1;
}

function pump() {
  while (state.active < config.maxConcurrentJobs && state.queue.length) {
    const job = state.queue.shift()!;
    state.active++;
    runPipeline(job.report, job.source, { store: getStore(), onUpdate: emit })
      .catch(() => {})
      .finally(() => {
        state.active--;
        pump();
      });
  }
}

export function newReport(source: SourceInfo, sourceKey: string, claim?: Claim): Report {
  const now = new Date().toISOString();
  return {
    id: reportId(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: "queued",
    sourceKey,
    source,
    claim: claim && (claim.place || claim.date) ? claim : undefined,
    frames: [],
    stages: emptyStages(),
    findings: [],
  };
}

export async function enqueue(report: Report, source: PipelineSource): Promise<void> {
  await getStore().saveReport(report);
  state.live.set(report.id, report);
  state.queue.push({ report, source });
  pump();
}
