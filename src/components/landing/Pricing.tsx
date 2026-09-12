import { Icon } from "@/components/ui";
import { PRICE_LABEL } from "@/lib/env";
import { CreateCta } from "./Cta";
import { HOST, vars } from "./content";
import { Band, Eyebrow, Heading, Inner } from "./Section";

const STEPS = ["Describe your business — no account needed", "Preview and edit the real website, free", "Pay once, pick your link, go live"];
const INCLUDED = ["Create your website", "Customize it", `Publish it on ${HOST}`];

export function Pricing() {
  return (
    <Band id="pricing" z={7} className="bg-amber text-ink">
      <Inner className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-center gap-[clamp(24px,4vw,48px)]">
        <div className="lp-reveal flex flex-col gap-4">
          <Eyebrow className="text-ink/60">Pricing</Eyebrow>
          <Heading className="leading-[1.0]">One price. One website. Yours.</Heading>
          <p className="max-w-[40ch] text-[17px] leading-[1.5] text-ink/78">
            Free to create and preview. Pay once when you are ready to go live — no subscription, no renewal, ever.
          </p>
          <ol className="flex flex-col gap-[10px] text-[15px] font-semibold">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[12px] font-extrabold ${i === 2 ? "bg-ink text-sun" : "bg-ink/14"}`}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="lp-reveal flex flex-col gap-[18px] rounded-[30px] bg-ink p-7 text-white shadow-[0_26px_60px_rgba(20,26,59,.28)]" style={vars({ "--lp-delay": "100ms" })}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2">
            <span className="font-display text-[clamp(46px,7vw,68px)] font-extrabold leading-[0.9] tracking-[-0.045em] text-sun">{PRICE_LABEL}</span>
            <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-white/65">one time</span>
          </div>
          <ul className="flex flex-col gap-[11px] text-[15px]">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-[10px]">
                <Icon name="check_circle" size={20} fill className="text-sun" />
                {item}
              </li>
            ))}
          </ul>
          <CreateCta height={58} className="w-full shadow-none" />
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/62">
            <span className="flex h-[30px] items-center rounded-[9px] bg-white/12 px-[11px] font-bold text-white">FPX</span>
            <span className="flex h-[30px] items-center rounded-[9px] bg-white/12 px-[11px] font-bold text-white">Card</span>
            <span>Secure payment · edit any time after publishing</span>
          </div>
        </div>
      </Inner>
    </Band>
  );
}
