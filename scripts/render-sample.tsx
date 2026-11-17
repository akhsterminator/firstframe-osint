/**
 * Regenerate the sample cards used in the README.  pnpm tsx scripts/render-sample.tsx
 */
import fs from "node:fs/promises";
import { renderCard } from "../src/lib/card/render";
import { ensureSampleAssets, sampleReport } from "../src/lib/sample";
import { getStore } from "../src/lib/store";

const store = getStore();
await ensureSampleAssets(store);
await fs.mkdir("docs/img", { recursive: true });
for (const format of ["portrait", "story", "og"] as const) {
  await fs.writeFile(`docs/img/sample-${format}.png`, await renderCard(sampleReport(), format, store));
  console.log(`docs/img/sample-${format}.png`);
}
