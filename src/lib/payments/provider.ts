import "server-only";

/**
 * Payment provider boundary.
 *
 * Everything the rest of Webbi knows about taking money is this interface.
 * A provider turns a pending payment into a hosted checkout, and later tells
 * us — from its own records, never from anything the browser says — whether
 * that checkout was paid. Publishing happens only on a `paid` verification.
 */

export type PaymentProviderName = "stripe" | "mock";

export interface CheckoutInput {
  /** Our payments/{paymentId} document, created before checkout starts. */
  paymentId: string;
  siteId: string;
  uid: string;
  email?: string;
  businessName: string;
  /** Public URL the customer is buying, for the receipt line. */
  publicUrl: string;
  amountSen: number;
  currency: "myr";
  /** Where the provider sends the customer afterwards. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Hosted checkout page to redirect the customer to. */
  url: string;
  /** Provider's id for this checkout; stored on the payment record. */
  providerRef: string;
}

export type PaymentVerification =
  | {
      state: "paid";
      providerRef: string;
      paymentId: string;
      amountSen: number;
      currency: string;
      paidAt: Date;
    }
  | { state: "pending"; providerRef: string; paymentId: string | null }
  | { state: "failed"; providerRef: string; paymentId: string | null; reason: string };

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** Ask the provider directly whether a checkout was paid (used when the customer returns). */
  verifyCheckout(providerRef: string): Promise<PaymentVerification>;
  /**
   * Authenticate and interpret a webhook call. Returns null for events that
   * don't change a payment's state. Throws PaymentError("bad_signature") when
   * the call did not come from the provider.
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentVerification | null>;
}

export type PaymentErrorCode =
  | "payments_not_configured"
  | "bad_signature"
  | "provider_error"
  | "not_found";

export class PaymentError extends Error {
  constructor(
    public readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
