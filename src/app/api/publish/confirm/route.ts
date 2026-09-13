import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { getPaymentProvider } from "@/lib/payments";
import { fulfilPayment, getPayment, markPaymentFailed, resolvePaymentId } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  siteId: z.string().min(1).max(64),
  /** The checkout the return URL names: Stripe's session_id, or Billplz's billplz[id]. */
  sessionId: z.string().min(1).max(200),
  /** The whole return query, so a provider that signs its redirect can be checked. */
  redirectQuery: z.string().max(2000).optional(),
});

/**
 * Called by the return page after checkout. Nothing the browser sends is taken
 * as proof of payment: the checkout id is only a lookup key, a signed redirect
 * must verify before it is used even as that, and the paid/unpaid answer comes
 * from the provider's own records. The payment must also be this user's, for
 * this site, and for this exact checkout before anything is fulfilled.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`confirm:${user.uid}`, 30, 60_000);
    const { siteId, sessionId, redirectQuery } = bodySchema.parse(await request.json());
    const provider = getPaymentProvider();

    // Providers that sign their redirect (Billplz) must present a valid signature
    // for this checkout. Anything else waits for the provider's signed callback.
    const redirect = provider.parseRedirect ? provider.parseRedirect(new URLSearchParams(redirectQuery ?? "")) : null;
    if (provider.parseRedirect && (!redirect || redirect.signatureValid !== true || redirect.providerRef !== sessionId)) {
      console.warn("[confirm] redirect not verified; waiting for the provider callback", { siteId, provider: provider.name });
      return NextResponse.json({ status: "pending" });
    }

    const verification = await provider.verifyCheckout(sessionId);
    const paymentId = await resolvePaymentId(verification);
    if (!paymentId) {
      return apiError(404, "not_found", "We couldn't match that payment to a website.");
    }
    const payment = await getPayment(paymentId);
    if (
      !payment ||
      payment.ownerUid !== user.uid ||
      payment.siteId !== siteId ||
      (payment.providerRef !== null && payment.providerRef !== verification.providerRef)
    ) {
      return apiError(403, "forbidden", "This payment doesn't belong to that website.");
    }

    switch (verification.state) {
      case "paid": {
        const result = await fulfilPayment(verification);
        return NextResponse.json({ status: "published", slug: result.slug });
      }
      case "pending":
        // The signed redirect already said the bill wasn't paid (cancelled, or the
        // bank declined). The bill can still be paid, so the record is left as it
        // is; the customer just isn't kept waiting for a payment that isn't coming.
        if (redirect?.paid === false) return NextResponse.json({ status: "failed", reason: "not_paid" });
        return NextResponse.json({ status: "pending" });
      case "failed":
        await markPaymentFailed(paymentId, verification.reason, verification.providerRef);
        return NextResponse.json({ status: "failed", reason: verification.reason });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
