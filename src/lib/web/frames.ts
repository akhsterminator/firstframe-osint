import { candidateTimes, hamming, selectFrames, type RawFrame } from "../media/select";

export type CanvasFrame = RawFrame<HTMLCanvasElement>;

const MAX_WIDTH = 1280;
const CUT_DISTANCE = 18;

export function loadVideo(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.src = URL.createObjectURL(file);
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("This browser can't decode that video. Try an MP4 (H.264) or open it in Chrome."));
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    v.addEventListener("seeked", done);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05));
  });
}

function draw(v: HTMLVideoElement, width: number): HTMLCanvasElement {
  const scale = Math.min(1, width / v.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
  return c;
}

function grey(c: HTMLCanvasElement, w: number, h: number): Uint8ClampedArray {
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(c, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) out[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  return out;
}

/** Same 64-bit difference hash as the server, computed on a canvas. */
export function dhashCanvas(c: HTMLCanvasElement): string {
  const g = grey(c, 9, 8);
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (g[y * 9 + x]! > g[y * 9 + x + 1]! ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

function stats(c: HTMLCanvasElement): { sharpness: number; luma: number } {
  const w = 160;
  const h = Math.max(2, Math.round((c.height / c.width) * w));
  const g = grey(c, w, h);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let luma = 0;
  for (let i = 0; i < g.length; i++) luma += g[i]!;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i]! - g[i - 1]! - g[i + 1]! - g[i - w]! - g[i + w]!;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = n ? sum / n : 0;
  return { sharpness: n ? sumSq / n - mean * mean : 0, luma: luma / g.length };
}

/**
 * Keyframes in the browser: scan the clip at low resolution to find cuts, then
 * grab full frames just after each cut and on a grid, and keep the best.
 */
export async function extractFrames(
  file: Blob,
  onProgress?: (fraction: number) => void,
  max = 8,
): Promise<{ frames: CanvasFrame[]; duration: number; width: number; height: number }> {
  const v = await loadVideo(file);
  try {
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    const step = Math.max(0.25, duration / 100);
    const cuts: number[] = [];
    let prev: string | undefined;
    const scanSteps = Math.max(1, Math.floor(duration / step));
    for (let i = 0; i <= scanSteps; i++) {
      const t = i * step;
      await seek(v, t);
      const h = dhashCanvas(draw(v, 64));
      if (prev && hamming(prev, h) > CUT_DISTANCE) cuts.push(t);
      prev = h;
      onProgress?.((i / scanSteps) * 0.6);
    }

    const times = candidateTimes(duration, cuts);
    const grabbed: CanvasFrame[] = [];
    for (const [i, t] of times.entries()) {
      await seek(v, t);
      const canvas = draw(v, MAX_WIDTH);
      const s = stats(canvas);
      if (s.luma > 12 && s.luma < 248) grabbed.push({ t, image: canvas, dhash: dhashCanvas(canvas), sharpness: s.sharpness });
      onProgress?.(0.6 + (i / times.length) * 0.4);
    }
    if (!grabbed.length) throw new Error("Couldn't find any usable frames (all black or blank).");
    return { frames: selectFrames(grabbed, max), duration, width: v.videoWidth, height: v.videoHeight };
  } finally {
    URL.revokeObjectURL(v.src);
  }
}

export function toJpeg(c: HTMLCanvasElement, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
}

export async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
