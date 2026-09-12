import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { CapabilityStrip } from "@/components/landing/CapabilityStrip";
import { EditControl } from "@/components/landing/EditControl";
import { Examples } from "@/components/landing/Examples";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { MagicMoment } from "@/components/landing/MagicMoment";
import { LandingNav } from "@/components/landing/Nav";
import { Pricing } from "@/components/landing/Pricing";

/** Marketing landing (Webbi Landing v2). Product routes live under /start, /signin, /dashboard. */
export default function LandingPage() {
  return (
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
  );
}
