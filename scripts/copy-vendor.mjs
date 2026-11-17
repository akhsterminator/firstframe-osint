// MapLibre runs its tile worker from a separate file. Bundlers don't always emit
// it, so we serve a copy from /public and point MapLibre at it explicitly.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkg = path.dirname(require.resolve("maplibre-gl/package.json"));
const out = path.resolve("public/vendor");
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(pkg, "dist/maplibre-gl-worker.mjs"), path.join(out, "maplibre-gl-worker.mjs"));
