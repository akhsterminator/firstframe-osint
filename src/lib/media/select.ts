/**
 * Frame selection and box maths with no runtime dependencies, shared by the
 * server (ffmpeg + sharp) and the browser (video element + canvas).
 */

export interface RawFrame<I = unknown> {
  t: number;
  image: I;
  dhash: string;
  sharpness: number;
}

const MAX_CANDIDATES = 24;
const DUPLICATE_DISTANCE = 8;
const IOU_THRESHOLD = 0.3;

export function hamming(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

export function candidateTimes(durationSec: number, scenes: number[], maxDurationSec = 600): number[] {
  const d = Math.max(0.1, Math.min(durationSec, maxDurationSec));
  // Opening frames and the moment just after each cut come first; the regular
  // grid only fills gaps, so it never crowds out a new shot.
  const priority = [0, Math.min(0.5, d / 4), ...scenes.map((s) => Math.min(d - 0.05, s + 0.15))];
  const grid = Array.from({ length: 9 }, (_, i) => (d * (i + 1)) / 10);
  const chosen: number[] = [];
  for (const t of [...priority, ...grid]) {
    if (t < 0 || t >= d) continue;
    if (chosen.some((c) => Math.abs(c - t) < 0.4)) continue;
    chosen.push(Math.round(t * 1000) / 1000);
  }
  chosen.sort((a, b) => a - b);
  if (chosen.length <= MAX_CANDIDATES) return chosen;
  const step = chosen.length / MAX_CANDIDATES;
  return Array.from({ length: MAX_CANDIDATES }, (_, i) => chosen[Math.floor(i * step)]!);
}

/**
 * Pick frames that are sharp, not black, not near-duplicates, and spread across
 * the clip. The earliest usable frame is always kept: it's the one most likely
 * to match an original upload before someone re-cut it.
 */
export function selectFrames<F extends RawFrame<unknown>>(frames: F[], max: number): F[] {
  const unique: F[] = [];
  for (const f of [...frames].sort((a, b) => a.t - b.t)) {
    const dup = unique.findIndex((u) => hamming(u.dhash, f.dhash) <= DUPLICATE_DISTANCE);
    if (dup === -1) unique.push(f);
    else if (f.sharpness > unique[dup]!.sharpness * 1.5 && dup !== 0) unique[dup] = f;
  }
  if (unique.length <= max) return unique;

  const first = unique[0]!;
  const rest = unique.slice(1);
  const span = rest[rest.length - 1]!.t - rest[0]!.t || 1;
  const buckets = max - 1;
  const chosen = new Set<F>([first]);
  for (let b = 0; b < buckets; b++) {
    const lo = rest[0]!.t + (span * b) / buckets;
    const hi = rest[0]!.t + (span * (b + 1)) / buckets;
    const inBucket = rest.filter((f) => f.t >= lo && (b === buckets - 1 ? f.t <= hi : f.t < hi));
    const best = inBucket.sort((x, y) => y.sharpness - x.sharpness)[0];
    if (best) chosen.add(best);
  }
  for (const f of [...rest].sort((x, y) => y.sharpness - x.sharpness)) {
    if (chosen.size >= max) break;
    chosen.add(f);
  }
  return [...chosen].sort((a, b) => a.t - b.t);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

export function nms(boxes: Box[], threshold = IOU_THRESHOLD): Box[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep: Box[] = [];
  for (const b of sorted) if (keep.every((k) => iou(k, b) < threshold)) keep.push(b);
  return keep;
}
