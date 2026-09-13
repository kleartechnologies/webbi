import { PRICE_LABEL } from "@/lib/env";
import { DEMO_SITES } from "@/lib/site/demo";
import { BrowserChrome } from "./BrowserChrome";
import { CreateCta, GhostCta } from "./Cta";
import { siteAddress, vars } from "./content";
import { Band, Inner } from "./Section";
import { SitePreview } from "./SitePreview";

export function FinalCta() {
  return (
    <Band z={8} className="overflow-hidden bg-blue text-white">
      <div aria-hidden className="absolute -top-[160px] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-light" />
      <Inner className="relative grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] items-center gap-[clamp(28px,4vw,56px)]">
        <div className="lp-reveal flex flex-col items-start gap-5">
          <h2 className="font-display text-[clamp(36px,6vw,72px)] font-extrabold leading-[0.98] tracking-[-0.045em] text-sun">
            Tell us what you do.
            <br />
            <span className="text-white">We&apos;ll take it from here.</span>
          </h2>
          <p className="max-w-[34ch] text-[clamp(16px,1.8vw,20px)] leading-[1.45] text-white/85">
            It takes about as long as telling a friend what you do.
          </p>
          <div className="flex flex-wrap gap-3">
            <CreateCta />
            <GhostCta href="#examples">See Examples</GhostCta>
          </div>
          <p className="text-[13px] text-white/72">Free to create and preview · {PRICE_LABEL} once when you publish</p>
        </div>

        <div className="lp-reveal flex justify-center py-6" style={vars({ "--lp-delay": "120ms", "--lp-rise": "22px" })}>
          <div data-float="0.08" className="w-[min(340px,86vw)] overflow-hidden rounded-[26px] bg-surface shadow-[0_34px_70px_rgba(8,12,40,.4)] [transform:rotate(3deg)_translateY(var(--py,0px))]">
            <BrowserChrome url={siteAddress("hafiz-rahman")} size="sm" />
            <SitePreview site={DEMO_SITES["hafiz-rahman"]} width={900} scale={0.378} height={300} className="bg-[#15171C]" />
          </div>
        </div>
      </Inner>
    </Band>
  );
}
