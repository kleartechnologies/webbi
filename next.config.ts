import type { NextConfig } from "next";

/**
 * The image optimiser only fetches Webbi's own uploads: Firebase download URLs
 * for this project's bucket. Any other address is refused, so it can't be used
 * to fetch or resize images from elsewhere.
 */
const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: bucket ? `/v0/b/${bucket}/o/**` : "/v0/b/*/o/**" },
    ],
  },
};

export default nextConfig;
