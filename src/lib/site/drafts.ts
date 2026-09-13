import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { PublishError } from "./publish";
import type { Understanding } from "./schema";
import type { SiteDoc, UserQuotaDoc } from "./types";

/**
 * Starting and deleting drafts (Admin SDK, server only).
 *
 * An account may have one unpublished website at a time, and may start at most
 * DAILY_DRAFT_LIMIT websites a day. Both are tracked in userQuotas/{uid}, which
 * only the server can read or write. Every creation reads that document inside
 * its transaction, so simultaneous requests for one account serialise on it:
 * one commits, the others are retried, find the new draft and are refused.
 *
 * "Unpublished" is any status but published: a draft whose payment is pending,
 * failed, or paid but not yet fulfilled still holds the slot. The slot is freed
 * only by fulfilPayment (publish.ts) once the site is live, or by deleting the
 * draft here. Deleting never gives back a creation from the day's count.
 */

export const DAILY_DRAFT_LIMIT = 3;
/** Webbi's customers are in Malaysia, so the day's count turns over at midnight there. */
export const QUOTA_TIME_ZONE = "Asia/Kuala_Lumpur";
/** One Firestore auto-id: no slashes, never empty. */
export const SITE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export class DraftLimitError extends Error {
  constructor(
    public readonly code: "draft_exists" | "daily_limit",
    message: string,
    /** The website already in progress, when code is draft_exists. */
    public readonly existingSiteId?: string,
  ) {
    super(message);
    this.name = "DraftLimitError";
  }
}

/** The server's calendar day in Malaysia, as YYYY-MM-DD. Never the browser's clock. */
export function quotaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function millis(value: unknown): number {
  const toMillis = (value as { toMillis?: () => number } | null)?.toMillis;
  return typeof toMillis === "function" ? toMillis.call(value) : Number.POSITIVE_INFINITY;
}

/**
 * The account's unpublished website, if it has one. The lock is believed only
 * while it points at this owner's unpublished site. Otherwise the owner's drafts
 * are looked up, which also finds drafts made before the limit existed; with
 * several of those, the oldest counts as the one in progress.
 */
async function activeDraftId(tx: Transaction, uid: string, lockedId: string | null): Promise<string | null> {
  const db = adminDb();
  if (lockedId && SITE_ID.test(lockedId)) {
    const snap = await tx.get(db.doc(`sites/${lockedId}`));
    const site = snap.exists ? (snap.data() as SiteDoc) : null;
    if (site && site.ownerUid === uid && site.status !== "published") return lockedId;
  }
  const drafts = await tx.get(db.collection("sites").where("ownerUid", "==", uid).where("status", "==", "draft"));
  if (drafts.empty) return null;
  const [oldest] = [...drafts.docs].sort(
    (a, b) => millis(a.data().createdAt) - millis(b.data().createdAt) || (a.id < b.id ? -1 : 1),
  );
  return oldest.id;
}

export interface NewDraftInput {
  sourceDescription: string;
  /**
   * Sent only by pages loaded before the understand step moved after creation.
   * Without it the draft waits in "understanding" for POST /api/ai/understand.
   */
  understanding?: Understanding;
}

/** Starts the account's next website, or throws DraftLimitError. Returns the new site id. */
export async function createDraftSite(uid: string, input: NewDraftInput): Promise<string> {
  const db = adminDb();
  const quotaRef = db.doc(`userQuotas/${uid}`);

  // A refusal comes back as a value so a lock it adopted is still committed.
  const outcome = await db.runTransaction(async (tx): Promise<{ siteId: string } | { refused: DraftLimitError }> => {
    const quotaSnap = await tx.get(quotaRef);
    const quota = (quotaSnap.exists ? quotaSnap.data() : {}) as Partial<UserQuotaDoc>;
    const lockedId = quota.openDraftSiteId ?? null;
    const active = await activeDraftId(tx, uid, lockedId);
    const today = quotaDay();
    const createdToday = quota.draftsDay === today ? (quota.draftsCreatedToday ?? 0) : 0;
    const now = FieldValue.serverTimestamp();

    if (active) {
      if (active !== lockedId) {
        // A draft found by lookup becomes the lock. The site itself is left exactly as it is.
        tx.set(
          quotaRef,
          { openDraftSiteId: active, draftsCreatedToday: createdToday, draftsDay: today, updatedAt: now },
          { merge: true },
        );
      }
      return {
        refused: new DraftLimitError(
          "draft_exists",
          "You already have a website in progress. Finish or publish it before creating another website.",
          active,
        ),
      };
    }
    if (createdToday >= DAILY_DRAFT_LIMIT) {
      return {
        refused: new DraftLimitError("daily_limit", "You've reached today's website creation limit. Please try again tomorrow."),
      };
    }

    const siteRef = db.collection("sites").doc();
    const site: Omit<SiteDoc, "createdAt" | "updatedAt"> & Record<string, unknown> = {
      ownerUid: uid,
      status: "draft",
      paid: false,
      paidAt: null,
      slug: null,
      published: null,
      publishedAt: null,
      draft: null,
      sourceDescription: input.sourceDescription,
      generation: input.understanding
        ? { status: "understood", understanding: input.understanding }
        : { status: "understanding" },
      // Replaced by the understood language as soon as the description is read.
      language: input.understanding?.language ?? "en",
    };
    tx.set(siteRef, { ...site, createdAt: now, updatedAt: now });
    // Merged: the same document carries the account's AI counters (src/lib/ai/guard.ts).
    tx.set(
      quotaRef,
      { openDraftSiteId: siteRef.id, draftsCreatedToday: createdToday + 1, draftsDay: today, updatedAt: now },
      { merge: true },
    );
    return { siteId: siteRef.id };
  });

  if ("refused" in outcome) throw outcome.refused;
  return outcome.siteId;
}

/** Deletes an owner's unpaid draft and frees its slot. The day's creation count is untouched. */
export async function deleteDraftSite(uid: string, siteId: string): Promise<void> {
  const db = adminDb();
  const siteRef = db.doc(`sites/${siteId}`);
  const quotaRef = db.doc(`userQuotas/${uid}`);
  await db.runTransaction(async (tx) => {
    const [siteSnap, quotaSnap] = await tx.getAll(siteRef, quotaRef);
    const site = siteSnap.exists ? (siteSnap.data() as SiteDoc) : null;
    if (!site || site.ownerUid !== uid) throw new PublishError("not_found", "We couldn't find that website.");
    if (site.status !== "draft" || site.paid) {
      throw new PublishError("conflict", "This Webbi is paid for, so it can't be deleted.");
    }
    tx.delete(siteRef);
    // The draft's AI counts and lock go with it. The account's own AI counts stay.
    tx.delete(db.doc(`siteAi/${siteId}`));
    // Only a lock on this draft is released: never another site's.
    if ((quotaSnap.data() as Partial<UserQuotaDoc> | undefined)?.openDraftSiteId === siteId) {
      tx.update(quotaRef, { openDraftSiteId: null, updatedAt: FieldValue.serverTimestamp() });
    }
  });
}
