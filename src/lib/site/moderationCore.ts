/**
 * Suspending and restoring a website: the one implementation, shared by the
 * server (moderation.ts, which adds cache revalidation) and the operator's
 * command line (scripts/ops/moderate.mjs, which runs this file directly with
 * Node's type stripping). So it imports types only and takes the Firestore
 * instance and the server timestamp from its caller.
 *
 *   sites/{siteId}.moderationStatus   "active" | "suspended" (missing = active).
 *                                     Readable by the owner, written only here.
 *   siteModeration/{siteId}           the private reason. No browser can read it.
 *   publicSites/{slug}                while suspended, replaced by a marker with no
 *                                     content, owner or site id; the public page
 *                                     shows a generic "unavailable" notice.
 *
 * The slug stays claimed in slugs/{slug}, so nobody else can take the link, and
 * the published copy stays on the site document, so restoring needs no republish.
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { SiteDoc, SlugDoc } from "./types";

export const MODERATION_REASON_MAX = 500;
export const SUSPENDED_MESSAGE = "This website can't be published right now. Please contact Webbi support.";

const SITE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Control characters (tabs and newlines included) and line separators: none belong in a one-line note. */
function hasControl(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

export class ModerationError extends Error {
  readonly code: "bad_request" | "not_found";
  constructor(code: "bad_request" | "not_found", message: string) {
    super(message);
    this.name = "ModerationError";
    this.code = code;
  }
}

/** Missing or anything else counts as active: only the server ever writes "suspended". */
export function isSuspended(site: { moderationStatus?: unknown } | null | undefined): boolean {
  return site?.moderationStatus === "suspended";
}

function checkSiteId(siteId: string): void {
  if (typeof siteId !== "string" || !SITE_ID.test(siteId)) throw new ModerationError("bad_request", "Not a website id.");
}

/** A short, single-line internal note. Never shown to the public or the owner. */
export function moderationReason(reason: unknown): string {
  if (typeof reason !== "string") throw new ModerationError("bad_request", "A reason is required.");
  const trimmed = reason.trim();
  if (!trimmed) throw new ModerationError("bad_request", "A reason is required.");
  if (hasControl(trimmed)) throw new ModerationError("bad_request", "The reason must be one line of plain text.");
  if (trimmed.length > MODERATION_REASON_MAX) {
    throw new ModerationError("bad_request", `The reason must be at most ${MODERATION_REASON_MAX} characters.`);
  }
  return trimmed;
}

export interface ModerationResult {
  siteId: string;
  moderationStatus: "active" | "suspended";
  /** False when the site was already in that state (the reason may still have been updated). */
  changed: boolean;
  /** Public links whose page changed: hide or restore these in the page cache. */
  slugs: string[];
}

async function readSite(tx: Transaction, db: Firestore, siteId: string): Promise<SiteDoc> {
  const snap = await tx.get(db.doc(`sites/${siteId}`));
  if (!snap.exists) throw new ModerationError("not_found", "No such website.");
  return snap.data() as SiteDoc;
}

/** The site's link isn't registered to another website (sites from before the registry have no entry). */
async function linkIsFor(tx: Transaction, db: Firestore, slug: string | null, siteId: string): Promise<boolean> {
  if (!slug) return false;
  const snap = await tx.get(db.doc(`slugs/${slug}`));
  return !snap.exists || (snap.data() as SlugDoc).siteId === siteId;
}

/**
 * Takes a website down: its public page becomes "unavailable" and nothing can
 * publish it again until it is restored. Idempotent; a second call updates the reason.
 */
export async function suspendSite(
  db: Firestore,
  serverTimestamp: () => unknown,
  siteId: string,
  reason: string,
): Promise<ModerationResult> {
  checkSiteId(siteId);
  const note = moderationReason(reason);
  return db.runTransaction(async (tx) => {
    const site = await readSite(tx, db, siteId);
    // Every live copy of this site, plus its current link if that link is really its own.
    const copies = await tx.get(db.collection("publicSites").where("siteId", "==", siteId));
    const ownsSlug = await linkIsFor(tx, db, site.slug, siteId);
    const slugs = new Set(copies.docs.map((doc) => doc.id));
    if (site.slug && ownsSlug && site.status === "published") slugs.add(site.slug);

    const now = serverTimestamp();
    tx.update(db.doc(`sites/${siteId}`), { moderationStatus: "suspended", moderatedAt: now });
    tx.set(
      db.doc(`siteModeration/${siteId}`),
      { siteId, moderationStatus: "suspended", moderationReason: note, suspendedAt: now, updatedAt: now },
      { merge: true },
    );
    // A full replace: the content, site id and publish time are gone from the public copy.
    for (const slug of slugs) tx.set(db.doc(`publicSites/${slug}`), { slug, suspended: true, updatedAt: now });
    return { siteId, moderationStatus: "suspended", changed: !isSuspended(site), slugs: [...slugs] };
  });
}

/**
 * Restores a suspended website. A paid, published site goes back to the copy it
 * had when it was suspended; a draft can be published again. A payment held with
 * site_suspended stays flagged until its fulfilment is retried.
 */
export async function unsuspendSite(db: Firestore, serverTimestamp: () => unknown, siteId: string): Promise<ModerationResult> {
  checkSiteId(siteId);
  return db.runTransaction(async (tx) => {
    const site = await readSite(tx, db, siteId);
    if (!isSuspended(site)) return { siteId, moderationStatus: "active", changed: false, slugs: [] };
    const ownsSlug = await linkIsFor(tx, db, site.slug, siteId);

    const now = serverTimestamp();
    tx.update(db.doc(`sites/${siteId}`), { moderationStatus: "active", moderatedAt: now });
    tx.set(
      db.doc(`siteModeration/${siteId}`),
      { siteId, moderationStatus: "active", moderationReason: null, restoredAt: now, updatedAt: now },
      { merge: true },
    );
    const live = site.status === "published" && site.paid === true && site.slug && site.published && ownsSlug;
    if (!live || !site.slug) return { siteId, moderationStatus: "active", changed: true, slugs: [] };
    tx.set(db.doc(`publicSites/${site.slug}`), {
      siteId,
      slug: site.slug,
      content: site.published,
      publishedAt: site.publishedAt ?? now,
      updatedAt: now,
    });
    return { siteId, moderationStatus: "active", changed: true, slugs: [site.slug] };
  });
}
