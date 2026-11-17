/**
 * Restore the bundled face-detector model if it's missing or corrupted.  pnpm models
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const URL_ = "https://raw.githubusercontent.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/master/models/onnx/version-RFB-320.onnx";
const SHA256 = "34cd7e60aeff28744c657de7a3dc64e872d506741de66987f3426f2b79f88017";
const dest = path.resolve("assets/models/ultraface-rfb-320.onnx");

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

if (fs.existsSync(dest) && sha(fs.readFileSync(dest)) === SHA256) {
  console.log("Face detector model is present and verified.");
  process.exit(0);
}

const res = await fetch(URL_);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
if (sha(buf) !== SHA256) throw new Error("Checksum mismatch; refusing to install the model.");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, buf);
console.log(`Installed ${path.relative(process.cwd(), dest)}`);
