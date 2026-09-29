import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://backend:8000";
const enableBackendRewrites = process.env.ENABLE_BACKEND_REWRITES !== "false";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!enableBackendRewrites) {
      return [];
    }

    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
