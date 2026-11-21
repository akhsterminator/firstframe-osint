import type { NextConfig } from "next";

/**
 * Two builds from one codebase:
 *
 *  - Static (FF_STATIC=1): everything runs in the visitor's browser. Deploys to
 *    GitHub Pages or any static host. Server-only files (*.server.ts/tsx) are
 *    left out because they don't match the page extensions.
 *  - Server (default): adds link downloads with yt-dlp, automated reverse search,
 *    stored reports and the JSON/SSE API.
 */
const isStatic = process.env.FF_STATIC === "1";
const basePath = isStatic ? (process.env.FF_BASE_PATH ?? "") : "";

const config: NextConfig = {
  ...(isStatic
    ? { output: "export", trailingSlash: true, basePath, pageExtensions: ["tsx", "ts"] }
    : {
        output: "standalone",
        pageExtensions: ["server.tsx", "server.ts", "tsx", "ts"],
        serverExternalPackages: ["sharp", "onnxruntime-node", "@resvg/resvg-js", "satori"],
        outputFileTracingIncludes: { "/**": ["./assets/**/*"] },
      }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC: isStatic ? "1" : "",
    NEXT_PUBLIC_SITE_URL: process.env.PUBLIC_BASE_URL ?? process.env.FF_SITE_URL ?? "",
  },
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default config;
