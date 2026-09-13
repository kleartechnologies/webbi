import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { PRICE_SEN, publicEnv } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { checkoutReturnPath, PAYMENT_CALLBACK_PATH, publicSiteUrl } from "@/lib/site/flow";
import {
  attachProviderRef,
  checkSlug,
  createPendingPayment,
  getOwnedSite,
  publishableContent,
} from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  siteId: z.string().min(1).max(64),
  slug: z.string().trim().toLowerCase().min(1).max(60),
});

/**
 * Starts checkout for a draft. Records a pending payment, opens a hosted
 * checkout with the provider and returns its URL. Nothing here publishes.
 * The price, currency, site and owner all come from the server: the browser
 * only names the draft and the link it wants.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`checkout:${user.uid}`, 10, 10 * 60_000);
    if (user.isAnonymous) {
      return apiError(403, "forbidden", "Create an account before paying so your website stays yours.");
    }
    const { siteId, slug } = bodySchema.parse(await request.json());
    const provider = getPaymentProvider();

    const site = await getOwnedSite(siteId, user.uid);
    if (site.status === "published") {
      return apiError(409, "conflict", "This website is already live.");
    }
    const content = publishableContent(site.draft);

    const check = await checkSlug(slug, siteId);
    if (check.status !== "available" && check.status !== "yours") {
      const message =
        check.status === "taken"
          ? "That link was just taken. Choose a different one."
          : "That link can't be used. Choose a different one.";
      return apiError(409, "conflict", message);
    }

    const paymentId = await createPendingPayment({ siteId, uid: user.uid, slug, provider: provider.name });
    const session = await provider.createCheckout({
      paymentId,
      siteId,
      uid: user.uid,
      email: user.email,
      customerName: user.name,
      businessName: content.business.name,
      publicUrl: publicSiteUrl(slug),
      amountSen: PRICE_SEN,
      currency: "myr",
      successUrl: `${publicEnv.siteUrl}${checkoutReturnPath(siteId)}`,
      cancelUrl: `${publicEnv.siteUrl}/s/${siteId}/publish?cancelled=1`,
      callbackUrl: `${publicEnv.siteUrl}${PAYMENT_CALLBACK_PATH}`,
    });
    await attachProviderRef(paymentId, session.providerRef);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
