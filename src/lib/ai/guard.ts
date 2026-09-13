import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAiProvider, type AiProvider } from "@/lib/ai";
import { requireUser, type VerifiedUser } from "@/lib/auth/verify";
import { adminDb } from "@/lib/firebase/admin";
import { quotaDay, SITE_ID } from "@/lib/site/drafts";
import { PublishError } from "@/lib/site/publish";
import type { GenerationState, SiteAiDoc, SiteDoc, UserQuotaDoc } from "@/lib/site/types";
import { AiError, AiQuotaError } from "./errors";

/**
 * The one way into Webbi's AI (Admin SDK, server only). Every route that can
 * reach a model provider goes through runAiJob, which:
 *
 *   1. refuses guests and anything but the caller's own unpublished website,
 *   2. builds the provider request from the stored site, never from the browser,
 *   3. in one transaction checks the account's day and month, the website's own
 *      allowance and its lock, then takes the lock and counts the request,
 *   4. only then calls the provider,
 *   5. in a second transaction saves the result and releases the lock.
 *
 * userQuotas/{uid} counts the account's AI requests for the Malaysia calendar
 * day and month (the day drafts.ts uses); understand and generate share that
 * allowance. siteAi/{siteId} counts each kind of request for one website and
 * holds its lock. No browser can read or write either (firestore.rules).
 *
 * A refused request writes nothing. An accepted request stays counted when it
 * fails, because the provider may already have done (and billed) the work: a
 * timeout, a server error or an unusable answer all count, so they can't be
 * looped for free. The one exception is a provider that turned the request away
 * before doing anything (not configured, key rejected, out of credit, rate
 * limited): that request is given back.
 */

export { AiQuotaError, type AiQuotaReason } from "./errors";

export const AI_DAILY_LIMIT = 10;
export const AI_MONTHLY_LIMIT = 30;
/** Per website, for each kind of request: the first run plus two more. */
export const AI_SITE_LIMIT = { understand: 3, generate: 3 } as const;
/**
 * A lock older than this belongs to a request that died without releasing it
 * (a crash, or the platform cutting the function off). The AI routes stop after
 * 60 seconds (maxDuration), so a request that is still running never holds it
 * this long.
 */
export const AI_LOCK_TTL_MS = 2 * 60_000;

export type AiJobKind = keyof typeof AI_SITE_LIMIT;

const SITE_COUNT = { understand: "understandings", generate: "generations" } as const satisfies Record<
  AiJobKind,
  keyof SiteAiDoc
>;

const GUEST = "Create an account to use Webbi's AI.";

/** The verified caller, if it is a real account. Guests never reach the AI. */
export async function requireAiAccount(request: Request): Promise<VerifiedUser> {
  const user = await requireUser(request);
  if (user.isAnonymous) throw new PublishError("forbidden", GUEST);
  return user;
}

/** The generation state without a previous failure message. */
export function withoutError(generation: GenerationState | undefined): Omit<GenerationState, "error"> {
  const next = { ...generation };
  delete next.error;
  return next as Omit<GenerationState, "error">;
}

export interface AiJob<Req, Res> {
  user: VerifiedUser;
  siteId: string;
  kind: AiJobKind;
  /**
   * The provider request, built from the owner's stored site. Throw to refuse
   * (PublishError or ZodError): nothing is counted. May run more than once.
   */
  prepare(site: SiteDoc): Req;
  run(provider: AiProvider, request: Req): Promise<Res>;
  /** Site fields to save once run() succeeds, given the site as it is at that moment. */
  save(result: Res, site: SiteDoc): Record<string, unknown>;
}

/** Failures where the provider turned the request away before doing any work. */
function refundable(error: unknown): boolean {
  return error instanceof AiError && (error.code === "ai_not_configured" || error.code === "rate_limited");
}

export async function runAiJob<Req, Res>(job: AiJob<Req, Res>): Promise<Res> {
  const { user, siteId, kind } = job;
  if (user.isAnonymous) throw new PublishError("forbidden", GUEST);
  if (!SITE_ID.test(siteId)) throw new PublishError("bad_request", "That website link isn't valid.");

  const db = adminDb();
  const siteRef = db.doc(`sites/${siteId}`);
  const usageRef = db.doc(`siteAi/${siteId}`);
  const quotaRef = db.doc(`userQuotas/${user.uid}`);
  const field = SITE_COUNT[kind];
  const requestId = randomUUID();

  const reserved = await db.runTransaction(async (tx) => {
    const [siteSnap, usageSnap, quotaSnap] = await tx.getAll(siteRef, usageRef, quotaRef);
    const site = siteSnap.exists ? (siteSnap.data() as SiteDoc) : null;
    if (!site) throw new PublishError("not_found", "We couldn't find that website.");
    if (site.ownerUid !== user.uid) throw new PublishError("forbidden", "This website belongs to another account.");
    if (site.status !== "draft") {
      throw new PublishError("forbidden", "Webbi's AI only works on websites that aren't published yet.");
    }
    const request = job.prepare(site);

    const now = Date.now();
    const day = quotaDay(new Date(now));
    const month = day.slice(0, 7);
    const quota = (quotaSnap.data() ?? {}) as Partial<UserQuotaDoc>;
    const usage = (usageSnap.data() ?? {}) as Partial<SiteAiDoc>;
    // Missing counters (accounts and drafts from before these limits) start at zero.
    const today = quota.aiDay === day ? (quota.aiRequestsToday ?? 0) : 0;
    const thisMonth = quota.aiMonth === month ? (quota.aiRequestsThisMonth ?? 0) : 0;
    const forSite = usage[field] ?? 0;

    if (usage.lock && now - usage.lock.startedAt < AI_LOCK_TTL_MS) throw new AiQuotaError("busy");
    if (forSite >= AI_SITE_LIMIT[kind]) throw new AiQuotaError("site_limit");
    if (today >= AI_DAILY_LIMIT) throw new AiQuotaError("daily_limit");
    if (thisMonth >= AI_MONTHLY_LIMIT) throw new AiQuotaError("monthly_limit");

    // The lock and both counts land together or not at all.
    const stamp = FieldValue.serverTimestamp();
    tx.set(
      usageRef,
      { ownerUid: user.uid, [field]: forSite + 1, lock: { requestId, kind, startedAt: now }, updatedAt: stamp },
      { merge: true },
    );
    tx.set(
      quotaRef,
      { aiDay: day, aiRequestsToday: today + 1, aiMonth: month, aiRequestsThisMonth: thisMonth + 1, updatedAt: stamp },
      { merge: true },
    );
    return { request, day, month };
  });

  /** Saves a result, or gives a refused request back, and releases the lock if it is still this request's. */
  async function finish(outcome: { result: Res } | { refund: boolean }): Promise<void> {
    const refund = "refund" in outcome && outcome.refund;
    await db.runTransaction(async (tx) => {
      const [siteSnap, usageSnap, quotaSnap] = await tx.getAll(siteRef, usageRef, quotaRef);
      const stamp = FieldValue.serverTimestamp();

      const site = siteSnap.exists ? (siteSnap.data() as SiteDoc) : null;
      if ("result" in outcome && site && site.ownerUid === user.uid && site.status === "draft") {
        tx.update(siteRef, { ...job.save(outcome.result, site), updatedAt: stamp });
      }

      // A deleted draft took its siteAi document with it: never bring it back.
      if (usageSnap.exists) {
        const usage = usageSnap.data() as Partial<SiteAiDoc>;
        const patch: Record<string, unknown> = {};
        // A stale lock that a later request took over is that request's to release.
        if (usage.lock?.requestId === requestId) patch.lock = null;
        if (refund && (usage[field] ?? 0) > 0) patch[field] = (usage[field] ?? 0) - 1;
        if (Object.keys(patch).length) tx.update(usageRef, { ...patch, updatedAt: stamp });
      }

      if (refund && quotaSnap.exists) {
        const quota = quotaSnap.data() as Partial<UserQuotaDoc>;
        const patch: Record<string, unknown> = {};
        // Only from the day and month it was counted in.
        const today = quota.aiRequestsToday ?? 0;
        const thisMonth = quota.aiRequestsThisMonth ?? 0;
        if (quota.aiDay === reserved.day && today > 0) patch.aiRequestsToday = today - 1;
        if (quota.aiMonth === reserved.month && thisMonth > 0) patch.aiRequestsThisMonth = thisMonth - 1;
        if (Object.keys(patch).length) tx.update(quotaRef, { ...patch, updatedAt: stamp });
      }
    });
  }

  const release = (refund: boolean) =>
    finish({ refund }).catch((error: unknown) => {
      // The lock then expires on its own after AI_LOCK_TTL_MS.
      console.error("[ai] couldn't release the AI lock", error);
    });

  let result: Res;
  try {
    result = await job.run(getAiProvider(), reserved.request);
  } catch (error) {
    await release(refundable(error));
    throw error;
  }
  try {
    await finish({ result });
  } catch (error) {
    await release(false);
    throw error;
  }
  return result;
}
