import "server-only";
import { serverEnv } from "@/lib/env";
import { billplzProvider } from "./billplz";
import { mockProvider } from "./mock";
import { PaymentError, type PaymentProvider } from "./provider";
import { stripeProvider } from "./stripe";

export { PaymentError } from "./provider";
export type { PaymentProvider, PaymentVerification, RedirectRead } from "./provider";

/** The configured provider, or a PaymentError when payments aren't set up yet. */
export function getPaymentProvider(): PaymentProvider {
  switch (serverEnv.paymentProvider) {
    case "billplz":
      return billplzProvider;
    case "stripe":
      return stripeProvider;
    case "mock":
      return mockProvider;
    default:
      throw new PaymentError(
        "payments_not_configured",
        "Payments aren't switched on yet. Set the Billplz keys on the server (see README).",
      );
  }
}

export function isPaymentConfigured(): boolean {
  return serverEnv.paymentProvider !== "none";
}
