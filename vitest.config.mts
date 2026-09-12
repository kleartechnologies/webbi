import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "test",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.appspot.com",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:1:web:test",
      NEXT_PUBLIC_SITE_URL: "https://webbi.my",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `import "server-only"` is a build-time guard in Next; it has no meaning under vitest.
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only.ts"),
    },
  },
});
