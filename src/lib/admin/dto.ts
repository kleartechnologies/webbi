import "server-only";
import { NextResponse } from "next/server";
import { providerIds, type RawAuthUser } from "@/lib/auth/accounts";
import type { PaymentAttentionReason, PaymentDoc } from "@/lib/site/types";
import { isoTime } from "./time";

/**
 * What the admin API may send, built field by field from explicit whitelists.
 * Firestore documents and Identity Toolkit accounts are never spread into a
 * response: accounts carry password hashes, salts and raw claims, payments
 * carry checkout URLs, sites carry the customer's content.
 *
 * adminJson() is the last line: it refuses (500, logged) any response that
 * still contains a key on FORBIDDEN_RESPONSE_KEYS.
 */

export const FORBIDDEN_RESPONSE_KEYS = [
  "passwordhash",
  "salt",
  "passwordsalt",
  "checkouturl",
  "customattributes",
  "customclaims",
  "provideruserinfo",
  "token",
  "idtoken",
  "refreshtoken",
  "accesstoken",
  "appchecktoken",
  "apikey",
  "secret",
  "secretkey",
  "clientsecret",
  "privatekey",
  "signaturekey",
  "xsignature",
  "credential",
  "credentials",
  "serviceaccount",
  // Customer content and AI prompts: never part of an admin response.
  "draft",
  "published",
  "content",
  "sourcedescription",
  "generation",
  "understanding",
  "prompt",
];

const FORBIDDEN = new Set(FORBIDDEN_RESPONSE_KEYS);

/** Every forbidden key found anywhere in `value`, as dotted paths. */
export function forbiddenKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => forbiddenKeys(item, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const here = path ? `${path}.${key}` : key;
    return [...(FORBIDDEN.has(key.toLowerCase()) ? [here] : []), ...forbiddenKeys(child, here)];
  });
}

export function adminJson(data: unknown, init?: ResponseInit): Response {
  const leaks = forbiddenKeys(data);
  if (leaks.length) {
    console.error("[admin] refused to send a response with forbidden fields", { fields: leaks.slice(0, 10) });
    return NextResponse.json({ error: { code: "internal", message: "Something went wrong on our side." } }, { status: 500 });
  }
  return NextResponse.json(data, init);
}

// ── Accounts ─────────────────────────────────────────────────────────────────────

export interface AdminAccountDto {
  uid: string;
  name: string | null;
  email: string | null;
  providers: string[];
  emailVerified: boolean;
  disabled: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export function toAccountDto(user: RawAuthUser): AdminAccountDto {
  return {
    uid: String(user.localId ?? ""),
    name: typeof user.displayName === "string" ? user.displayName.slice(0, 120) : null,
    email: typeof user.email === "string" ? user.email : null,
    providers: providerIds(user).filter((id) => /^[a-z.]{1,32}$/.test(id)),
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    createdAt: isoTime(user.createdAt),
    lastLoginAt: isoTime(user.lastLoginAt),
  };
}

// ── Sites ────────────────────────────────────────────────────────────────────────

/** Only these site fields are ever read for a list: never the draft or published content. */
export const SITE_ROW_FIELDS = [
  "ownerUid",
  "status",
  "paid",
  "slug",
  "moderationStatus",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "paidAt",
  "paymentId",
  "draft.business.name",
  "draft.business.category",
  "draft.theme.preset",
  "published.business.name",
  "published.business.category",
  "published.theme.preset",
];

export interface AdminSiteRowDto {
  id: string;
  ownerUid: string | null;
  ownerEmail: string | null;
  businessName: string | null;
  category: string | null;
  template: string | null;
  status: "draft" | "published" | "unknown";
  paid: boolean;
  slug: string | null;
  moderationStatus: "active" | "suspended";
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
}

type Picked = Record<string, unknown>;

function pick(data: Picked, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Picked)[key] : undefined), data);
}

const text = (value: unknown, max = 120) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

export function toSiteRowDto(id: string, data: Picked, ownerEmail: string | null = null): AdminSiteRowDto {
  const status = data.status === "draft" || data.status === "published" ? data.status : "unknown";
  return {
    id,
    ownerUid: text(data.ownerUid, 128),
    ownerEmail,
    businessName: text(pick(data, "published.business.name")) ?? text(pick(data, "draft.business.name")),
    category: text(pick(data, "published.business.category"), 40) ?? text(pick(data, "draft.business.category"), 40),
    template: text(pick(data, "published.theme.preset"), 40) ?? text(pick(data, "draft.theme.preset"), 40),
    status,
    paid: data.paid === true,
    slug: text(data.slug, 80),
    moderationStatus: data.moderationStatus === "suspended" ? "suspended" : "active",
    createdAt: isoTime(data.createdAt),
    updatedAt: isoTime(data.updatedAt),
    publishedAt: isoTime(data.publishedAt),
  };
}

// ── Payments ─────────────────────────────────────────────────────────────────────

/** Only these payment fields are ever read: never checkoutUrl. */
export const PAYMENT_FIELDS = [
  "siteId",
  "ownerUid",
  "slug",
  "amountSen",
  "paidAmountSen",
  "currency",
  "provider",
  "providerRef",
  "status",
  "failureReason",
  "needsAttention",
  "attentionReason",
  "duplicate",
  "createdAt",
  "paidAt",
  "fulfilledAt",
  "updatedAt",
];

/** Paid, never going to publish: the money has to be returned by hand, outside Webbi. */
export const REFUND_REASONS: PaymentAttentionReason[] = ["site_missing", "owner_mismatch", "amount_mismatch", "duplicate"];

export interface AdminPaymentDto {
  id: string;
  siteId: string | null;
  ownerUid: string | null;
  ownerEmail: string | null;
  slug: string | null;
  amountSen: number;
  paidAmountSen: number | null;
  currency: string;
  provider: string;
  /** Billplz bill id (or the provider's checkout id). */
  billId: string | null;
  status: "pending" | "paid" | "failed" | "unknown";
  failureReason: string | null;
  needsAttention: boolean;
  attentionReason: string | null;
  needsRefund: boolean;
  duplicate: boolean;
  createdAt: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  updatedAt: string | null;
}

export function toPaymentDto(id: string, data: Partial<PaymentDoc> & Picked, ownerEmail: string | null = null): AdminPaymentDto {
  const reason = text(data.attentionReason, 40);
  const status = data.status === "pending" || data.status === "paid" || data.status === "failed" ? data.status : "unknown";
  return {
    id,
    siteId: text(data.siteId, 128),
    ownerUid: text(data.ownerUid, 128),
    ownerEmail,
    slug: text(data.slug, 80),
    amountSen: typeof data.amountSen === "number" ? data.amountSen : 0,
    paidAmountSen: typeof data.paidAmountSen === "number" ? data.paidAmountSen : null,
    currency: text(data.currency, 8) ?? "myr",
    provider: text(data.provider, 16) ?? "unknown",
    billId: text(data.providerRef, 128),
    status,
    failureReason: text(data.failureReason, 200),
    needsAttention: data.needsAttention === true,
    attentionReason: reason,
    needsRefund: data.needsAttention === true && REFUND_REASONS.includes(reason as PaymentAttentionReason),
    duplicate: data.duplicate === true,
    createdAt: isoTime(data.createdAt),
    paidAt: isoTime(data.paidAt),
    fulfilledAt: isoTime(data.fulfilledAt),
    updatedAt: isoTime(data.updatedAt),
  };
}
