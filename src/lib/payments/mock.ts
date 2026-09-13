import "server-only";
import {
  PaymentError,
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type PaymentVerification,
} from "./provider";

/**
 * Development-only stand-in so the publish flow can be exercised against the
 * Firebase emulators without a Stripe account. It never runs in production
 * (see serverEnv.paymentProvider) and its "checkout" is a plainly labelled
 * local page — nothing about it resembles a real payment.
 */
const PREFIX = "mock_cs_";

export const mockProvider: PaymentProvider = {
  name: "mock",

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const providerRef = `${PREFIX}${input.paymentId}`;
    const url = new URL(input.successUrl);
    url.searchParams.set("session_id", providerRef);
    url.searchParams.set("mock", "1");
    return { url: url.toString(), providerRef };
  },

  async verifyCheckout(providerRef: string): Promise<PaymentVerification> {
    const paymentId = providerRef.startsWith(PREFIX) ? providerRef.slice(PREFIX.length) : "";
    if (!paymentId) throw new PaymentError("not_found", "Unknown mock checkout.");
    return {
      state: "paid",
      providerRef,
      paymentId,
      amountSen: 14990,
      currency: "myr",
      paidAt: new Date(),
    };
  },

  async parseWebhook(): Promise<PaymentVerification | null> {
    throw new PaymentError("bad_signature", "The mock provider has no webhooks.");
  },
};
