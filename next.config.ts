import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "media.example.com" },
      { protocol: "https", hostname: "**.cloudflarestream.com" }
    ]
  }
};

export default nextConfig;
