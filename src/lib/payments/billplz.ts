import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  PaymentError,
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type PaymentVerification,
  type RedirectRead,
} from "./provider";

/**
 * Billplz adapter (API v3). Webbi's production provider for Malaysia: the
 * customer pays on Billplz's hosted bill page with FPX online banking or a card.
 *
 * Needs BILLPLZ_SECRET_KEY, BILLPLZ_COLLECTION_ID and BILLPLZ_X_SIGNATURE_KEY
 * (X Signature switched on for the account), plus BILLPLZ_BASE_URL, which
 * defaults to https://www.billplz.com/api. Every call runs on the server.
 *
 * How payment is proven:
 *  - Billplz POSTs the bill to /api/payments/webhook, signed with the X
 *    Signature key. That signed callback is the authoritative confirmation.
 *  - When the customer comes back, the confirm route reads the bill straight
 *    from the Billplz API. The redirect's own `paid` flag is never used.
 */

const SANDBOX = /billplz-sandbox\.com/i;
/** Billplz bill ids are short and alphanumeric; anything else never reaches a URL. */
const BILL_ID = /^[A-Za-z0-9_-]{1,64}$/;
const REDIRECT_KEY = /^billplz\[([A-Za-z0-9_]+)\]$/;
const TIMEOUT_MS = 15_000;

interface BillplzConfig {
  apiBase: string;
  secretKey: string;
  collectionId: string;
  signatureKey: string;
}

function config(): BillplzConfig {
  const secretKey = serverEnv.billplzSecretKey;
  const collectionId = serverEnv.billplzCollectionId;
  const signatureKey = serverEnv.billplzXSignatureKey;
  const missing = [
    secretKey ? null : "BILLPLZ_SECRET_KEY",
    collectionId ? null : "BILLPLZ_COLLECTION_ID",
    signatureKey ? null : "BILLPLZ_X_SIGNATURE_KEY",
  ].filter(Boolean);
  if (!secretKey || !collectionId || !signatureKey) {
    throw new PaymentError("payments_not_configured", `Billplz isn't fully configured: ${missing.join(", ")} not set.`);
  }
  const apiBase = serverEnv.billplzBaseUrl;
  if (process.env.NODE_ENV === "production" && SANDBOX.test(apiBase)) {
    throw new PaymentError(
      "payments_not_configured",
      "BILLPLZ_BASE_URL points at the Billplz sandbox. Production must use https://www.billplz.com/api/.",
    );
  }
  return { apiBase, secretKey, collectionId, signatureKey };
}

// ---------------------------------------------------------------------------
// X Signature
//
// Billplz builds the source string from every signed parameter as `key + value`,
// sorts those elements ascending (case-insensitive) and joins them with "|".
// The digest is HMAC-SHA256 with the X Signature key, as lowercase hex.
//
//   callback: amount100|collection_idyhx5t1pp|…|paid_amount100|paid_at…|paidtrue|statepaid|url…
//   redirect: billplzidzq0tm2wc|billplzpaid_at2018-09-27 15:15:09 +0800|billplzpaidtrue
// ---------------------------------------------------------------------------

function sourceString(elements: string[]): string {
  return [...elements]
    .sort((a, b) => {
      const x = a.toLowerCase();
      const y = b.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    })
    .join("|");
}

/** Source string for a callback: every posted field except x_signature. */
export function callbackSignatureSource(body: URLSearchParams): string {
  const elements: string[] = [];
  for (const [key, value] of body) if (key !== "x_signature") elements.push(`${key}${value}`);
  return sourceString(elements);
}

/** Source string for a redirect: every billplz[…] parameter except billplz[x_signature]. */
export function redirectSignatureSource(query: URLSearchParams): string {
  const elements: string[] = [];
  for (const [key, value] of query) {
    const match = REDIRECT_KEY.exec(key);
    if (!match || match[1] === "x_signature") continue;
    elements.push(`billplz${match[1]}${value}`);
  }
  return sourceString(elements);
}

export function signXSignature(source: string, key: string): string {
  return createHmac("sha256", key).update(source, "utf8").digest("hex");
}

/** Constant-time comparison of the digest we computed with the one we were sent. */
export function xSignatureMatches(expected: string, received: string | null): boolean {
  if (!received) return false;
  const value = received.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(value)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(value, "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

/** The fields Webbi reads from a bill, whichever way Billplz delivered it. */
interface Bill {
  id: string;
  collectionId: string;
  paid: boolean;
  state: string;
  amountSen: number;
  paidAmountSen: number;
  paidAt: Date | null;
  /** Our payment id. Present on bills read from the API; callbacks don't carry it. */
  paymentId: string | null;
}

/** Billplz sends "2018-09-27 15:15:09 +0800"; spell it out so every runtime parses it the same. */
export function parseBillplzDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.trim().replace(" ", "T").replace(/\s*([+-])(\d{2}):?(\d{2})$/, "$1$2:$3");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function toBool(value: unknown): boolean {
  return value === true || value === "true";
}

function billFromJson(json: Record<string, unknown>): Bill {
  return {
    id: String(json.id ?? ""),
    collectionId: String(json.collection_id ?? ""),
    paid: toBool(json.paid),
    state: String(json.state ?? ""),
    amountSen: toInt(json.amount),
    paidAmountSen: toInt(json.paid_amount),
    paidAt: parseBillplzDate(typeof json.paid_at === "string" ? json.paid_at : null),
    paymentId: typeof json.reference_1 === "string" && json.reference_1 ? json.reference_1 : null,
  };
}

function billFromCallback(body: URLSearchParams): Bill {
  return {
    id: body.get("id") ?? "",
    collectionId: body.get("collection_id") ?? "",
    paid: toBool(body.get("paid")),
    state: body.get("state") ?? "",
    amountSen: toInt(body.get("amount")),
    paidAmountSen: toInt(body.get("paid_amount")),
    paidAt: parseBillplzDate(body.get("paid_at")),
    paymentId: body.get("reference_1") || null,
  };
}

/**
 * Only `paid: true` together with `state: "paid"` counts as money received.
 * `deleted` is final. `due` (and anything Billplz adds later) waits.
 */
export function billVerification(bill: Bill): PaymentVerification {
  if (bill.paid && bill.state === "paid") {
    return {
      state: "paid",
      providerRef: bill.id,
      paymentId: bill.paymentId,
      // Billplz collections are ringgit only. paid_amount is what was actually
      // collected; fulfilment compares it with the price on our own record.
      amountSen: bill.paidAmountSen || bill.amountSen,
      currency: "myr",
      paidAt: bill.paidAt ?? new Date(),
    };
  }
  if (bill.state === "deleted") {
    return { state: "failed", providerRef: bill.id, paymentId: bill.paymentId, reason: "bill_deleted" };
  }
  return { state: "pending", providerRef: bill.id, paymentId: bill.paymentId };
}

async function billplz(cfg: BillplzConfig, path: string, init: { method: "GET" | "POST"; body?: URLSearchParams }) {
  let response: Response;
  try {
    response = await fetch(`${cfg.apiBase}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.secretKey}:`).toString("base64")}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: init.body?.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[billplz] request failed", init.method, path, error instanceof Error ? error.message : error);
    throw new PaymentError("provider_error", "We couldn't reach the payment provider. Please try again.");
  }
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.status === 404) throw new PaymentError("not_found", "We couldn't find that payment.");
  if (!response.ok || !json) {
    // Billplz error bodies name the problem ({ error: { type, message } }); they never echo the key.
    console.error("[billplz] error response", init.method, path, response.status, JSON.stringify(json?.error ?? null));
    throw new PaymentError("provider_error", "The payment provider couldn't process that. Please try again.");
  }
  return json;
}

const clamp = (value: string, max: number) => value.slice(0, max);

function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname);
  } catch {
    return false;
  }
}

function billName(input: CheckoutInput): string {
  const name = input.customerName?.trim() || input.businessName.trim() || input.email?.split("@")[0] || "Webbi customer";
  return clamp(name, 255);
}

function billDescription(input: CheckoutInput): string {
  const full = `Webbi website for ${input.businessName.trim()}. One-time payment for ${input.publicUrl}`;
  return full.length <= 200 ? full : clamp(`Webbi website. One-time payment for ${input.publicUrl}`, 200);
}

export const billplzProvider: PaymentProvider = {
  name: "billplz",

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const cfg = config();
    // Billplz calls and redirects to these from the internet; a localhost or http
    // address means NEXT_PUBLIC_SITE_URL isn't the public site, and no payment could ever confirm.
    if (process.env.NODE_ENV === "production" && ![input.callbackUrl, input.successUrl].every(isPublicHttps)) {
      throw new PaymentError("payments_not_configured", "NEXT_PUBLIC_SITE_URL must be the public https address of Webbi.");
    }
    const email = input.email?.trim();
    if (!email) {
      throw new PaymentError("provider_error", "Your account needs an email address before you can pay. Sign in again and retry.");
    }
    const json = await billplz(cfg, "/v3/bills", {
      method: "POST",
      body: new URLSearchParams({
        collection_id: cfg.collectionId,
        email,
        name: billName(input),
        amount: String(input.amountSen),
        description: billDescription(input),
        callback_url: input.callbackUrl,
        // Billplz appends billplz[id], billplz[paid], billplz[paid_at] and billplz[x_signature].
        redirect_url: input.successUrl,
        // Webbi shows the customer its own screens; Billplz shouldn't email or SMS the bill.
        deliver: "false",
        reference_1_label: "Webbi payment",
        reference_1: input.paymentId,
        reference_2_label: "Website",
        reference_2: input.siteId,
      }),
    });
    const bill = billFromJson(json);
    const url = typeof json.url === "string" ? json.url : "";
    if (!BILL_ID.test(bill.id) || !url.startsWith("https://")) {
      console.error("[billplz] create bill returned no usable id or url");
      throw new PaymentError("provider_error", "The payment page couldn't be opened. Please try again.");
    }
    if (bill.collectionId !== cfg.collectionId || bill.amountSen !== input.amountSen) {
      console.error("[billplz] created bill doesn't match the request", { id: bill.id, amount: bill.amountSen });
      throw new PaymentError("provider_error", "The payment page couldn't be opened. Please try again.");
    }
    return { url, providerRef: bill.id };
  },

  async verifyCheckout(providerRef: string): Promise<PaymentVerification> {
    if (!BILL_ID.test(providerRef)) throw new PaymentError("not_found", "We couldn't find that payment.");
    const cfg = config();
    const bill = billFromJson(await billplz(cfg, `/v3/bills/${encodeURIComponent(providerRef)}`, { method: "GET" }));
    // A bill outside Webbi's collection is not a Webbi payment, whatever its state.
    if (bill.id !== providerRef || bill.collectionId !== cfg.collectionId) {
      throw new PaymentError("not_found", "We couldn't find that payment.");
    }
    return billVerification(bill);
  },

  async parseWebhook(rawBody: string): Promise<PaymentVerification | null> {
    const cfg = config();
    const body = new URLSearchParams(rawBody);
    const expected = signXSignature(callbackSignatureSource(body), cfg.signatureKey);
    if (!xSignatureMatches(expected, body.get("x_signature"))) {
      throw new PaymentError("bad_signature", "Invalid Billplz X Signature.");
    }
    const bill = billFromCallback(body);
    if (!BILL_ID.test(bill.id)) throw new PaymentError("bad_signature", "The callback named no bill.");
    // Signed by our key but for another collection on the account: not a Webbi bill.
    if (bill.collectionId !== cfg.collectionId) return null;
    return billVerification(bill);
  },

  parseRedirect(query: URLSearchParams): RedirectRead | null {
    const providerRef = query.get("billplz[id]");
    if (!providerRef || !BILL_ID.test(providerRef)) return null;
    const paid = query.has("billplz[paid]") ? toBool(query.get("billplz[paid]")) : null;
    // X Signature is switched on for the account, so a redirect without one was tampered with.
    const expected = signXSignature(redirectSignatureSource(query), config().signatureKey);
    return { providerRef, signatureValid: xSignatureMatches(expected, query.get("billplz[x_signature]")), paid };
  },
};
