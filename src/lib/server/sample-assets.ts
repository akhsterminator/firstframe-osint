import fs from "node:fs/promises";
import path from "node:path";
import type { Store } from "../store";

/** Put the sample's frame where the store can serve it. */
export async function ensureSampleAssets(store: Store): Promise<void> {
  if (await store.getFile("sample/hero.jpg")) return;
  const buf = await fs.readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "assets/sample/hero.jpg"));
  await store.putFile("sample/hero.jpg", buf, "image/jpeg");
}
