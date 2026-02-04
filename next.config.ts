import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Warning: This allows production builds to complete even with TS errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
