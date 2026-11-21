import type { InferenceSession } from "onnxruntime-web";
import { nms, type Box } from "../media/select";
import { asset } from "./paths";

/**
 * The same UltraFace detector the server uses, running in the browser via
 * ONNX Runtime Web. Detection only: it returns boxes, which are blurred.
 */

const W = 320;
const H = 240;
const THRESHOLD = 0.55;

let session: Promise<{ ort: typeof import("onnxruntime-web"); s: InferenceSession }> | undefined;

function getSession() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = asset("/vendor/ort/");
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = "error";
    const s = await ort.InferenceSession.create(asset("/models/ultraface-rfb-320.onnx"), { executionProviders: ["wasm"], logSeverityLevel: 3 });
    return { ort: ort as unknown as typeof import("onnxruntime-web"), s };
  })();
  session.catch(() => (session = undefined));
  return session;
}

async function detectIn(src: HTMLCanvasElement, x0: number, y0: number, w: number, h: number): Promise<Box[]> {
  const { ort, s } = await getSession();
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, x0, y0, w, h, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const plane = W * H;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (data[i * 4]! - 127) / 128;
    input[plane + i] = (data[i * 4 + 1]! - 127) / 128;
    input[2 * plane + i] = (data[i * 4 + 2]! - 127) / 128;
  }
  const out = await s.run({ [s.inputNames[0]!]: new ort.Tensor("float32", input, [1, 3, H, W]) });
  const scores = out[s.outputNames[0]!]!.data as Float32Array;
  const boxes = out[s.outputNames[1]!]!.data as Float32Array;
  const found: Box[] = [];
  for (let i = 0; i < scores.length / 2; i++) {
    const score = scores[i * 2 + 1]!;
    if (score < THRESHOLD) continue;
    const bx1 = Math.max(0, boxes[i * 4]!) * w + x0;
    const by1 = Math.max(0, boxes[i * 4 + 1]!) * h + y0;
    const bx2 = Math.min(1, boxes[i * 4 + 2]!) * w + x0;
    const by2 = Math.min(1, boxes[i * 4 + 3]!) * h + y0;
    if (bx2 - bx1 >= 4 && by2 - by1 >= 4) found.push({ x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1, score });
  }
  return found;
}

export async function detectFaces(c: HTMLCanvasElement): Promise<Box[]> {
  const { width, height } = c;
  const regions: [number, number, number, number][] = [[0, 0, width, height]];
  if (width >= 640 || height >= 640) {
    const cols = width >= height ? 3 : 2;
    const rows = width >= height ? 2 : 3;
    const tw = Math.ceil(width / cols);
    const th = Math.ceil(height / rows);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = Math.max(0, col * tw - tw * 0.2);
        const y = Math.max(0, r * th - th * 0.2);
        regions.push([x, y, Math.min(width - x, tw * 1.4), Math.min(height - y, th * 1.4)]);
      }
    }
  }
  const all: Box[] = [];
  for (const [x, y, w, h] of regions) all.push(...(await detectIn(c, x, y, w, h)));
  return nms(all);
}

/** Replace each face with a coarse elliptical mosaic, in place. */
export function blurFaces(c: HTMLCanvasElement, boxes: Box[]): void {
  const ctx = c.getContext("2d")!;
  for (const b of boxes) {
    const left = Math.max(0, Math.floor(b.x - b.w * 0.3));
    const top = Math.max(0, Math.floor(b.y - b.h * 0.4));
    const w = Math.min(c.width - left, Math.ceil(b.w * 1.6));
    const h = Math.min(c.height - top, Math.ceil(b.h * 1.8));
    if (w < 2 || h < 2) continue;
    const blocks = Math.max(4, Math.round(w / 14));
    const tiny = document.createElement("canvas");
    tiny.width = blocks;
    tiny.height = Math.max(4, Math.round((blocks * h) / w));
    tiny.getContext("2d")!.drawImage(c, left, top, w, h, 0, 0, tiny.width, tiny.height);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    if ("filter" in ctx) ctx.filter = `blur(${Math.max(2, Math.round(w / 18))}px)`;
    ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, left, top, w, h);
    ctx.restore();
  }
}

export async function anonymiseCanvas(c: HTMLCanvasElement): Promise<number> {
  const boxes = await detectFaces(c);
  blurFaces(c, boxes);
  return boxes.length;
}
