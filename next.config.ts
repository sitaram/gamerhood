import type { NextConfig } from "next";

/** Allow Next/Image to load Supabase Storage URLs for this project’s host. */
function supabaseStorageRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const u = new URL(raw);
    const protocol = u.protocol === "http:" ? "http" : "https";
    return [
      {
        protocol,
        hostname: u.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Lets you open http://127.0.0.1:3000 alongside localhost without Turbopack dev/HMR blocking.
  allowedDevOrigins: ["127.0.0.1"],

  images: {
    remotePatterns: [
      { hostname: "api.dicebear.com" },
      { hostname: "placehold.co" },
      { hostname: "images.unsplash.com" },
      ...supabaseStorageRemotePatterns(),
      // Fallback when env is missing in CI but hosts still use *.supabase.co
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Printful CDN — preview / mockup / catalog blank photos we surface in the
      // placement editor and product cards.
      { hostname: "files.cdn.printful.com" },
      { hostname: "*.cdn.printful.com" },
      { hostname: "printful.com" },
      { hostname: "*.printful.com" },
    ],
  },
};

export default nextConfig;
