import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { getPaymentProvider, PaymentError } from "@/lib/payments";
import { fulfilPayment, markPaymentFailed, PublishError, resolvePaymentId } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Provider → Webbi. Billplz POSTs the bill here (form-encoded, X Signature in
 * the body); Stripe posts signed events. Anything whose signature doesn't verify
 * is rejected with 400 before it is acted on. A verified `paid` is the
 * authoritative path to publishing; the return page is only a fast path to the
 * same idempotent fulfilment, and it asks the provider directly too.
 */
export async function POST(request: Request) {
  let provider;
  try {
    provider = getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentError) return apiError(503, "payments_not_configured", error.message);
    throw error;
  }

  const rawBody = await request.text();
  let verification;
  try {
    verification = await provider.parseWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof PaymentError && error.code === "bad_signature") {
      return apiError(400, "bad_request", "Invalid signature.");
    }
    console.error("[webhook] parse failed", error);
    return apiError(500, "internal", "Webhook could not be processed.");
  }
  if (!verification) return NextResponse.json({ received: true, ignored: true });

  try {
    switch (verification.state) {
      case "paid": {
        const result = await fulfilPayment(verification);
        return NextResponse.json({ received: true, slug: result.slug, published: result.published });
      }
      case "failed": {
        const paymentId = await resolvePaymentId(verification);
        if (paymentId) await markPaymentFailed(paymentId, verification.reason, verification.providerRef);
        return NextResponse.json({ received: true, failed: true });
      }
      case "pending":
        return NextResponse.json({ received: true, pending: true });
    }
  } catch (error) {
    if (error instanceof PublishError) {
      // Permanent for this event; retrying won't help. Logged for follow-up.
      console.error("[webhook] fulfilment refused", verification, error.message);
      return NextResponse.json({ received: true, refused: error.code });
    }
    // Transient (admin not configured, Firestore down): 500 so the provider retries.
    console.error("[webhook] fulfilment failed", error);
    return apiError(500, "internal", "Fulfilment failed; will retry.");
  }
}
