/**
 * Check what this install can do and what's missing.  pnpm doctor
 */
import fs from "node:fs";
import { modelPath } from "../src/lib/media/faces";
import { capabilities } from "../src/lib/server/capabilities";
import { config } from "../src/lib/config";

const ok = (s: string) => `  \x1b[38;5;78m✓\x1b[0m ${s}`;
const warn = (s: string, fix: string) => `  \x1b[38;5;215m!\x1b[0m ${s}\n      \x1b[2m${fix}\x1b[0m`;
const bad = (s: string, fix: string) => `  \x1b[38;5;203m✕\x1b[0m ${s}\n      \x1b[2m${fix}\x1b[0m`;

const caps = await capabilities();
const lines: string[] = ["", "  FirstFrame doctor", ""];

lines.push(caps.ffmpeg ? ok("ffmpeg") : bad("ffmpeg not found", "Install ffmpeg (brew install ffmpeg / apt install ffmpeg)"));
lines.push(caps.ytDlp ? ok("yt-dlp") : bad("yt-dlp not found", "pipx install yt-dlp — needed for links; file uploads still work"));
lines.push(fs.existsSync(modelPath()) ? ok("face detector model") : bad("face detector model missing", "pnpm models"));
lines.push(caps.scene ? ok(`scene reading (${config.visionModel})`) : warn("scene reading off", "Set ANTHROPIC_API_KEY. Without it there is no geolocation, sun or weather check."));
lines.push(
  caps.reverseSearch.length
    ? ok(`reverse search: ${caps.reverseSearch.join(", ")}`)
    : warn("reverse search off", "Set TINEYE_API_KEY and/or SERPAPI_KEY (SerpApi also needs public frame URLs)"),
);
if (config.serpApiKey && !caps.publicFrames) {
  lines.push(warn("SerpApi key set but frames aren't public", "Set PUBLIC_BASE_URL to a public URL, or configure Supabase storage"));
}
lines.push(caps.aiDetectors.length ? ok(`AI detectors: ${caps.aiDetectors.join(", ")}`) : warn("no AI detectors", "Optional: HIVE_API_KEY or SIGHTENGINE_USER + SIGHTENGINE_SECRET"));
lines.push(caps.c2patool ? ok("c2patool") : warn("c2patool not found", "Optional: cargo install c2patool, to read Content Credentials in full"));
lines.push(ok(`storage: ${caps.storage}`));
lines.push("");
console.log(lines.join("\n"));
