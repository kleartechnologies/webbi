import "server-only";

/**
 * Payment provider boundary.
 *
 * Everything the rest of Webbi knows about taking money is this interface.
 * A provider turns a pending payment into a hosted checkout, and later tells
 * us (from its own records, never from anything the browser says) whether
 * that checkout was paid. Publishing happens only on a `paid` verification.
 */

export type PaymentProviderName = "billplz" | "stripe" | "mock";

export interface CheckoutInput {
  /** Our payments/{paymentId} document, created before checkout starts. */
  paymentId: string;
  siteId: string;
  uid: string;
  email?: string;
  /** The account holder's name, when their sign-in gave us one. */
  customerName?: string;
  businessName: string;
  /** Public URL the customer is buying, for the receipt line. */
  publicUrl: string;
  amountSen: number;
  currency: "myr";
  /**
   * Where the provider sends the customer afterwards, with no query string.
   * Each adapter adds whatever its provider needs to identify the checkout.
   */
  successUrl: string;
  cancelUrl: string;
  /** Server endpoint the provider calls to confirm payment, for providers that take one per checkout. */
  callbackUrl: string;
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
      /**
       * Our payment id when the provider hands it back. Null when it can only be
       * found through providerRef (Billplz callbacks don't echo references).
       */
      paymentId: string | null;
      amountSen: number;
      currency: string;
      paidAt: Date;
    }
  | { state: "pending"; providerRef: string; paymentId: string | null }
  | { state: "failed"; providerRef: string; paymentId: string | null; reason: string };

/** What a provider's customer redirect says, before anyone believes it. */
export interface RedirectRead {
  /** The checkout the redirect is about. Only ever a lookup key. */
  providerRef: string;
  /** true when the signature verified; false when it is missing or wrong; null when the provider doesn't sign redirects. */
  signatureValid: boolean | null;
  /**
   * What the redirect claims about payment. Never used to publish; a verified
   * `false` only lets the return page stop waiting for a payment that didn't happen.
   */
  paid: boolean | null;
}

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
  /**
   * Reads the query string the provider appended to the customer's redirect.
   * Returns null when the query isn't one of this provider's redirects. The
   * result never proves payment; it only says which checkout to go and ask about.
   */
  parseRedirect?(query: URLSearchParams): RedirectRead | null;
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
