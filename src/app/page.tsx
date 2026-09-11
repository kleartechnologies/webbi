import { Faq } from "@/components/landing/Faq";
import { LandingFooter } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LandingNav } from "@/components/landing/Nav";
import { Examples, FinalCta, HowItWorks, Pricing, WhatsAppSection, WhyWebbi } from "@/components/landing/Sections";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <Examples />
        <WhyWebbi />
        <WhatsAppSection />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
