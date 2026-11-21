/**
 * Regenerate every static image: page link previews, the sample cards, the
 * README images and the GitHub social preview.  pnpm images
 */
import fs from "node:fs/promises";
import { createElement } from "react";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { renderCard } from "../src/lib/card/render";
import { PageOg, TimeCard } from "../src/lib/card/TimeCard";
import { idAnatomy } from "../src/lib/ingest/post-id";
import { parseSourceUrl } from "../src/lib/ingest/url";
import { sampleReport } from "../src/lib/sample";
import { ensureSampleAssets } from "../src/lib/server/sample-assets";
import { getStore } from "../src/lib/store";

process.env.FF_TILE_URL ??= "off";

const FONTS = [
  ["Geist", "geist-sans-latin-400-normal.woff", 400],
  ["Geist", "geist-sans-latin-500-normal.woff", 500],
  ["Geist", "geist-sans-latin-600-normal.woff", 600],
  ["Geist Mono", "geist-mono-latin-400-normal.woff", 400],
  ["Geist Mono", "geist-mono-latin-500-normal.woff", 500],
  ["Instrument Serif", "instrument-serif-latin-400-normal.woff", 400],
] as const;
const fonts = await Promise.all(FONTS.map(async ([name, file, weight]) => ({ name, weight, style: "normal" as const, data: await fs.readFile(`assets/fonts/${file}`) })));

async function png(el: React.ReactElement, width: number, height: number, out: string) {
  const svg = await satori(el, { width, height, fonts });
  await fs.writeFile(out, new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng());
  console.log(out);
}

await fs.mkdir("public/og", { recursive: true });
await fs.mkdir("public/sample", { recursive: true });
await fs.mkdir("docs/img", { recursive: true });
await fs.copyFile("assets/sample/hero.jpg", "public/sample/hero.jpg");

const store = getStore();
await ensureSampleAssets(store);
for (const format of ["portrait", "story", "og"] as const) {
  const buf = await renderCard(sampleReport(), format, store);
  await fs.writeFile(`public/sample/card-${format}.png`, buf);
  await fs.writeFile(`docs/img/sample-${format}.png`, buf);
  console.log(`public/sample/card-${format}.png`);
}

const cardUri = `data:image/png;base64,${(await fs.readFile("public/sample/card-portrait.png")).toString("base64")}`;
const heroUri = `data:image/jpeg;base64,${(await fs.readFile("assets/sample/hero.jpg")).toString("base64")}`;

const demoLink = "https://www.tiktok.com/@someone/video/7106594312292453675";
const demo = parseSourceUrl(demoLink)!;
const anatomy = idAnatomy("tiktok", demo.postId!)!;
const NOW = Date.UTC(2026, 10, 21);

const cardVisual = (
  <div style={{ display: "flex", width: 360, height: 450, marginTop: 20, transform: "rotate(2deg)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", borderRadius: 10, overflow: "hidden" }}>
    <img src={cardUri} width={360} height={450} />
  </div>
);

const bitsVisual = (
  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, width: 380 }}>
    {[0, 1, 2, 3].map((r) => (
      <div key={r} style={{ display: "flex", gap: 4 }}>
        {anatomy.bits.slice(r * 16, r * 16 + 16).split("").map((b, i) => {
          const idx = r * 16 + i;
          const ts = idx >= anatomy.timestamp[0] && idx < anatomy.timestamp[1];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 19, height: 28, borderRadius: 4, fontFamily: "Geist Mono", fontSize: 13, backgroundColor: ts ? (b === "1" ? "#FF5B3D" : "#4A2219") : b === "1" ? "#3A3833" : "#1C1C19", color: ts ? "#ECE9E1" : "#5D5A53" }}>
              {b}
            </div>
          );
        })}
      </div>
    ))}
    <div style={{ display: "flex", marginTop: 18, fontFamily: "Instrument Serif", fontSize: 54, color: "#ECE9E1" }}>7 June 2022</div>
    <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 22, color: "#8F8A80" }}>20:15:27 UTC</div>
  </div>
);

const chip = (t: string, red = false) => (
  <div style={{ display: "flex", padding: "10px 18px", borderRadius: 40, border: `2px solid ${red ? "#FF5B3D" : "#3A3833"}`, fontFamily: "Geist", fontSize: 24, color: red ? "#FF5B3D" : "#ECE9E1" }}>{t}</div>
);
const whereVisual = (
  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, width: 400 }}>
    <div style={{ display: "flex", gap: 10 }}>{chip("Church")}{chip("+ Roundabout")}</div>
    <div style={{ display: "flex", gap: 10 }}>{chip("+ River")}{chip("≤ 200 m")}</div>
    <div style={{ display: "flex", position: "relative", width: 400, height: 230, marginTop: 10, borderRadius: 14, backgroundColor: "#151513", border: "2px solid #2A2925" }}>
      {[[60, 80], [150, 150], [250, 60], [330, 170], [110, 190], [290, 120]].map(([x, y], i) => (
        <div key={i} style={{ display: "flex", position: "absolute", left: x, top: y, width: i === 0 ? 26 : 16, height: i === 0 ? 26 : 16, borderRadius: 26, backgroundColor: i === 0 ? "#FF5B3D" : "#5D5A53", border: "3px solid #ECE9E1" }} />
      ))}
    </div>
  </div>
);

const verifyVisual = (
  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, width: 420 }}>
    <div style={{ display: "flex", borderRadius: 10, overflow: "hidden" }}>
      <img src={heroUri} width={420} height={236} />
    </div>
    {["Online since 9 Oct 2021", "Scene fits Bewdley, not Hereford", "Weather doesn't match records"].map((t) => (
      <div key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, backgroundColor: "#FF5B3D" }} />
        <div style={{ display: "flex", fontFamily: "Geist", fontSize: 22, color: "#ECE9E1" }}>{t}</div>
      </div>
    ))}
  </div>
);

await png(<PageOg eyebrow="Video verification" title="Everyone shared it. Nobody checked." subtitle="When it was really posted, where it was filmed, and whether the sun and the weather match." visual={cardVisual} />, 1200, 630, "public/og/home.png");
await png(<PageOg eyebrow="When · instant" title="Every post link hides the second it was posted." subtitle="Paste a TikTok, X or Instagram link. See when it really went up." visual={bitsVisual} />, 1200, 630, "public/og/when.png");
await png(<PageOg eyebrow="Where · scene search" title="Describe a scene. Find everywhere it fits." subtitle="Pick what you can see. Get every match on OpenStreetMap." visual={whereVisual} />, 1200, 630, "public/og/where.png");
await png(<PageOg eyebrow="Verify · in your browser" title="Is this video what they say it is?" subtitle="Frames, faces blurred, metadata, map, sun, weather, and a card to post." visual={verifyVisual} />, 1200, 630, "public/og/verify.png");

// GitHub's social preview is 1280×640; reuse the home layout with margins.
await png(
  <div style={{ display: "flex", width: 1280, height: 640, backgroundColor: "#0D0D0C", alignItems: "center", justifyContent: "center" }}>
    <PageOg eyebrow="Open-source video verification" title="Everyone shared it. Nobody checked." subtitle="When it was really posted, where it was filmed, whether the sun and the weather match." visual={cardVisual} />
  </div>,
  1280,
  640,
  "docs/img/social-preview.png",
);

const entries = [{ platform: "TikTok", postId: demo.postId!, at: demo.idTime!, bits: anatomy.bits, timestamp: anatomy.timestamp }];
await png(createElement(TimeCard, { entries, host: "firstframe /when", now: NOW }), 1080, 1350, "docs/img/when-card.png");
