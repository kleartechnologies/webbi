import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import type { RawAuthUser } from "@/lib/auth/accounts";
import { adminJson, forbiddenKeys, toAccountDto, toPaymentDto, toSiteRowDto } from "../dto";

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => {
    throw new Error("DTOs never read Firestore");
  },
  getAdminApp: () => {
    throw new Error("DTOs never use the Admin app");
  },
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {},
}));

/** Everything Identity Toolkit can return for an account, sensitive fields included. */
const RAW_USER = {
  localId: "uid-1",
  email: "someone@example.com",
  displayName: "Someone",
  emailVerified: true,
  disabled: false,
  passwordHash: "UkVEQUNURUQ=",
  salt: "c2FsdA==",
  passwordUpdatedAt: 1700000000000,
  customAttributes: '{"webbiRole":"owner"}',
  providerUserInfo: [
    { providerId: "google.com", rawId: "1234", federatedId: "1234", email: "someone@example.com" },
    { providerId: "password", rawId: "someone@example.com" },
  ],
  validSince: "1700000000",
  createdAt: "1700000000000",
  lastLoginAt: "1700000500000",
  lastRefreshAt: "2026-09-15T00:00:00.000Z",
  tenantId: "t",
  mfaInfo: [{ phoneInfo: "+60123" }],
} as unknown as RawAuthUser;

describe("account DTO", () => {
  it("copies only whitelisted fields", () => {
    const dto = toAccountDto(RAW_USER);
    expect(dto).toEqual({
      uid: "uid-1",
      name: "Someone",
      email: "someone@example.com",
      providers: ["google.com", "password"],
      emailVerified: true,
      disabled: false,
      createdAt: new Date(1700000000000).toISOString(),
      lastLoginAt: new Date(1700000500000).toISOString(),
    });
    const text = JSON.stringify(dto);
    for (const leak of ["UkVEQUNURUQ", "c2FsdA", "webbiRole", "1234", "+60123", "passwordHash", "salt", "customAttributes", "providerUserInfo"]) {
      expect(text).not.toContain(leak);
    }
  });
});

describe("payment DTO", () => {
  it("never carries the checkout URL and names the bill id", () => {
    const dto = toPaymentDto("pay-1", {
      siteId: "site-1",
      ownerUid: "uid-1",
      amountSen: 14990,
      currency: "myr",
      provider: "billplz",
      providerRef: "bill123",
      status: "paid",
      checkoutUrl: "https://www.billplz.com/bills/bill123",
      needsAttention: true,
      attentionReason: "duplicate",
      paidAt: Timestamp.fromMillis(1700000000000),
    } as never);
    expect(dto).not.toHaveProperty("checkoutUrl");
    expect(JSON.stringify(dto)).not.toContain("billplz.com/bills");
    expect(dto.billId).toBe("bill123");
    expect(dto.needsRefund).toBe(true);
    expect(dto.paidAt).toBe(new Date(1700000000000).toISOString());
  });
});

describe("site row DTO", () => {
  it("keeps the business name, category and template, never the content", () => {
    const dto = toSiteRowDto("site-1", {
      ownerUid: "uid-1",
      status: "draft",
      draft: {
        business: { name: "Kedai Roti", category: "bakery", phone: "+60123456789", description: "secret draft text" },
        theme: { preset: "warm" },
        sections: [{ body: "customer content" }],
      },
    });
    expect(dto).toMatchObject({ businessName: "Kedai Roti", category: "bakery", template: "warm", status: "draft" });
    const text = JSON.stringify(dto);
    expect(text).not.toContain("+60123456789");
    expect(text).not.toContain("secret draft text");
    expect(text).not.toContain("customer content");
  });
});

describe("adminJson, the last line", () => {
  it("finds forbidden keys at any depth, case-insensitively", () => {
    expect(forbiddenKeys({ users: [{ uid: "a", passwordHash: "x" }], nested: { deep: { CheckoutUrl: "y" } } })).toEqual([
      "users[0].passwordHash",
      "nested.deep.CheckoutUrl",
    ]);
  });

  it.each(["passwordHash", "salt", "checkoutUrl", "customAttributes", "providerUserInfo", "refreshToken", "idToken", "appCheckToken", "apiKey", "secretKey", "privateKey", "draft", "prompt"])(
    "refuses a response containing %s with a generic 500",
    async (key) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const response = adminJson({ rows: [{ id: "1", [key]: "leak-value" }] });
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).not.toContain("leak-value");
      expect(body).not.toContain(key);
    },
  );

  it("sends a clean response", async () => {
    const response = adminJson({ users: [toAccountDto(RAW_USER)] });
    expect(response.status).toBe(200);
    expect(forbiddenKeys(await response.json())).toEqual([]);
  });
});
