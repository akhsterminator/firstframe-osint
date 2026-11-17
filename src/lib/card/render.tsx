import fs from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import sharp from "sharp";
import { config } from "../config";
import type { Store } from "../store";
import type { Report } from "../types";
import { Card, CARD_SIZES, type CardFormat } from "./Card";
import { cardModel } from "./model";
import { staticMap } from "./staticmap";

type FontSpec = { name: string; file: string; weight: 400 | 500 | 600; style: "normal" | "italic" };

const FONTS: FontSpec[] = [
  { name: "Geist", file: "geist-sans-latin-400-normal.woff", weight: 400, style: "normal" },
  { name: "Geist", file: "geist-sans-latin-500-normal.woff", weight: 500, style: "normal" },
  { name: "Geist", file: "geist-sans-latin-600-normal.woff", weight: 600, style: "normal" },
  { name: "Geist Mono", file: "geist-mono-latin-400-normal.woff", weight: 400, style: "normal" },
  { name: "Geist Mono", file: "geist-mono-latin-500-normal.woff", weight: 500, style: "normal" },
  { name: "Instrument Serif", file: "instrument-serif-latin-400-normal.woff", weight: 400, style: "normal" },
  { name: "Instrument Serif", file: "instrument-serif-latin-400-italic.woff", weight: 400, style: "italic" },
];

let fonts: Promise<{ name: string; data: Buffer; weight: FontSpec["weight"]; style: FontSpec["style"] }[]> | undefined;

function loadFonts() {
  fonts ??= Promise.all(
    FONTS.map(async (f) => ({
      name: f.name,
      weight: f.weight,
      style: f.style,
      data: await fs.readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "assets/fonts", f.file)),
    })),
  );
  return fonts;
}

async function dataUri(buf: Buffer, width: number, height: number): Promise<string> {
  // Render at 2x for crisp output, capped so huge frames don't bloat the SVG.
  const jpeg = await sharp(buf)
    .resize(Math.min(width * 2, 2000), Math.min(height * 2, 2000), { fit: "cover", position: "attention" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export function cardHost(): string {
  const base = config.publicBaseUrl;
  if (!base) return "firstframe";
  try {
    return new URL(base).host;
  } catch {
    return "firstframe";
  }
}

export async function renderCard(report: Report, format: CardFormat, store?: Store): Promise<Buffer> {
  const model = cardModel(report);
  const { width, height } = CARD_SIZES[format];
  const hero = report.frames.find((f) => f.id === model.heroFrameId);
  const heroBox = format === "og" ? { w: 500, h: 630 } : { w: width - 120, h: format === "story" ? 900 : 470 };

  const [heroBuf, mapBuf] = await Promise.all([
    hero && store ? store.getFile(hero.key) : Promise.resolve(undefined),
    model.where?.lat !== undefined && format !== "og"
      ? staticMap(model.where.lat, model.where.lon!, { width: 300, height: 224, zoom: 15, store }).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  const assets = {
    host: cardHost(),
    hero: heroBuf ? await dataUri(heroBuf, heroBox.w, heroBox.h) : undefined,
    map: mapBuf ? `data:image/png;base64,${mapBuf.toString("base64")}` : undefined,
  };

  const svg = await satori(<Card model={model} assets={assets} format={format} />, {
    width,
    height,
    fonts: await loadFonts(),
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng();
}
