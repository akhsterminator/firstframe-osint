import { createElement, type ReactElement } from "react";
import { Card, CARD_SIZES, type CardFormat } from "../card/Card";
import { cardModel } from "../card/model";
import type { Report } from "../types";
import { asset } from "./paths";

const FONTS = [
  { name: "Geist", file: "geist-sans-latin-400-normal.woff", weight: 400 as const },
  { name: "Geist", file: "geist-sans-latin-500-normal.woff", weight: 500 as const },
  { name: "Geist", file: "geist-sans-latin-600-normal.woff", weight: 600 as const },
  { name: "Geist Mono", file: "geist-mono-latin-400-normal.woff", weight: 400 as const },
  { name: "Geist Mono", file: "geist-mono-latin-500-normal.woff", weight: 500 as const },
  { name: "Instrument Serif", file: "instrument-serif-latin-400-normal.woff", weight: 400 as const },
];

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" }[]> | undefined;

function loadFonts() {
  fonts ??= Promise.all(
    FONTS.map(async (f) => ({ name: f.name, weight: f.weight, style: "normal" as const, data: await (await fetch(asset(`/fonts/${f.file}`))).arrayBuffer() })),
  );
  return fonts;
}

function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the card"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't draw the card"));
    };
    img.src = url;
  });
}

export async function renderElement(element: ReactElement, width: number, height: number): Promise<Blob> {
  const { default: satori } = await import("satori");
  const svg = await satori(element, { width, height, fonts: await loadFonts() });
  return svgToPng(svg, width, height);
}

/** Render a report's card in the browser, using the same component as the server. */
export function renderCardInBrowser(report: Report, format: CardFormat, hero?: string, host = "firstframe", hostIsLink = false): Promise<Blob> {
  const { width, height } = CARD_SIZES[format];
  return renderElement(createElement(Card, { model: cardModel(report), assets: { hero, host, link: hostIsLink ? host : undefined }, format }), width, height);
}

export async function shareOrDownload(blob: Blob, filename: string, text?: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch {
      /* fall through to download */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return "downloaded";
}
