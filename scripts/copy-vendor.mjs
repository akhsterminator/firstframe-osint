// Copy runtime files the browser loads directly into /public: the MapLibre tile
// worker, the ONNX Runtime wasm, the face model and card fonts.
import fs from "node:fs";
import path from "node:path";

const pkgDir = (name) => path.resolve("node_modules", name);
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

copy(path.join(pkgDir("maplibre-gl"), "dist/maplibre-gl-worker.mjs"), "public/vendor/maplibre-gl-worker.mjs");
for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  copy(path.join(pkgDir("onnxruntime-web"), "dist", f), `public/vendor/ort/${f}`);
}
copy("assets/models/ultraface-rfb-320.onnx", "public/models/ultraface-rfb-320.onnx");
for (const f of fs.readdirSync("assets/fonts").filter((n) => n.endsWith(".woff"))) {
  copy(path.join("assets/fonts", f), path.join("public/fonts", f));
}
