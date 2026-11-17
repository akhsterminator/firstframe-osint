/**
 * Run a verification from the terminal.
 *
 *   pnpm ff <url-or-file> [--place "Valencia"] [--date 2024-10-29] [--card card.png] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { renderCard } from "../src/lib/card/render";
import { config } from "../src/lib/config";
import { parseSourceUrl } from "../src/lib/ingest/url";
import { newReport } from "../src/lib/pipeline/jobs";
import { runPipeline } from "../src/lib/pipeline/run";
import { getStore } from "../src/lib/store";
import { STAGE_LABELS, STAGE_ORDER, type Report, type StageStatus } from "../src/lib/types";
import { formatDay } from "../src/lib/util/dates";
import { formatCoord } from "../src/lib/util/geo";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[38;5;203m${s}\x1b[0m`,
  amber: (s: string) => `\x1b[38;5;215m${s}\x1b[0m`,
  green: (s: string) => `\x1b[38;5;78m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[38;5;111m${s}\x1b[0m`,
};

const ICON: Record<StageStatus, string> = { pending: c.dim("·"), running: c.blue("●"), done: c.green("✓"), skipped: c.dim("–"), error: c.red("✕") };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    place: { type: "string" },
    date: { type: "string" },
    card: { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const input = positionals[0];
if (!input || values.help) {
  console.log(`Usage: pnpm ff <url-or-file> [--place "City"] [--date YYYY-MM-DD] [--card out.png] [--json]`);
  process.exit(input ? 0 : 1);
}

const claim = { place: values.place, date: values.date };
const isFile = fs.existsSync(input);
let report: Report;
let source: Parameters<typeof runPipeline>[1];

if (isFile) {
  const abs = path.resolve(input);
  const copy = path.join(path.dirname(abs), `.ff-${Date.now()}${path.extname(abs)}`);
  fs.copyFileSync(abs, copy);
  report = newReport({ input: path.basename(abs), platform: "upload" }, `file:${abs}`, claim);
  source = { kind: "file", path: copy, name: path.basename(abs) };
} else {
  const parsed = parseSourceUrl(input);
  if (!parsed) {
    console.error(c.red("That doesn't look like a URL or a file."));
    process.exit(1);
  }
  report = newReport({ input, platform: parsed.platform, canonicalUrl: parsed.url, postId: parsed.postId }, parsed.key, claim);
  source = { kind: "url", url: parsed.url };
}

const tty = process.stdout.isTTY && !values.json;
let drawn = 0;
function draw(r: Report) {
  if (!tty) return;
  if (drawn) process.stdout.write(`\x1b[${drawn}A`);
  const lines = STAGE_ORDER.map((id) => {
    const s = r.stages[id];
    const note = s.status === "error" ? c.red(` ${s.error}`) : s.status === "skipped" ? c.dim(` ${s.note}`) : "";
    return `\x1b[2K  ${ICON[s.status]} ${s.status === "pending" ? c.dim(STAGE_LABELS[id]) : STAGE_LABELS[id]}${note}`.slice(0, 160);
  });
  process.stdout.write(lines.join("\n") + "\n");
  drawn = lines.length;
}

if (tty) console.log(`\n  ${c.bold("FirstFrame")} ${c.dim(input)}\n`);
const store = getStore();
const done = await runPipeline(report, source, { store, onUpdate: draw });
draw(done);

if (values.json) {
  console.log(JSON.stringify(done, null, 2));
} else {
  console.log();
  if (done.status === "failed") console.log(`  ${c.red("Stopped:")} ${done.error}\n`);
  for (const f of done.findings) {
    const tone = f.tone === "alert" ? c.red : f.tone === "caution" ? c.amber : f.tone === "ok" ? c.green : (s: string) => s;
    console.log(`  ${tone("■")} ${c.bold(tone(f.title))}\n    ${c.dim(f.detail)}\n`);
  }
  const prov = done.stages.provenance.data;
  if (prov?.matches.length) {
    console.log(`  ${c.dim("Earliest copies")}`);
    for (const m of prov.matches.filter((x) => x.firstSeen).slice(0, 5)) {
      console.log(`    ${formatDay(m.firstSeen!).padEnd(12)} ${m.domain.padEnd(24)} ${c.dim(m.url.slice(0, 70))}`);
    }
    console.log();
  }
  const geo = done.stages.geolocation.data;
  if (geo?.candidates.length) {
    console.log(`  ${c.dim("Map candidates")}`);
    for (const g of geo.candidates.slice(0, 5)) {
      console.log(`    ${String(Math.round(g.score * 100)).padStart(3)}%  ${g.label.padEnd(32).slice(0, 32)} ${c.dim(formatCoord(g.lat, g.lon))}`);
    }
    if (geo.searches[0]) console.log(`    ${c.blue(geo.searches.find((s) => s.status === "ok")?.overpassTurboUrl.slice(0, 60) ?? "")}…`);
    console.log();
  }
  const where = store.kind === "local" ? path.join(config.dataDir, "reports") : "Supabase";
  console.log(c.dim(`  ${((done.elapsedMs ?? 0) / 1000).toFixed(1)}s · report ${done.id} · saved to ${where}\n`));
}

if (values.card) {
  fs.writeFileSync(values.card, await renderCard(done, "portrait", store));
  if (!values.json) console.log(`  Card written to ${values.card}\n`);
}
process.exit(done.status === "done" ? 0 : 1);
