import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import {
  PaymentError,
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type PaymentVerification,
} from "./provider";

/**
 * Stripe Checkout adapter. Payment methods (FPX, cards, GrabPay, …) are the
 * ones enabled for MYR in the Stripe Dashboard; Checkout shows the right set
 * for the customer's device.
 *
 * Needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and a webhook endpoint at
 * /api/payments/webhook subscribed to checkout.session.* events.
 */
let client: Stripe | undefined;

function stripe(): Stripe {
  if (client) return client;
  const key = serverEnv.stripeSecretKey;
  if (!key) throw new PaymentError("payments_not_configured", "STRIPE_SECRET_KEY is not set.");
  client = new Stripe(key, { appInfo: { name: "Webbi", url: "https://webbi.my" } });
  return client;
}

function fromSession(session: Stripe.Checkout.Session): PaymentVerification {
  const paymentId = session.metadata?.paymentId ?? session.client_reference_id ?? null;
  if (session.status === "expired") {
    return { state: "failed", providerRef: session.id, paymentId, reason: "expired" };
  }
  if (session.payment_status === "paid" && paymentId) {
    return {
      state: "paid",
      providerRef: session.id,
      paymentId,
      amountSen: session.amount_total ?? 0,
      currency: (session.currency ?? "").toLowerCase(),
      paidAt: new Date(session.created * 1000),
    };
  }
  return { state: "pending", providerRef: session.id, paymentId };
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe().checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency,
                unit_amount: input.amountSen,
                product_data: {
                  name: `Webbi website for ${input.businessName}`,
                  description: `One-time payment. Live at ${input.publicUrl}`,
                },
              },
            },
          ],
          customer_email: input.email,
          client_reference_id: input.paymentId,
          metadata: { paymentId: input.paymentId, siteId: input.siteId, uid: input.uid },
          payment_intent_data: {
            description: `Webbi · ${input.publicUrl}`,
            metadata: { paymentId: input.paymentId, siteId: input.siteId },
          },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
        { idempotencyKey: `checkout:${input.paymentId}` },
      );
    } catch (error) {
      console.error("[stripe] create session failed", error);
      throw new PaymentError("provider_error", "The payment page couldn't be opened. Please try again.");
    }
    if (!session.url) throw new PaymentError("provider_error", "Stripe returned no checkout URL.");
    return { url: session.url, providerRef: session.id };
  },

  async verifyCheckout(providerRef: string): Promise<PaymentVerification> {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe().checkout.sessions.retrieve(providerRef);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) {
        throw new PaymentError("not_found", "We couldn't find that payment.");
      }
      console.error("[stripe] retrieve session failed", error);
      throw new PaymentError("provider_error", "We couldn't check the payment right now. Please try again.");
    }
    return fromSession(session);
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentVerification | null> {
    const secret = serverEnv.stripeWebhookSecret;
    if (!secret) throw new PaymentError("payments_not_configured", "STRIPE_WEBHOOK_SECRET is not set.");
    const signature = headers.get("stripe-signature") ?? "";
    let event: Stripe.Event;
    try {
      event = await stripe().webhooks.constructEventAsync(rawBody, signature, secret);
    } catch {
      throw new PaymentError("bad_signature", "Invalid Stripe signature.");
    }
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object;
        if (event.type === "checkout.session.async_payment_failed") {
          return {
            state: "failed",
            providerRef: session.id,
            paymentId: session.metadata?.paymentId ?? session.client_reference_id ?? null,
            reason: "payment_failed",
          };
        }
        return fromSession(session);
      }
      default:
        return null;
    }
  },
};
