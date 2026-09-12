import "server-only";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { PRICE_SEN } from "@/lib/env";
import { adminDb } from "@/lib/firebase/admin";
import type { PaymentProviderName, PaymentVerification } from "@/lib/payments/provider";
import { siteCacheTag } from "./publicStore";
import { siteContentSchema, type SiteContent } from "./schema";
import { isReservedSlug, isValidSlug } from "./slug";
import type { PaymentDoc, SiteDoc, SlugDoc } from "./types";

/**
 * Write side of publishing (Admin SDK, server only).
 *
 * The only path that marks a site paid + published is `fulfilPayment`, and it
 * runs only on a `paid` verification that came from the payment provider's
 * own records (webhook or a server-side session lookup). It is one Firestore
 * transaction and idempotent, so the webhook and the customer's return page
 * can both call it safely.
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
    status: "pending",
    failureReason: null,
    paidAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(doc);
  return ref.id;
}

export async function attachProviderRef(paymentId: string, providerRef: string): Promise<void> {
  await adminDb().doc(`payments/${paymentId}`).update({
    providerRef,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getPayment(paymentId: string): Promise<PaymentDoc | null> {
  const snap = await adminDb().doc(`payments/${paymentId}`).get();
  return snap.exists ? (snap.data() as PaymentDoc) : null;
}

export async function markPaymentFailed(paymentId: string, reason: string): Promise<void> {
  const ref = adminDb().doc(`payments/${paymentId}`);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const payment = snap.data() as PaymentDoc;
    if (payment.status === "paid") return; // never downgrade a verified payment
    tx.update(ref, { status: "failed", failureReason: reason, updatedAt: FieldValue.serverTimestamp() });
  });
}

export interface FulfilResult {
  siteId: string;
  slug: string;
  /** True when this call did the publishing (false when it had already happened). */
  published: boolean;
}

/**
 * Marks the payment paid and publishes the site, atomically. Safe to call
 * more than once for the same payment.
 */
export async function fulfilPayment(
  verification: Extract<PaymentVerification, { state: "paid" }>,
): Promise<FulfilResult> {
  const db = adminDb();
  const paymentRef = db.doc(`payments/${verification.paymentId}`);

  const result = await db.runTransaction(async (tx): Promise<FulfilResult> => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new PublishError("not_found", "We couldn't find that payment.");
    const payment = paymentSnap.data() as PaymentDoc;

    const siteRef = db.doc(`sites/${payment.siteId}`);
    const siteSnap = await tx.get(siteRef);
    if (!siteSnap.exists) throw new PublishError("not_found", "We couldn't find that website.");
    const site = siteSnap.data() as SiteDoc;
    if (site.ownerUid !== payment.ownerUid) {
      throw new PublishError("forbidden", "This payment doesn't belong to that website.");
    }

    // Already done (webhook and return page raced, or a retry).
    if (payment.status === "paid" && site.status === "published" && site.slug) {
      return { siteId: payment.siteId, slug: site.slug, published: false };
    }

    if (verification.amountSen !== payment.amountSen || verification.currency !== payment.currency) {
      tx.update(paymentRef, {
        status: "failed",
        failureReason: `amount_mismatch:${verification.amountSen}:${verification.currency}`,
        providerRef: verification.providerRef,
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new PublishError("bad_request", "The amount paid didn't match the price. Please contact support.");
    }

    const content = publishableContent(site.draft);
    const slug = site.status === "published" && site.slug
      ? site.slug
      : await claimSlug(tx, payment.slug, payment.siteId, payment.ownerUid);
    const paidAt = Timestamp.fromDate(verification.paidAt);
    const now = FieldValue.serverTimestamp();

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
      paidAt,
      slug,
      published: content,
      publishedAt: now,
      updatedAt: now,
    });
    tx.update(paymentRef, {
      status: "paid",
      providerRef: verification.providerRef,
      paidAt,
      failureReason: null,
      updatedAt: now,
    });
    return { siteId: payment.siteId, slug, published: true };
  });

  revalidateTag(siteCacheTag(result.slug), { expire: 0 });
  return result;
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
