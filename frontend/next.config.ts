import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    allowedDevOrigins: ["kupec.cloudpub.ru"],
  },
  typescript: {
    // ignoreBuildErrors: true,
  },
};

export default nextConfig;
