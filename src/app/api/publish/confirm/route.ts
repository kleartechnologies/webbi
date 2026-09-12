import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { getPaymentProvider } from "@/lib/payments";
import { fulfilPayment, getPayment, markPaymentFailed } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

/** One Firestore auto-id (or similar) — no slashes, never empty. */
const PAYMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const bodySchema = z.object({
  siteId: z.string().min(1).max(64),
  sessionId: z.string().min(1).max(200),
});

/**
 * Called by the return page after checkout. The session id from the URL is
 * only a lookup key: we ask the provider whether it was paid, check the
 * payment belongs to this user and site, and only then fulfil.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`confirm:${user.uid}`, 30, 60_000);
    const { siteId, sessionId } = bodySchema.parse(await request.json());
    const verification = await getPaymentProvider().verifyCheckout(sessionId);

    // A session we can't tie back to one of our payment records is never fulfilled.
    // The id comes from the provider's session, so it is also validated as a
    // single Firestore document id before it goes anywhere near a path.
    if (verification.paymentId !== null && !PAYMENT_ID.test(verification.paymentId)) {
      return apiError(404, "not_found", "We couldn't match that payment to a website.");
    }
    if (verification.paymentId) {
      const payment = await getPayment(verification.paymentId);
      if (!payment || payment.ownerUid !== user.uid || payment.siteId !== siteId) {
        return apiError(403, "forbidden", "This payment doesn't belong to that website.");
      }
    }

    switch (verification.state) {
      case "paid": {
        const result = await fulfilPayment(verification);
        return NextResponse.json({ status: "published", slug: result.slug });
      }
      case "pending":
        return NextResponse.json({ status: "pending" });
      case "failed":
        if (verification.paymentId) await markPaymentFailed(verification.paymentId, verification.reason);
        return NextResponse.json({ status: "failed", reason: verification.reason });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
