import fs from "node:fs";
import path from "node:path";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import type { InferenceSession } from "onnxruntime-node";
import { nms, type Box } from "./select";

export { nms, type Box };

/**
 * Face *detection* for blurring. This module returns rectangles and nothing
 * else: no landmarks, no embeddings, no comparison. Every frame passes through
 * here before it is stored, so an unblurred face never leaves the worker.
 */

const INPUT_W = 320;
const INPUT_H = 240;
const SCORE_THRESHOLD = 0.55;

let session: Promise<InferenceSession> | undefined;

export function modelPath(): string {
  return process.env.FF_FACE_MODEL ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "assets/models/ultraface-rfb-320.onnx");
}

async function getSession(): Promise<InferenceSession> {
  if (!session) {
    session = (async () => {
      const file = modelPath();
      if (!fs.existsSync(file)) {
        throw new Error(
          `Face detector model not found at ${file}. FirstFrame will not publish frames without blurring faces. Run \`pnpm models\` to restore it.`,
        );
      }
      const ort = await import("onnxruntime-node");
      return ort.InferenceSession.create(file, { logSeverityLevel: 3 });
    })();
    session.catch(() => {
      session = undefined;
    });
  }
  return session;
}

async function detectIn(img: Sharp, offsetX: number, offsetY: number, w: number, h: number): Promise<Box[]> {
  const s = await getSession();
  const ort = await import("onnxruntime-node");
  const { data } = await img
    .clone()
    .extract({ left: offsetX, top: offsetY, width: w, height: h })
    .resize(INPUT_W, INPUT_H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const plane = INPUT_W * INPUT_H;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (data[i * 3]! - 127) / 128;
    input[plane + i] = (data[i * 3 + 1]! - 127) / 128;
    input[2 * plane + i] = (data[i * 3 + 2]! - 127) / 128;
  }
  const tensor = new ort.Tensor("float32", input, [1, 3, INPUT_H, INPUT_W]);
  const out = await s.run({ [s.inputNames[0]!]: tensor });
  const scores = out[s.outputNames[0]!]!.data as Float32Array;
  const boxes = out[s.outputNames[1]!]!.data as Float32Array;

  const found: Box[] = [];
  const n = scores.length / 2;
  for (let i = 0; i < n; i++) {
    const score = scores[i * 2 + 1]!;
    if (score < SCORE_THRESHOLD) continue;
    const x1 = Math.max(0, boxes[i * 4]!) * w + offsetX;
    const y1 = Math.max(0, boxes[i * 4 + 1]!) * h + offsetY;
    const x2 = Math.min(1, boxes[i * 4 + 2]!) * w + offsetX;
    const y2 = Math.min(1, boxes[i * 4 + 3]!) * h + offsetY;
    if (x2 - x1 < 4 || y2 - y1 < 4) continue;
    found.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1, score });
  }
  return found;
}

/**
 * Run the detector on the whole frame and on overlapping tiles, so small faces
 * in a wide shot are still caught. Misses are worse than false positives here.
 */
export async function detectFaces(image: Buffer): Promise<Box[]> {
  const img = sharp(image);
  const { width = 0, height = 0 } = await img.metadata();
  if (!width || !height) return [];

  const regions: [number, number, number, number][] = [[0, 0, width, height]];
  if (width >= 640 || height >= 640) {
    const cols = width >= height ? 3 : 2;
    const rows = width >= height ? 2 : 3;
    const tw = Math.ceil(width / cols);
    const th = Math.ceil(height / rows);
    const ox = Math.round(tw * 0.2);
    const oy = Math.round(th * 0.2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.max(0, c * tw - ox);
        const y = Math.max(0, r * th - oy);
        regions.push([x, y, Math.min(width - x, tw + 2 * ox), Math.min(height - y, th + 2 * oy)]);
      }
    }
  }

  const all: Box[] = [];
  for (const [x, y, w, h] of regions) all.push(...(await detectIn(img, x, y, w, h)));
  return nms(all);
}

/**
 * Replace each face with a soft elliptical mosaic. Pixelating first, then
 * blurring, removes detail that a plain Gaussian blur can leave recoverable.
 */
export async function blurBoxes(image: Buffer, boxes: Box[]): Promise<Buffer> {
  if (!boxes.length) return image;
  const base = sharp(image);
  const { width = 0, height = 0 } = await base.metadata();
  const layers: OverlayOptions[] = [];

  for (const b of boxes) {
    const padX = b.w * 0.3;
    const padY = b.h * 0.4;
    const left = Math.max(0, Math.floor(b.x - padX));
    const top = Math.max(0, Math.floor(b.y - padY));
    const w = Math.min(width - left, Math.ceil(b.w + 2 * padX));
    const h = Math.min(height - top, Math.ceil(b.h + 2 * padY));
    if (w < 2 || h < 2) continue;

    const blocks = Math.max(4, Math.round(w / 14));
    const mosaic = await sharp(image)
      .extract({ left, top, width: w, height: h })
      .resize(blocks, Math.max(4, Math.round((blocks * h) / w)), { kernel: "nearest" })
      .resize(w, h, { kernel: "nearest" })
      .blur(Math.max(2, w / 18))
      .ensureAlpha()
      .toBuffer();
    const mask = Buffer.from(
      `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#fff"/></svg>`,
    );
    const masked = await sharp(mosaic).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    layers.push({ input: masked, left, top });
  }
  return base.composite(layers).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export async function anonymise(image: Buffer): Promise<{ image: Buffer; faces: number }> {
  const boxes = await detectFaces(image);
  return { image: await blurBoxes(image, boxes), faces: boxes.length };
}
