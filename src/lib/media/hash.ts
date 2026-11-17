import sharp from "sharp";

/** 64-bit difference hash. Robust to scaling and recompression, cheap to compare. */
export async function dhash(input: Buffer): Promise<string> {
  const { data } = await sharp(input)
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x]!;
      const right = data[y * 9 + x + 1]!;
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export function hamming(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/**
 * Variance of the Laplacian on a downscaled greyscale copy. Higher is sharper.
 * Used to prefer crisp frames over motion-blurred ones.
 */
export async function sharpness(input: Buffer): Promise<number> {
  const { data, info } = await sharp(input)
    .greyscale()
    .resize(320, 320, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Mean luma 0..255, used to skip black and blown-out frames. */
export async function meanLuma(input: Buffer): Promise<number> {
  const { channels } = await sharp(input).greyscale().stats();
  return channels[0]?.mean ?? 0;
}
