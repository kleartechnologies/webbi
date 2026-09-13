"use client";

import { Icon } from "@/components/ui";
import { PRICE_LABEL } from "@/lib/env";
import { CreateCta, GhostCta } from "./Cta";
import { HeroPhone } from "./HeroPhone";
import { useLandingCopy } from "./i18n/LandingLanguage";

export function Hero() {
  const { hero } = useLandingCopy();
  return (
    <section id="top" className="relative -mt-[72px] overflow-hidden bg-blue px-4 pt-[112px] pb-14 text-white">
      <div aria-hidden className="absolute -top-[140px] -right-[120px] h-[460px] w-[460px] rounded-full bg-blue-light" />
      <div aria-hidden className="absolute -bottom-[180px] -left-[140px] h-[420px] w-[420px] rounded-full bg-blue-deep" />

      <div className="relative mx-auto grid w-full max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-[clamp(28px,4vw,56px)]">
        <div className="flex max-w-[600px] flex-col items-start gap-[22px]">
          <h1 className="font-display text-[clamp(42px,7.2vw,86px)] font-extrabold leading-[0.96] tracking-[-0.045em] text-sun">
            {hero.titleLead}
            <br />
            <span className="text-white">{hero.titleRest}</span>
          </h1>
          <p className="max-w-[34ch] text-[clamp(17px,2vw,21px)] leading-[1.45] text-white/88">
            {hero.lede}
          </p>
          <div className="flex flex-wrap gap-3">
            <CreateCta />
            <GhostCta href="#how">{hero.how}</GhostCta>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-white/82">
            {hero.checks(PRICE_LABEL).map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Icon name="check_circle" size={18} fill className="text-sun" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-reveal flex flex-col items-center gap-[18px] justify-self-center pt-6 pb-4" style={{ "--lp-delay": "120ms", "--lp-rise": "26px" } as React.CSSProperties}>
          <HeroPhone />
          <p className="text-center font-mono text-[11px] leading-[1.4] text-white/70">{hero.caption}</p>
        </div>
      </div>
    </section>
  );
}
