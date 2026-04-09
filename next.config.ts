import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "api.dicebear.com" },
      { hostname: "placehold.co" },
      { hostname: "images.unsplash.com" },
      { hostname: "replicate.delivery" },
      { hostname: "pbxt.replicate.delivery" },
    ],
  },
};

export default nextConfig;
