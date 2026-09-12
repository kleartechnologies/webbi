import { afterEach, describe, expect, it, vi } from "vitest";
import { PRICE_LABEL, PRICE_SEN, serverEnv } from "../env";

afterEach(() => vi.unstubAllEnvs());

describe("serverEnv.paymentProvider", () => {
  it("defaults to none so nothing can be marked paid without a real provider", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(serverEnv.paymentProvider).toBe("none");
    vi.stubEnv("PAYMENT_PROVIDER", "paypal");
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
});

describe("price", () => {
  it("is RM149.90 once", () => {
    expect(PRICE_SEN).toBe(14990);
    expect(PRICE_LABEL).toBe("RM149.90");
  });
});
