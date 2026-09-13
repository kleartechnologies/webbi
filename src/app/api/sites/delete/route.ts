import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { deleteSiteImages } from "@/lib/images/storage";
import { getPaymentProvider, isPaymentConfigured } from "@/lib/payments";
import { SITE_ID, deleteDraftSite } from "@/lib/site/drafts";
import { settleOpenCheckouts } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({ siteId: z.string().regex(SITE_ID) });

/**
 * Deletes the caller's own unpaid draft and frees their unpublished-website
 * slot. Open checkouts are checked with the provider first, so a payment made
 * a moment ago publishes the website instead of being deleted with it. A site
 * with a paid payment, or a live site, is never deleted here.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { siteId } = bodySchema.parse(await request.json().catch(() => null));
    await settleOpenCheckouts(isPaymentConfigured() ? getPaymentProvider() : null, siteId, user.uid);
    await deleteDraftSite(user.uid, siteId);
    try {
      await deleteSiteImages(user.uid, siteId);
    } catch (error) {
      console.error("[images] deleted draft's photos not removed", error);
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
