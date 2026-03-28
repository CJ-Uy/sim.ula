import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Keep browser-only packages out of the server/worker bundle entirely.
  // react-force-graph-2d and maplibre-gl access window/canvas at module init
  // which crashes the Cloudflare Workers V8 isolate.
  serverExternalPackages: [
    "react-force-graph-2d",
    "maplibre-gl",
  ],
};

export default nextConfig;
