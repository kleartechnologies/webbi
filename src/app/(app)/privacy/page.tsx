import type { Metadata } from "next";
import { LegalPage } from "@/components/app/LegalPage";
import { legalMetadata } from "@/lib/seo";

export const metadata: Metadata = legalMetadata("Privacy Policy", "/privacy");

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="12 September 2026">
      <h2>What we collect</h2>
      <p>
        Your account details (name, email or Google account), the business description you type, and the content
        and photos you add to your website. Payment details are handled by our payment provider and never stored by
        Webbi.
      </p>
      <h2>How we use it</h2>
      <p>
        To build, host and let you edit your website, and to contact you about your account. Your business
        description is sent to an AI provider to generate your first draft; it is not used to train their models.
      </p>
      <h2>What is public</h2>
      <p>
        Only websites you have published are visible to the public. Drafts, your account and your uploads stay
        private to you.
      </p>
      <h2>Where it lives</h2>
      <p>
        Data is stored with Google Firebase (Singapore region) and served through Netlify. Both are bound by their
        own security and privacy commitments.
      </p>
      <h2>Your choices</h2>
      <p>
        You can edit or unpublish your website at any time from your dashboard. To delete your account and data,
        contact us and we will remove it.
      </p>
    </LegalPage>
  );
}
