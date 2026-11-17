import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "onnxruntime-node", "@resvg/resvg-js", "satori"],
  outputFileTracingIncludes: {
    "/**": ["./assets/**/*"],
  },
  images: { unoptimized: true },
};

export default config;
