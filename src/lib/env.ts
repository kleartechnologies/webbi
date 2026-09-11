/**
 * Environment access for Webbi.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
 * literally (never through a dynamic key). Server-only values are read lazily
 * so a missing key only fails the feature that needs it, with a clear message.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  firebase: {
    apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: required(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: required(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: required("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  },
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
} as const;

/** Server-only configuration. Never import this from a client component. */
export const serverEnv = {
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  },
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  },
  get firebaseServiceAccountBase64(): string | undefined {
    return process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || undefined;
  },
  get paymentProvider(): "none" | "stripe" {
    return process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "none";
  },
  get stripeSecretKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY || undefined;
  },
  get stripeWebhookSecret(): string | undefined {
    return process.env.STRIPE_WEBHOOK_SECRET || undefined;
  },
};

/** Price of one website, in Malaysian sen (RM149.90). */
export const PRICE_SEN = 14990;
export const PRICE_LABEL = "RM149.90";
