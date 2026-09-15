import type { NextConfig } from "next";
import { firebaseAuthRewrites } from "./src/lib/firebase/authHandler";
import { securityHeaderRules } from "./src/lib/security/headers";

/**
 * The image optimiser only fetches Webbi's own uploads: Firebase download URLs
 * for this project's bucket. Any other address is refused, so it can't be used
 * to fetch or resize images from elsewhere.
 */
const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Browser security headers (CSP, framing, HSTS…): the one place they're set. See src/lib/security/headers.ts.
  async headers() {
    return securityHeaderRules({
      dev: process.env.NODE_ENV === "development",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      appCheck: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY),
    });
  },
  // Firebase Auth's Google sign-in handler, proxied so it can run on Webbi's own
  // domain. A Next.js rewrite, not a netlify.toml proxy: on Netlify the Next.js
  // function answers every path before netlify.toml rules are read.
  // See src/lib/firebase/authHandler.ts.
  async rewrites() {
    return {
      beforeFiles: firebaseAuthRewrites(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: bucket ? `/v0/b/${bucket}/o/**` : "/v0/b/*/o/**" },
    ],
  },
};

export default nextConfig;
