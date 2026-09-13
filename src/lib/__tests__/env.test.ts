import { afterEach, describe, expect, it, vi } from "vitest";
import { BILLPLZ_PRODUCTION_API, PRICE_LABEL, PRICE_SEN, serverEnv } from "../env";

afterEach(() => vi.unstubAllEnvs());

const BILLPLZ_KEYS = ["BILLPLZ_SECRET_KEY", "BILLPLZ_COLLECTION_ID", "BILLPLZ_X_SIGNATURE_KEY"] as const;
const setBillplzKeys = (value: string) => BILLPLZ_KEYS.forEach((name) => vi.stubEnv(name, value));

describe("serverEnv.paymentProvider", () => {
  it("defaults to none so nothing can be marked paid without a real provider", () => {
    setBillplzKeys("");
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(serverEnv.paymentProvider).toBe("none");
    vi.stubEnv("PAYMENT_PROVIDER", "paypal");
    expect(serverEnv.paymentProvider).toBe("none");
  });

  it("picks billplz when PAYMENT_PROVIDER is unset and all three Billplz keys are set", () => {
    setBillplzKeys("set");
    vi.stubEnv("PAYMENT_PROVIDER", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(serverEnv.paymentProvider).toBe("billplz");
  });

  it("stays none while any Billplz key is missing", () => {
    for (const missing of BILLPLZ_KEYS) {
      setBillplzKeys("set");
      vi.stubEnv(missing, "");
      vi.stubEnv("PAYMENT_PROVIDER", "");
      expect(serverEnv.paymentProvider, missing).toBe("none");
    }
  });

  it("lets an explicit PAYMENT_PROVIDER win over the Billplz keys", () => {
    setBillplzKeys("set");
    vi.stubEnv("PAYMENT_PROVIDER", "none");
    expect(serverEnv.paymentProvider).toBe("none");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    expect(serverEnv.paymentProvider).toBe("stripe");
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "production");
    expect(serverEnv.paymentProvider).toBe("none");
  });

  it("allows stripe anywhere but the mock only outside production", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    expect(serverEnv.paymentProvider).toBe("stripe");
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "development");
    expect(serverEnv.paymentProvider).toBe("mock");
    vi.stubEnv("NODE_ENV", "production");
    expect(serverEnv.paymentProvider).toBe("none");
  });

  it("allows billplz in production", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "billplz");
    vi.stubEnv("NODE_ENV", "production");
    expect(serverEnv.paymentProvider).toBe("billplz");
  });
});

describe("Billplz settings", () => {
  it("default to the production API, with or without a trailing slash", () => {
    expect(BILLPLZ_PRODUCTION_API).toBe("https://www.billplz.com/api");
    vi.stubEnv("BILLPLZ_BASE_URL", "");
    expect(serverEnv.billplzBaseUrl).toBe("https://www.billplz.com/api");
    vi.stubEnv("BILLPLZ_BASE_URL", "https://www.billplz.com/api/");
    expect(serverEnv.billplzBaseUrl).toBe("https://www.billplz.com/api");
  });

  it("come from the variable names set in Netlify, and empty means unset", () => {
    vi.stubEnv("BILLPLZ_SECRET_KEY", "k1");
    vi.stubEnv("BILLPLZ_COLLECTION_ID", "k2");
    vi.stubEnv("BILLPLZ_X_SIGNATURE_KEY", "k3");
    expect([serverEnv.billplzSecretKey, serverEnv.billplzCollectionId, serverEnv.billplzXSignatureKey]).toEqual(["k1", "k2", "k3"]);
    vi.stubEnv("BILLPLZ_SECRET_KEY", "");
    expect(serverEnv.billplzSecretKey).toBeUndefined();
  });
});

describe("price", () => {
  it("is RM149.90 once", () => {
    expect(PRICE_SEN).toBe(14990);
    expect(PRICE_LABEL).toBe("RM149.90");
  });
});
