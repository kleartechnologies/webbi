import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRICE_SEN } from "@/lib/env";
import {
  billplzProvider,
  callbackSignatureSource,
  parseBillplzDate,
  redirectSignatureSource,
  xSignatureMatches,
} from "../billplz";
import { PaymentError, type CheckoutInput } from "../provider";

// Made-up values that exist only in this file. The real keys live in Netlify.
const SECRET = "secret-key-for-unit-tests-only";
const SIGNING_KEY = "x-signature-key-for-unit-tests-only";
const COLLECTION = "webbi_test_col";
const BILL = "8x89wxq6";
const BASIC_AUTH = `Basic ${Buffer.from(`${SECRET}:`).toString("base64")}`;

/** Billplz's recipe, written out apart from the adapter: key+value, sorted case-insensitively, joined with "|". */
function recipe(fields: Record<string, string>, prefix = ""): string {
  return Object.entries(fields)
    .map(([key, value]) => `${prefix}${key}${value}`)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .join("|");
}

const hmac = (source: string, key = SIGNING_KEY) => createHmac("sha256", key).update(source).digest("hex");

/** A callback body as Billplz posts it, signed with `key`. */
function signedCallback(fields: Record<string, string>, key = SIGNING_KEY): URLSearchParams {
  const body = new URLSearchParams(fields);
  body.set("x_signature", hmac(recipe(fields), key));
  return body;
}

/** The query Billplz appends to the redirect URL, signed with `key`. */
function signedRedirect(fields: Record<string, string>, key = SIGNING_KEY): URLSearchParams {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) query.set(`billplz[${name}]`, value);
  query.set("billplz[x_signature]", hmac(recipe(fields, "billplz"), key));
  return query;
}

const paidCallback = (overrides: Record<string, string> = {}): Record<string, string> => ({
  id: BILL,
  collection_id: COLLECTION,
  paid: "true",
  state: "paid",
  amount: "14990",
  paid_amount: "14990",
  due_at: "2026-9-13",
  email: "owner@example.com",
  mobile: "",
  name: "AISYAH BINTI AHMAD",
  url: `https://www.billplz.com/bills/${BILL}`,
  paid_at: "2026-09-13 10:15:09 +0800",
  ...overrides,
});

const unpaidCallback = (state: string) => paidCallback({ paid: "false", state, paid_amount: "0", paid_at: "" });

/** A bill as the Billplz API returns it. */
const billJson = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: BILL,
  collection_id: COLLECTION,
  paid: false,
  state: "due",
  amount: PRICE_SEN,
  paid_amount: 0,
  due_at: "2026-9-13",
  email: "owner@example.com",
  mobile: null,
  name: "AISYAH",
  url: `https://www.billplz.com/bills/${BILL}`,
  paid_at: null,
  reference_1_label: "Webbi payment",
  reference_1: "pay_123",
  reference_2_label: "Website",
  reference_2: "site_abc",
  ...overrides,
});

const checkoutInput = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  paymentId: "pay_123",
  siteId: "site_abc",
  uid: "owner_uid",
  email: "owner@example.com",
  customerName: "Aisyah",
  businessName: "Kedai Aisyah",
  publicUrl: "https://webbi.my/w/kedai-aisyah",
  amountSen: PRICE_SEN,
  currency: "myr",
  successUrl: "https://webbi.my/s/site_abc/publish/return",
  cancelUrl: "https://webbi.my/s/site_abc/publish?cancelled=1",
  callbackUrl: "https://webbi.my/api/payments/webhook",
  ...overrides,
});

interface ApiCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: URLSearchParams | null;
}

/** Stands in for the Billplz API and records every request the adapter makes. */
function fakeBillplz(respond: (call: ApiCall) => { status?: number; json: unknown } | Error): ApiCall[] {
  const calls: ApiCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call: ApiCall = {
        url: String(url),
        method: init.method ?? "GET",
        headers: { ...(init.headers as Record<string, string>) },
        body: typeof init.body === "string" ? new URLSearchParams(init.body) : null,
      };
      calls.push(call);
      const reply = respond(call);
      if (reply instanceof Error) throw reply;
      return new Response(JSON.stringify(reply.json), {
        status: reply.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

async function paymentError(work: Promise<unknown>): Promise<PaymentError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof PaymentError) return error;
    throw error;
  }
  throw new Error("expected a PaymentError");
}

const webhook = (body: URLSearchParams) =>
  billplzProvider.parseWebhook(body.toString(), new Headers({ "content-type": "application/x-www-form-urlencoded" }));

const redirect = (query: URLSearchParams) => billplzProvider.parseRedirect?.(query);

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BILLPLZ_BASE_URL", "https://www.billplz.com/api/");
  vi.stubEnv("BILLPLZ_SECRET_KEY", SECRET);
  vi.stubEnv("BILLPLZ_COLLECTION_ID", COLLECTION);
  vi.stubEnv("BILLPLZ_X_SIGNATURE_KEY", SIGNING_KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("X Signature", () => {
  it("orders callback fields the way Billplz documents, whatever order they arrive in", () => {
    // URL-encoded and shuffled, as a real callback body can be.
    const body = new URLSearchParams(
      "url=https%3A%2F%2Fwww.billplz.com%2Fbills%2Fzq0tm2wc&paid_at=2018-09-27+15%3A15%3A09+%2B0800&state=paid" +
        "&id=zq0tm2wc&x_signature=ignored&collection_id=yhx5t1pp&paid=true&amount=100&due_at=2018-9-27" +
        "&email=api%40billplz.com&mobile=&name=TESTER&paid_amount=100",
    );
    expect(callbackSignatureSource(body)).toBe(
      "amount100|collection_idyhx5t1pp|due_at2018-9-27|emailapi@billplz.com|idzq0tm2wc|mobile|nameTESTER" +
        "|paid_amount100|paid_at2018-09-27 15:15:09 +0800|paidtrue|statepaid|urlhttps://www.billplz.com/bills/zq0tm2wc",
    );
  });

  it("builds the redirect source from the billplz[…] parameters only", () => {
    const query = new URLSearchParams(
      "billplz%5Bpaid%5D=true&session_id=ignored&billplz%5Bx_signature%5D=ignored" +
        "&billplz%5Bid%5D=zq0tm2wc&billplz%5Bpaid_at%5D=2018-09-27+15%3A15%3A09+%2B0800",
    );
    expect(redirectSignatureSource(query)).toBe(
      "billplzidzq0tm2wc|billplzpaid_at2018-09-27 15:15:09 +0800|billplzpaidtrue",
    );
  });

  it("compares digests exactly", () => {
    const digest = hmac("amount100");
    expect(xSignatureMatches(digest, digest)).toBe(true);
    expect(xSignatureMatches(digest, ` ${digest.toUpperCase()} `)).toBe(true);
    expect(xSignatureMatches(digest, hmac("amount101"))).toBe(false);
    expect(xSignatureMatches(digest, hmac("amount100", "someone-elses-key"))).toBe(false);
    expect(xSignatureMatches(digest, digest.slice(0, -2))).toBe(false);
    expect(xSignatureMatches(digest, `${digest}00`)).toBe(false);
    expect(xSignatureMatches(digest, "z".repeat(64))).toBe(false);
    expect(xSignatureMatches(digest, "")).toBe(false);
    expect(xSignatureMatches(digest, null)).toBe(false);
  });
});

describe("createCheckout", () => {
  it("creates the bill on the production API for RM149.90, sent as 14990", async () => {
    const calls = fakeBillplz(() => ({ json: billJson() }));
    const session = await billplzProvider.createCheckout(checkoutInput());

    expect(PRICE_SEN).toBe(14990);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe("https://www.billplz.com/api/v3/bills");
    expect(call.method).toBe("POST");
    expect(call.headers.Authorization).toBe(BASIC_AUTH);
    expect(call.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(call.body ?? [])).toEqual({
      collection_id: COLLECTION,
      email: "owner@example.com",
      name: "Aisyah",
      amount: "14990",
      description: "Webbi website for Kedai Aisyah. One-time payment for https://webbi.my/w/kedai-aisyah",
      callback_url: "https://webbi.my/api/payments/webhook",
      redirect_url: "https://webbi.my/s/site_abc/publish/return",
      deliver: "false",
      reference_1_label: "Webbi payment",
      reference_1: "pay_123",
      reference_2_label: "Website",
      reference_2: "site_abc",
    });
    // The secret key only travels in the Authorization header; the signing key never leaves.
    expect(JSON.stringify(call)).not.toContain(SECRET);
    expect(JSON.stringify(call)).not.toContain(SIGNING_KEY);
    expect(session).toEqual({ url: `https://www.billplz.com/bills/${BILL}`, providerRef: BILL });
  });

  it("uses the production API when BILLPLZ_BASE_URL is left empty", async () => {
    vi.stubEnv("BILLPLZ_BASE_URL", "");
    const calls = fakeBillplz(() => ({ json: billJson() }));
    await billplzProvider.createCheckout(checkoutInput());
    expect(calls[0].url).toBe("https://www.billplz.com/api/v3/bills");
  });

  it("refuses the Billplz sandbox in production, before any request", async () => {
    vi.stubEnv("BILLPLZ_BASE_URL", "https://www.billplz-sandbox.com/api/");
    const calls = fakeBillplz(() => ({ json: billJson() }));
    expect((await paymentError(billplzProvider.createCheckout(checkoutInput()))).code).toBe("payments_not_configured");
    expect(calls).toHaveLength(0);
  });

  it("refuses callback or return addresses Billplz can't reach", async () => {
    const calls = fakeBillplz(() => ({ json: billJson() }));
    for (const overrides of [
      { callbackUrl: "http://localhost:3000/api/payments/webhook" },
      { successUrl: "http://webbi.my/s/site_abc/publish/return" },
    ]) {
      const error = await paymentError(billplzProvider.createCheckout(checkoutInput(overrides)));
      expect(error.code).toBe("payments_not_configured");
    }
    expect(calls).toHaveLength(0);
  });

  it("names a missing variable without revealing the others", async () => {
    vi.stubEnv("BILLPLZ_X_SIGNATURE_KEY", "");
    const calls = fakeBillplz(() => ({ json: billJson() }));
    const error = await paymentError(billplzProvider.createCheckout(checkoutInput()));
    expect(error.code).toBe("payments_not_configured");
    expect(error.message).toContain("BILLPLZ_X_SIGNATURE_KEY");
    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toContain(COLLECTION);
    expect(calls).toHaveLength(0);
  });

  it("needs an email address for the bill", async () => {
    const calls = fakeBillplz(() => ({ json: billJson() }));
    expect((await paymentError(billplzProvider.createCheckout(checkoutInput({ email: undefined })))).code).toBe(
      "provider_error",
    );
    expect(calls).toHaveLength(0);
  });

  it("refuses a bill that isn't for the price or the collection it asked for", async () => {
    for (const bill of [billJson({ amount: 100 }), billJson({ collection_id: "someone_else" }), billJson({ id: "" })]) {
      fakeBillplz(() => ({ json: bill }));
      expect((await paymentError(billplzProvider.createCheckout(checkoutInput()))).code).toBe("provider_error");
    }
  });

  it("reports a Billplz error without logging any key", async () => {
    fakeBillplz(() => ({ status: 401, json: { error: { type: "Unauthorized", message: "Invalid access token" } } }));
    const error = await paymentError(billplzProvider.createCheckout(checkoutInput()));
    expect(error.code).toBe("provider_error");
    expect(error.message).not.toContain(SECRET);
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).toContain("401");
    expect(logs).not.toContain(SECRET);
    expect(logs).not.toContain(SIGNING_KEY);
  });

  it("treats an unreachable Billplz as a provider error", async () => {
    fakeBillplz(() => new TypeError("fetch failed"));
    expect((await paymentError(billplzProvider.createCheckout(checkoutInput()))).code).toBe("provider_error");
  });
});

describe("verifyCheckout", () => {
  it("reads the bill back from Billplz", async () => {
    const calls = fakeBillplz(() => ({
      json: billJson({ paid: true, state: "paid", paid_amount: 14990, paid_at: "2026-09-13 10:15:09 +0800" }),
    }));
    const verification = await billplzProvider.verifyCheckout(BILL);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: `https://www.billplz.com/api/v3/bills/${BILL}`, method: "GET", body: null });
    expect(calls[0].headers.Authorization).toBe(BASIC_AUTH);
    expect(verification).toEqual({
      state: "paid",
      providerRef: BILL,
      paymentId: "pay_123",
      siteId: "site_abc",
      amountSen: 14990,
      currency: "myr",
      paidAt: new Date("2026-09-13T02:15:09.000Z"),
    });
  });

  it("counts only paid together with state paid; due waits and deleted fails", async () => {
    fakeBillplz(() => ({ json: billJson() }));
    expect(await billplzProvider.verifyCheckout(BILL)).toEqual({ state: "pending", providerRef: BILL, paymentId: "pay_123" });

    fakeBillplz(() => ({ json: billJson({ state: "deleted" }) }));
    expect(await billplzProvider.verifyCheckout(BILL)).toEqual({
      state: "failed",
      providerRef: BILL,
      paymentId: "pay_123",
      reason: "bill_deleted",
    });

    for (const half of [{ paid: true, state: "due" }, { paid: false, state: "paid" }, { paid: "yes", state: "paid" }]) {
      fakeBillplz(() => ({ json: billJson(half) }));
      expect((await billplzProvider.verifyCheckout(BILL)).state).toBe("pending");
    }
  });

  it("doesn't recognise a bill from another collection, a different bill, or an unknown one", async () => {
    fakeBillplz(() => ({ json: billJson({ paid: true, state: "paid", collection_id: "someone_else" }) }));
    expect((await paymentError(billplzProvider.verifyCheckout(BILL))).code).toBe("not_found");
    fakeBillplz(() => ({ json: billJson({ paid: true, state: "paid", id: "other123" }) }));
    expect((await paymentError(billplzProvider.verifyCheckout(BILL))).code).toBe("not_found");
    fakeBillplz(() => ({ status: 404, json: { error: { type: "RecordNotFound" } } }));
    expect((await paymentError(billplzProvider.verifyCheckout(BILL))).code).toBe("not_found");
  });

  it("never sends a malformed bill id to the API", async () => {
    const calls = fakeBillplz(() => ({ json: billJson({ paid: true, state: "paid" }) }));
    for (const ref of ["", "../collections", `${BILL}?paid=true`, "a b", "x".repeat(65)]) {
      expect((await paymentError(billplzProvider.verifyCheckout(ref))).code).toBe("not_found");
    }
    expect(calls).toHaveLength(0);
  });
});

describe("parseWebhook (the callback)", () => {
  it("accepts a paid callback signed with the X Signature key", async () => {
    expect(await webhook(signedCallback(paidCallback()))).toEqual({
      state: "paid",
      providerRef: BILL,
      paymentId: null,
      amountSen: 14990,
      currency: "myr",
      paidAt: new Date("2026-09-13T02:15:09.000Z"),
    });
  });

  it("rejects a forged, unsigned or wrongly keyed callback", async () => {
    const forged = signedCallback(paidCallback());
    forged.set("x_signature", "0".repeat(64));
    const unsigned = new URLSearchParams(paidCallback());
    const wrongKey = signedCallback(paidCallback(), "someone-elses-key");
    for (const body of [forged, unsigned, wrongKey]) {
      expect((await paymentError(webhook(body))).code).toBe("bad_signature");
    }
  });

  it("rejects a callback changed after it was signed", async () => {
    const cheaper = signedCallback(paidCallback({ amount: "100", paid_amount: "100" }));
    cheaper.set("amount", "14990");
    cheaper.set("paid_amount", "14990");

    const unpaid = signedCallback(unpaidCallback("due"));
    unpaid.set("paid", "true");
    unpaid.set("state", "paid");

    const otherBill = signedCallback(paidCallback());
    otherBill.set("id", "someone1");

    const dropped = signedCallback(paidCallback({ transaction_id: "AC4GC1EOSHA2", transaction_status: "completed" }));
    dropped.delete("transaction_status");

    for (const body of [cheaper, unpaid, otherBill, dropped]) {
      expect((await paymentError(webhook(body))).code).toBe("bad_signature");
    }
  });

  it("includes any extra fields Billplz sends in the signature", async () => {
    const body = signedCallback(paidCallback({ transaction_id: "AC4GC1EOSHA2", transaction_status: "completed" }));
    expect((await webhook(body))?.state).toBe("paid");
  });

  it("keeps a signed due callback pending and fails a deleted bill", async () => {
    expect(await webhook(signedCallback(unpaidCallback("due")))).toEqual({
      state: "pending",
      providerRef: BILL,
      paymentId: null,
    });
    expect(await webhook(signedCallback(unpaidCallback("deleted")))).toEqual({
      state: "failed",
      providerRef: BILL,
      paymentId: null,
      reason: "bill_deleted",
    });
  });

  it("ignores a signed callback for a bill outside Webbi's collection", async () => {
    expect(await webhook(signedCallback(paidCallback({ collection_id: "someone_else" })))).toBeNull();
  });

  it("refuses a signed callback that names no bill", async () => {
    expect((await paymentError(webhook(signedCallback(paidCallback({ id: "" }))))).code).toBe("bad_signature");
  });

  it("is checked on its own, without calling the Billplz API", async () => {
    const calls = fakeBillplz(() => ({ json: billJson() }));
    await webhook(signedCallback(paidCallback()));
    expect(calls).toHaveLength(0);
  });
});

describe("parseRedirect (the customer's return)", () => {
  const paidReturn = { id: BILL, paid: "true", paid_at: "2026-09-13 10:15:09 +0800" };

  it("verifies a signed return, also after the URL has been re-encoded", () => {
    const query = signedRedirect(paidReturn);
    query.set("session_id", "ignored");
    const expected = { providerRef: BILL, signatureValid: true, paid: true };
    expect(redirect(query)).toEqual(expected);
    expect(redirect(new URLSearchParams(query.toString()))).toEqual(expected);
  });

  it("marks an unsigned, wrongly keyed or edited return as not valid", () => {
    const unsigned = new URLSearchParams({ "billplz[id]": BILL, "billplz[paid]": "true" });
    const wrongKey = signedRedirect(paidReturn, "someone-elses-key");
    const flipped = signedRedirect({ id: BILL, paid: "false", paid_at: "" });
    flipped.set("billplz[paid]", "true");
    const otherBill = signedRedirect(paidReturn);
    otherBill.set("billplz[id]", "someone1");
    for (const query of [unsigned, wrongKey, flipped, otherBill]) {
      expect(redirect(query)?.signatureValid).toBe(false);
    }
  });

  it("names no bill for a missing or malformed id", () => {
    expect(redirect(new URLSearchParams("session_id=cs_123"))).toBeNull();
    expect(redirect(signedRedirect({ id: "../bills", paid: "true" }))).toBeNull();
  });
});

describe("parseBillplzDate", () => {
  it("reads Billplz's Malaysian timestamps the same on every runtime", () => {
    expect(parseBillplzDate("2018-09-27 15:15:09 +0800")?.toISOString()).toBe("2018-09-27T07:15:09.000Z");
    expect(parseBillplzDate("2018-09-27 15:15:09 +08:00")?.toISOString()).toBe("2018-09-27T07:15:09.000Z");
    expect(parseBillplzDate("")).toBeNull();
    expect(parseBillplzDate(null)).toBeNull();
    expect(parseBillplzDate("yesterday")).toBeNull();
  });
});
