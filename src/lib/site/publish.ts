import "server-only";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { PRICE_SEN } from "@/lib/env";
import { adminDb } from "@/lib/firebase/admin";
import {
  PaymentError,
  type PaymentProvider,
  type PaymentProviderName,
  type PaymentVerification,
} from "@/lib/payments/provider";
import { siteCacheTag } from "./publicStore";
import { siteContentSchema, type SiteContent } from "./schema";
import { isReservedSlug, isValidSlug } from "./slug";
import type { PaymentAttentionReason, PaymentDoc, SiteDoc, SlugDoc, UserQuotaDoc } from "./types";

/**
 * Write side of publishing (Admin SDK, server only).
 *
 * A payment reaches a live website in two steps, both idempotent:
 *
 *  1. recordPaidPayment: a `paid` verification from the provider's own records
 *     (signed callback, or a server-side bill lookup) marks the payment paid.
 *     From here the money is never forgotten, whatever happens next.
 *  2. publishPaidPayment: copies the draft live, claims the link and frees the
 *     owner's draft slot, in one transaction. If that can't happen (a broken
 *     draft, every link taken, Firestore unavailable) the payment stays paid
 *     with needsAttention, the slot stays held, and the same step can be run
 *     again: by a repeated callback, the return page, the owner pressing Pay
 *     again (no second charge), or retryPaymentFulfilment on the server.
 *
 * The callback and the return page both go through fulfilPayment, so they can
 * race or repeat and still publish exactly once.
 */

export type PublishErrorCode = "not_found" | "forbidden" | "conflict" | "bad_request";

export class PublishError extends Error {
  constructor(
    public readonly code: PublishErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

const MAX_SLUG_SUFFIX = 6;

/** One Firestore auto-id (or similar): no slashes, never empty. */
export const PAYMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type SlugStatus = "available" | "yours" | "taken" | "invalid" | "incomplete" | "reserved";

export interface SlugCheck {
  slug: string;
  status: SlugStatus;
  /** A free alternative when the requested link can't be used. */
  suggestion?: string;
}

function slugCandidates(base: string): string[] {
  const out = [base];
  for (let i = 2; i <= MAX_SLUG_SUFFIX; i++) out.push(`${base.slice(0, 40 - String(i).length - 1)}-${i}`);
  return out;
}

/** Is `slug` free for `siteId` to claim? Includes a suggestion when not. */
export async function checkSlug(slug: string, siteId: string): Promise<SlugCheck> {
  if (!isValidSlug(slug)) return { slug, status: "invalid" };
  if (isReservedSlug(slug)) return { slug, status: "reserved" };
  const db = adminDb();
  const candidates = slugCandidates(slug);
  const snaps = await db.getAll(...candidates.map((c) => db.doc(`slugs/${c}`)));
  const owner = snaps[0].exists ? (snaps[0].data() as SlugDoc) : null;
  if (!owner) return { slug, status: "available" };
  if (owner.siteId === siteId) return { slug, status: "yours" };
  const free = candidates.find((c, i) => i > 0 && !snaps[i].exists && !isReservedSlug(c));
  return { slug, status: "taken", suggestion: free };
}

export async function getOwnedSite(siteId: string, uid: string): Promise<SiteDoc> {
  const snap = await adminDb().doc(`sites/${siteId}`).get();
  const site = snap.exists ? (snap.data() as SiteDoc) : null;
  if (!site || site.ownerUid !== uid) {
    throw new PublishError("not_found", "We couldn't find that website.");
  }
  return site;
}

/** Validates a draft for publishing; returns a clean copy safe to store publicly. */
export function publishableContent(draft: SiteContent | null): SiteContent {
  const parsed = siteContentSchema.safeParse(draft);
  if (!parsed.success) {
    throw new PublishError(
      "bad_request",
      "Some details on your website need fixing before it can go live. Open the editor to check them.",
    );
  }
  return parsed.data;
}

export interface PendingPaymentInput {
  siteId: string;
  uid: string;
  slug: string;
  provider: PaymentProviderName;
}

/** Records a payment attempt before the customer is sent to checkout. */
export async function createPendingPayment(input: PendingPaymentInput): Promise<string> {
  const ref = adminDb().collection("payments").doc();
  const doc: Omit<PaymentDoc, "createdAt" | "updatedAt" | "paidAt"> & Record<string, unknown> = {
    siteId: input.siteId,
    ownerUid: input.uid,
    slug: input.slug,
    amountSen: PRICE_SEN,
    currency: "myr",
    provider: input.provider,
    providerRef: null,
    checkoutUrl: null,
    status: "pending",
    failureReason: null,
    paidAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(doc);
  return ref.id;
}

export async function attachProviderRef(paymentId: string, providerRef: string, checkoutUrl?: string): Promise<void> {
  await adminDb().doc(`payments/${paymentId}`).update({
    providerRef,
    checkoutUrl: checkoutUrl ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getPayment(paymentId: string): Promise<PaymentDoc | null> {
  const snap = await adminDb().doc(`payments/${paymentId}`).get();
  return snap.exists ? (snap.data() as PaymentDoc) : null;
}

export interface SitePayment extends PaymentDoc {
  id: string;
}

/** Every payment this owner has recorded for one of their websites. */
export async function sitePayments(siteId: string, uid: string): Promise<SitePayment[]> {
  const snap = await adminDb().collection("payments").where("siteId", "==", siteId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as PaymentDoc) }))
    .filter((payment) => payment.ownerUid === uid);
}

/** Paid, not a duplicate, and its website not yet published by it. */
export function awaitsFulfilment(payment: PaymentDoc): boolean {
  return payment.status === "paid" && !payment.duplicate && !payment.fulfilledAt;
}

/** The payment a provider checkout belongs to, found by the reference stored when checkout opened. */
export async function findPaymentIdByProviderRef(providerRef: string): Promise<string | null> {
  const snap = await adminDb().collection("payments").where("providerRef", "==", providerRef).limit(2).get();
  if (snap.size > 1) console.error("[publish] more than one payment shares a provider reference", { providerRef });
  return snap.size === 1 ? snap.docs[0].id : null;
}

/**
 * Ties a provider verification to one of our payment records: the id the
 * provider handed back, or else the record whose providerRef matches. Null
 * when neither gives a well-formed payment id.
 */
export async function resolvePaymentId(verification: PaymentVerification): Promise<string | null> {
  const id = verification.paymentId ?? (await findPaymentIdByProviderRef(verification.providerRef));
  return id && PAYMENT_ID.test(id) ? id : null;
}

export async function markPaymentFailed(paymentId: string, reason: string, providerRef?: string): Promise<void> {
  const ref = adminDb().doc(`payments/${paymentId}`);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const payment = snap.data() as PaymentDoc;
    if (payment.status !== "pending") return; // never downgrade a verified payment
    if (providerRef && payment.providerRef && payment.providerRef !== providerRef) return; // a different checkout
    tx.update(ref, { status: "failed", failureReason: reason, updatedAt: FieldValue.serverTimestamp() });
  });
}

export interface FulfilResult {
  paymentId: string;
  siteId: string;
  /** The website's live link, or null while it isn't live. */
  slug: string | null;
  /** True when this call did the publishing (false when it had already happened, or couldn't). */
  published: boolean;
  /** True when another payment had already published this site; this one needs a refund. */
  duplicate?: boolean;
  /** Set when the payment is paid but hasn't published its website. */
  needsAttention?: PaymentAttentionReason;
}

/** What the owner is told when their payment is in but their website isn't live. */
export function attentionMessage(reason: PaymentAttentionReason | undefined): string {
  switch (reason) {
    case "invalid_draft":
      return "We've received your payment, but some details on your website need fixing before it can go live. Open the editor to check them, then publish again. You won't be charged twice.";
    case "slug_unavailable":
      return "We've received your payment, but that link was just taken. Choose a different one and publish again. You won't be charged twice.";
    default:
      return "We've received your payment, but your website couldn't go live yet. Please contact Webbi support and we'll sort it out.";
  }
}

/**
 * Step 1. Records a provider-confirmed payment as paid. Refuses (and records
 * nothing) when the bill doesn't map to this payment record.
 */
async function recordPaidPayment(
  paymentId: string,
  verification: Extract<PaymentVerification, { state: "paid" }>,
): Promise<void> {
  const db = adminDb();
  const paymentRef = db.doc(`payments/${paymentId}`);
  const refusal = await db.runTransaction(async (tx): Promise<"not_found" | "wrong_checkout" | "wrong_site" | null> => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) return "not_found";
    const payment = paymentSnap.data() as PaymentDoc;
    // The checkout that was paid must be the one this record opened, for the site it names.
    if (payment.providerRef && payment.providerRef !== verification.providerRef) return "wrong_checkout";
    if (verification.siteId && verification.siteId !== payment.siteId) return "wrong_site";
    if (payment.status === "paid") return null; // already recorded

    const siteSnap = await tx.get(db.doc(`sites/${payment.siteId}`));
    const site = siteSnap.exists ? (siteSnap.data() as SiteDoc) : null;
    const reason: PaymentAttentionReason =
      verification.amountSen !== payment.amountSen || verification.currency !== payment.currency
        ? "amount_mismatch"
        : !site
          ? "site_missing"
          : site.ownerUid !== payment.ownerUid
            ? "owner_mismatch"
            : site.status === "published" && site.slug
              ? "duplicate"
              : "fulfilment_pending";

    // A pending or failed record becomes paid: the provider's word outranks ours.
    tx.update(paymentRef, {
      status: "paid",
      providerRef: verification.providerRef,
      paidAt: Timestamp.fromDate(verification.paidAt),
      paidAmountSen: verification.amountSen,
      failureReason: null,
      needsAttention: true,
      attentionReason: reason,
      fulfilledAt: null,
      ...(reason === "duplicate" ? { duplicate: true } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return null;
  });

  if (refusal) {
    console.error("[payments] verified payment doesn't match a Webbi checkout", {
      paymentId,
      providerRef: verification.providerRef,
      reason: refusal,
    });
    if (refusal === "not_found") throw new PublishError("not_found", "We couldn't find that payment.");
    throw new PublishError("forbidden", "This payment doesn't belong to that checkout.");
  }
}

/** Marks a paid payment whose website didn't publish, unless it has published since. */
async function flagAttention(paymentId: string, reason: PaymentAttentionReason): Promise<void> {
  const db = adminDb();
  const ref = db.doc(`payments/${paymentId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const payment = snap.exists ? (snap.data() as PaymentDoc) : null;
    if (!payment || !awaitsFulfilment(payment)) return;
    tx.update(ref, { needsAttention: true, attentionReason: reason, updatedAt: FieldValue.serverTimestamp() });
  });
}

/**
 * Step 2. Publishes the website a paid payment was for. Safe to run any number
 * of times, from any number of workers at once: it publishes at most once.
 */
async function publishPaidPayment(paymentId: string, requestedSlug?: string): Promise<FulfilResult> {
  const db = adminDb();
  const paymentRef = db.doc(`payments/${paymentId}`);
  let siteId = "";
  let publishing = false;

  try {
    return await db.runTransaction(async (tx): Promise<FulfilResult> => {
      publishing = false;
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) throw new PublishError("not_found", "We couldn't find that payment.");
      const payment = paymentSnap.data() as PaymentDoc;
      siteId = payment.siteId;
      // Only money the provider confirmed can publish.
      if (payment.status !== "paid") throw new PublishError("conflict", "This payment hasn't been confirmed.");

      const siteRef = db.doc(`sites/${payment.siteId}`);
      const quotaRef = db.doc(`userQuotas/${payment.ownerUid}`);
      const [siteSnap, quotaSnap] = await tx.getAll(siteRef, quotaRef);
      const site = siteSnap.exists ? (siteSnap.data() as SiteDoc) : null;
      const lockedDraftId = (quotaSnap.data() as Partial<UserQuotaDoc> | undefined)?.openDraftSiteId;
      const live = site && site.ownerUid === payment.ownerUid && site.status === "published" && site.slug ? site.slug : null;
      const now = FieldValue.serverTimestamp();
      const base = { paymentId, siteId: payment.siteId, slug: live, published: false };

      /** Leaves the payment paid and flagged; writes only when something changes. */
      const hold = (reason: PaymentAttentionReason): FulfilResult => {
        const duplicate = reason === "duplicate";
        if (payment.needsAttention !== true || payment.attentionReason !== reason || (duplicate && !payment.duplicate)) {
          tx.update(paymentRef, {
            needsAttention: true,
            attentionReason: reason,
            ...(duplicate ? { duplicate: true } : {}),
            updatedAt: now,
          });
        }
        return { ...base, needsAttention: reason, ...(duplicate ? { duplicate: true } : {}) };
      };

      if (payment.duplicate) return hold("duplicate");
      if (typeof payment.paidAmountSen === "number" && payment.paidAmountSen !== payment.amountSen) {
        return hold("amount_mismatch");
      }
      if (!site) return hold("site_missing");
      if (site.ownerUid !== payment.ownerUid) return hold("owner_mismatch");

      if (live) {
        // Live through another payment: this one is the second charge.
        if (site.paymentId && site.paymentId !== paymentId) return hold("duplicate");
        // Already published by this payment (or before sites recorded which payment did).
        if (!payment.fulfilledAt || payment.needsAttention) {
          tx.update(paymentRef, {
            needsAttention: false,
            attentionReason: null,
            fulfilledAt: payment.fulfilledAt ?? now,
            updatedAt: now,
          });
        }
        return base;
      }

      publishing = true;
      const content = publishableContent(site.draft);
      const slug = await claimSlug(tx, requestedSlug ?? payment.slug, payment.siteId, payment.ownerUid);

      tx.set(db.doc(`publicSites/${slug}`), {
        siteId: payment.siteId,
        slug,
        content,
        publishedAt: now,
        updatedAt: now,
      });
      tx.update(siteRef, {
        status: "published",
        paid: true,
        paidAt: payment.paidAt,
        slug,
        published: content,
        publishedAt: now,
        paymentId,
        updatedAt: now,
      });
      tx.update(paymentRef, {
        ...(requestedSlug ? { slug: requestedSlug } : {}),
        needsAttention: false,
        attentionReason: null,
        fulfilledAt: now,
        updatedAt: now,
      });
      // Only now that the site is live, and only if the lock is this site's.
      if (lockedDraftId === payment.siteId) {
        tx.update(quotaRef, { openDraftSiteId: null, updatedAt: now });
      }
      return { ...base, slug, published: true };
    });
  } catch (error) {
    // A refusal before publishing started (no such payment, not paid) isn't a publishing failure.
    if (error instanceof PublishError && !publishing) throw error;
    const reason: PaymentAttentionReason =
      error instanceof PublishError
        ? error.code === "bad_request"
          ? "invalid_draft"
          : "slug_unavailable"
        : "fulfilment_error";
    console.error("[payments] paid payment not published; kept paid for retry", {
      paymentId,
      siteId,
      reason,
      error: error instanceof Error ? error.name : typeof error,
    });
    try {
      await flagAttention(paymentId, reason);
    } catch (flagError) {
      console.error("[payments] couldn't flag payment for attention", {
        paymentId,
        error: flagError instanceof Error ? flagError.name : typeof flagError,
      });
    }
    // Permanent for now: say so. Transient: rethrow so the caller (and Billplz) try again.
    if (error instanceof PublishError) return { paymentId, siteId, slug: null, published: false, needsAttention: reason };
    throw error;
  }
}

function finish(result: FulfilResult): FulfilResult {
  if (result.duplicate) {
    console.error("[payments] duplicate payment for a site that is already live; refund it", {
      paymentId: result.paymentId,
      siteId: result.siteId,
    });
  } else if (result.needsAttention) {
    console.error("[payments] paid payment needs attention", {
      paymentId: result.paymentId,
      siteId: result.siteId,
      reason: result.needsAttention,
    });
  }
  if (result.published && result.slug) revalidateTag(siteCacheTag(result.slug), { expire: 0 });
  return result;
}

/**
 * Records a provider-confirmed payment and publishes its website. The one path
 * from "paid" to "live", shared by the callback and the return page.
 */
export async function fulfilPayment(
  verification: Extract<PaymentVerification, { state: "paid" }>,
  options: { slug?: string } = {},
): Promise<FulfilResult> {
  const paymentId = await resolvePaymentId(verification);
  if (!paymentId) {
    console.error("[payments] verified payment matches no Webbi checkout", { providerRef: verification.providerRef });
    throw new PublishError("not_found", "We couldn't match that payment to a website.");
  }
  await recordPaidPayment(paymentId, verification);
  return finish(await publishPaidPayment(paymentId, options.slug));
}

/**
 * Runs step 2 again for a payment already recorded as paid. Never charges and
 * never marks anything paid: a pending or failed payment is refused. Server
 * only; the one owner-facing caller is checkout, for the owner's own payment.
 */
export async function retryPaymentFulfilment(paymentId: string, options: { slug?: string } = {}): Promise<FulfilResult> {
  if (!PAYMENT_ID.test(paymentId)) throw new PublishError("not_found", "We couldn't find that payment.");
  return finish(await publishPaidPayment(paymentId, options.slug));
}

/** Paid payments whose website isn't live, for whoever looks after refunds and retries. */
export async function paymentsNeedingAttention(limit = 50): Promise<SitePayment[]> {
  const snap = await adminDb().collection("payments").where("needsAttention", "==", true).limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PaymentDoc) }));
}

function millis(value: unknown): number {
  const toMillis = (value as { toMillis?: () => number } | null)?.toMillis;
  return typeof toMillis === "function" ? toMillis.call(value) : 0;
}

export type OpenCheckout = { kind: "open"; paymentId: string; url: string } | { kind: "paid"; result: FulfilResult };

/**
 * The site's newest checkout that is still open with the provider, so a second
 * Pay press reuses it instead of opening another bill. When the provider says
 * it was paid after all, it is fulfilled here. A bill the provider no longer
 * has, or has deleted, isn't reused (and is never marked paid).
 */
export async function reuseOpenCheckout(
  provider: PaymentProvider,
  payments: SitePayment[],
  slug: string,
): Promise<OpenCheckout | null> {
  const [latest] = payments
    .filter((payment) => payment.status === "pending" && payment.providerRef && payment.provider === provider.name)
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt) || (a.id < b.id ? 1 : -1));
  if (!latest?.providerRef) return null;

  let verification: PaymentVerification;
  try {
    verification = await provider.verifyCheckout(latest.providerRef);
  } catch (error) {
    if (error instanceof PaymentError && error.code === "not_found") {
      console.warn("[payments] open checkout unknown to the provider; opening a new one", { paymentId: latest.id });
      return null;
    }
    throw error;
  }
  if (verification.providerRef !== latest.providerRef) return null;

  switch (verification.state) {
    case "paid":
      return { kind: "paid", result: await fulfilPayment(verification, { slug }) };
    case "failed":
      await markPaymentFailed(latest.id, verification.reason, verification.providerRef);
      return null;
    case "pending": {
      if (!latest.checkoutUrl) return null;
      const db = adminDb();
      const ref = db.doc(`payments/${latest.id}`);
      const stillOpen = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const payment = snap.exists ? (snap.data() as PaymentDoc) : null;
        if (payment?.status !== "pending") return false;
        if (payment.slug !== slug) tx.update(ref, { slug, updatedAt: FieldValue.serverTimestamp() });
        return true;
      });
      return stillOpen ? { kind: "open", paymentId: latest.id, url: latest.checkoutUrl } : null;
    }
  }
}

/**
 * Before a draft is deleted: asks the provider about each of its open checkouts,
 * so a payment made a moment ago publishes instead of being lost with the draft.
 */
export async function settleOpenCheckouts(provider: PaymentProvider | null, siteId: string, uid: string): Promise<void> {
  const open = (await sitePayments(siteId, uid)).filter((payment) => payment.status === "pending" && payment.providerRef);
  for (const payment of open) {
    if (!provider || payment.provider !== provider.name || !payment.providerRef) continue;
    let verification: PaymentVerification;
    try {
      verification = await provider.verifyCheckout(payment.providerRef);
    } catch (error) {
      if (error instanceof PaymentError && error.code === "not_found") continue;
      console.error("[payments] couldn't check an open checkout before deleting", { paymentId: payment.id, siteId });
      throw new PublishError("conflict", "We couldn't check this Webbi's payment just now, so it wasn't deleted. Try again in a moment.");
    }
    if (verification.providerRef !== payment.providerRef) continue;
    if (verification.state === "paid") await fulfilPayment(verification);
    else if (verification.state === "failed") await markPaymentFailed(payment.id, verification.reason, verification.providerRef);
  }
}

/**
 * Finds the first free link among `slug`, `slug-2` … and reserves it. Runs
 * inside the fulfilment transaction so two sites can never take the same one.
 */
async function claimSlug(tx: Transaction, requested: string, siteId: string, ownerUid: string): Promise<string> {
  const db = adminDb();
  const base = isValidSlug(requested) && !isReservedSlug(requested) ? requested : `site-${siteId.slice(0, 8).toLowerCase()}`;
  const candidates = slugCandidates(base).filter((c) => !isReservedSlug(c));
  const snaps = await tx.getAll(...candidates.map((c) => db.doc(`slugs/${c}`)));
  for (let i = 0; i < candidates.length; i++) {
    const snap = snaps[i];
    if (snap.exists) {
      const owner = snap.data() as SlugDoc;
      if (owner.siteId === siteId) return candidates[i];
      continue;
    }
    const doc: Omit<SlugDoc, "createdAt"> & Record<string, unknown> = {
      siteId,
      ownerUid,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(snap.ref, doc);
    return candidates[i];
  }
  throw new PublishError("conflict", "That link is taken. Go back and choose a different one.");
}

/** Copies the current draft of a paid, published site to its live page. */
export async function republishSite(siteId: string, uid: string): Promise<{ slug: string }> {
  const db = adminDb();
  const siteRef = db.doc(`sites/${siteId}`);
  const slug = await db.runTransaction(async (tx) => {
    const snap = await tx.get(siteRef);
    const site = snap.exists ? (snap.data() as SiteDoc) : null;
    if (!site || site.ownerUid !== uid) throw new PublishError("not_found", "We couldn't find that website.");
    if (site.status !== "published" || !site.paid || !site.slug) {
      throw new PublishError("conflict", "This website isn't live yet. Publish it first.");
    }
    const content = publishableContent(site.draft);
    const now = FieldValue.serverTimestamp();
    tx.set(db.doc(`publicSites/${site.slug}`), { siteId, slug: site.slug, content, updatedAt: now }, { merge: true });
    tx.update(siteRef, { published: content, publishedAt: now, updatedAt: now });
    return site.slug;
  });
  revalidateTag(siteCacheTag(slug), { expire: 0 });
  return { slug };
}
