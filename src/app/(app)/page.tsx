import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { CapabilityStrip } from "@/components/landing/CapabilityStrip";
import { EditControl } from "@/components/landing/EditControl";
import { Examples } from "@/components/landing/Examples";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingLanguage } from "@/components/landing/i18n/LandingLanguage";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { MagicMoment } from "@/components/landing/MagicMoment";
import { LandingNav } from "@/components/landing/Nav";
import { Pricing } from "@/components/landing/Pricing";
import { LANDING_METADATA, LANDING_STRUCTURED_DATA } from "@/lib/seo";

export const metadata = LANDING_METADATA;

/** Marketing landing (Webbi Landing v2). Product routes live under /start, /signin, /dashboard. */
export default function LandingPage() {
  return (
    <LandingLanguage>
      <script
        type="application/ld+json"
        // A fixed object from src/lib/seo.ts, never user input; "<" is escaped so it can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
      <div data-landing className="flex flex-1 flex-col">
        <LandingNav landing />
        <main className="flex flex-col">
          <Hero />
          <CapabilityStrip />
          <MagicMoment />
          <Examples />
          <HowItWorks />
          <EditControl />
          <BeforeAfter />
          <Pricing />
          <FinalCta />
        </main>
        <LandingFooter landing />
        <LandingMotion />
      </div>
    </LandingLanguage>
  );
}
