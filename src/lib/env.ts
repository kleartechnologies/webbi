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
  /** OpenAI is the production AI provider. Set OPENAI_API_KEY on Netlify. */
  get openaiApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY || undefined;
  },
  get openaiModel(): string {
    return process.env.OPENAI_MODEL || "gpt-5-mini";
  },
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  },
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  },
  get firebaseServiceAccountBase64(): string | undefined {
    return process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || undefined;
  },
  /**
   * none    – payments not configured; Publish shows an honest "not yet" state.
   * billplz – Billplz (FPX and cards), Webbi's Malaysian provider. Verified by
   *           the signed callback, or by reading the bill back from Billplz.
   * stripe  – Stripe Checkout, kept as a second adapter behind the same interface.
   * mock    – local development only. Refused in production builds.
   *
   * Left unset, Billplz is chosen once all three of its credentials are set, so
   * the keys alone switch payments on. PAYMENT_PROVIDER=none keeps them off.
   */
  get paymentProvider(): "none" | "billplz" | "stripe" | "mock" {
    const value = process.env.PAYMENT_PROVIDER;
    if (value === "billplz") return "billplz";
    if (value === "stripe") return "stripe";
    if (value === "mock" && process.env.NODE_ENV !== "production") return "mock";
    if (
      !value &&
      process.env.BILLPLZ_SECRET_KEY &&
      process.env.BILLPLZ_COLLECTION_ID &&
      process.env.BILLPLZ_X_SIGNATURE_KEY
    ) {
      return "billplz";
    }
    return "none";
  },
  get stripeSecretKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY || undefined;
  },
  get stripeWebhookSecret(): string | undefined {
    return process.env.STRIPE_WEBHOOK_SECRET || undefined;
  },
  /** Billplz API secret key. HTTP Basic username; never leaves the server. */
  get billplzSecretKey(): string | undefined {
    return process.env.BILLPLZ_SECRET_KEY || undefined;
  },
  /** The collection every Webbi bill is created in. */
  get billplzCollectionId(): string | undefined {
    return process.env.BILLPLZ_COLLECTION_ID || undefined;
  },
  /** Shared key Billplz signs callbacks and redirects with. Server only. */
  get billplzXSignatureKey(): string | undefined {
    return process.env.BILLPLZ_X_SIGNATURE_KEY || undefined;
  },
  /** Defaults to production. A trailing slash is optional. */
  get billplzBaseUrl(): string {
    const value = (process.env.BILLPLZ_BASE_URL || BILLPLZ_PRODUCTION_API).trim();
    return value.replace(/\/+$/, "");
  },
};

/** Billplz production API. The sandbox host is refused in production builds. */
export const BILLPLZ_PRODUCTION_API = "https://www.billplz.com/api";

/** Price of one website, in Malaysian sen (RM149.90). */
export const PRICE_SEN = 14990;
export const PRICE_LABEL = "RM149.90";
