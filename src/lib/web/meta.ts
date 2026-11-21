import type { Metadata } from "next";
import { BASE_PATH, SITE_URL } from "./paths";

/** Per-page metadata with an absolute social image, which works on static hosts too. */
export function pageMeta(opts: { title: string; description: string; og: string; path: string }): Metadata {
  const image = `${SITE_URL}${BASE_PATH}/og/${opts.og}.png`;
  const url = `${SITE_URL}${BASE_PATH}${opts.path}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: SITE_URL ? { canonical: url } : undefined,
    openGraph: { title: opts.title, description: opts.description, url: SITE_URL ? url : undefined, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image] },
  };
}
