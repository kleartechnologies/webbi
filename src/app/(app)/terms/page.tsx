import type { Metadata } from "next";
import { LegalPage } from "@/components/app/LegalPage";
import { PRICE_LABEL } from "@/lib/env";
import { legalMetadata } from "@/lib/seo";

export const metadata: Metadata = legalMetadata("Terms of Service", "/terms");

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="12 September 2026">
      <h2>What Webbi is</h2>
      <p>
        Webbi builds and hosts a one-page website for your business from the description you give us. You can
        preview and edit your website for free. Publishing it at a public web address costs {PRICE_LABEL}, paid once
        per website.
      </p>
      <h2>Your content</h2>
      <p>
        You own the text, photos and business details you add to Webbi. By publishing, you allow us to display them
        on your website and to store them on our infrastructure. You confirm you have the right to use everything
        you upload, and that your website does not contain anything unlawful, misleading or harmful.
      </p>
      <h2>AI-generated drafts</h2>
      <p>
        The first draft of your website is written by AI from your description. Check it before you publish. You are
        responsible for the accuracy of prices, claims and contact details on your website.
      </p>
      <h2>Payment and refunds</h2>
      <p>
        The one-time fee is charged when you choose to publish. It keeps your website live on a Webbi address. If
        something goes wrong with a payment, contact us and we will put it right.
      </p>
      <h2>Acceptable use</h2>
      <p>
        We may take down websites that break the law, infringe on others, or abuse the service. We will contact you
        first whenever reasonably possible.
      </p>
      <h2>Changes</h2>
      <p>We may update these terms as Webbi grows. Material changes will be announced on this page.</p>
    </LegalPage>
  );
}
