import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import * as core from "./moderationCore";
import { siteCacheTag } from "./publicStore";

/**
 * Server-only moderation (Admin SDK). No route calls these: a website is
 * suspended or restored by an operator, with scripts/ops/moderate.mjs or from
 * server code. The rules and the details are in moderationCore.ts.
 */

export { isSuspended, MODERATION_REASON_MAX, ModerationError, SUSPENDED_MESSAGE } from "./moderationCore";

function refresh(slugs: string[]): void {
  for (const slug of slugs) {
    try {
      revalidateTag(siteCacheTag(slug), { expire: 0 });
    } catch (error) {
      // Outside a Next request (a script) the cached page expires within a minute anyway.
      console.warn("[moderation] couldn't revalidate a public page", { slug, error: error instanceof Error ? error.name : typeof error });
    }
  }
}

export async function suspendSite(siteId: string, reason: string): Promise<core.ModerationResult> {
  const result = await core.suspendSite(adminDb(), () => FieldValue.serverTimestamp(), siteId, reason);
  refresh(result.slugs);
  return result;
}

export async function unsuspendSite(siteId: string): Promise<core.ModerationResult> {
  const result = await core.unsuspendSite(adminDb(), () => FieldValue.serverTimestamp(), siteId);
  refresh(result.slugs);
  return result;
}
