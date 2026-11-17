import sharp from "sharp";
import { config } from "../config";
import { http } from "../util/http";
import { pool } from "../util/async";
import type { Store } from "../store";

const TILE = 256;

function project(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n * TILE;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE;
  return { x, y };
}

async function tile(store: Store | undefined, z: number, x: number, y: number): Promise<Buffer | undefined> {
  const n = 2 ** z;
  const wx = ((x % n) + n) % n;
  if (y < 0 || y >= n) return undefined;
  const key = `tiles/${z}/${wx}/${y}.png`;
  const cached = await store?.getFile(key).catch(() => undefined);
  if (cached) return cached;
  const url = config.tileUrl.replace("{z}", String(z)).replace("{x}", String(wx)).replace("{y}", String(y));
  try {
    const res = await http(url, { timeoutMs: 8_000 });
    const buf = Buffer.from(await res.arrayBuffer());
    await store?.putFile(key, buf, "image/png").catch(() => {});
    return buf;
  } catch {
    return undefined;
  }
}

/**
 * A small greyscale map centred on a point, stitched from standard XYZ tiles.
 * Tiles are cached so repeat renders don't hit the tile server.
 */
export async function staticMap(
  lat: number,
  lon: number,
  opts: { width: number; height: number; zoom?: number; store?: Store },
): Promise<Buffer | undefined> {
  if (config.tileUrl === "off") return undefined;
  const z = opts.zoom ?? 15;
  const c = project(lat, lon, z);
  const left = Math.floor(c.x - opts.width / 2);
  const top = Math.floor(c.y - opts.height / 2);
  const tx0 = Math.floor(left / TILE);
  const ty0 = Math.floor(top / TILE);
  const tx1 = Math.floor((left + opts.width) / TILE);
  const ty1 = Math.floor((top + opts.height) / TILE);

  const coords: [number, number][] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) coords.push([tx, ty]);
  const tiles = await pool(coords, 4, ([tx, ty]) => tile(opts.store, z, tx, ty));
  if (tiles.some((t) => !t)) return undefined;

  const canvasW = (tx1 - tx0 + 1) * TILE;
  const canvasH = (ty1 - ty0 + 1) * TILE;
  const stitched = await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: "#eeeeee" } })
    .composite(coords.map(([tx, ty], i) => ({ input: tiles[i]!, left: (tx - tx0) * TILE, top: (ty - ty0) * TILE })))
    .png()
    .toBuffer();
  return sharp(stitched)
    .extract({ left: left - tx0 * TILE, top: top - ty0 * TILE, width: opts.width, height: opts.height })
    .greyscale()
    .linear(0.9, 18)
    .png()
    .toBuffer();
}
