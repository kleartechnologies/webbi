import { Icon } from "@/components/ui";
import { DEMO_SITES } from "@/lib/site/demo";
import { vars } from "./content";
import { Band, Heading, Inner } from "./Section";
import { SitePreview } from "./SitePreview";

const BEFORE = ["Prices answered one chat at a time.", "Menu buried in an old story highlight.", "Nothing to send a customer who asks “where?”"];
const AFTER = ["Menu and prices on one page.", "Hours, address and a map that opens in Google Maps.", "A WhatsApp button that starts the order for them."];

export function BeforeAfter() {
  return (
    <Band z={6} className="bg-forest text-white">
      <Inner className="flex flex-col gap-9">
        <Heading className="lp-reveal max-w-[24ch] text-[clamp(32px,5.2vw,60px)]">Your business deserves more than a WhatsApp link.</Heading>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-5">
          <div className="lp-reveal flex flex-col gap-[14px] rounded-[26px] border-[1.5px] border-dashed border-white/30 p-[22px]">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/55">Before</span>
            <h3 className="text-[20px] font-bold">A link in your bio</h3>
            <ul className="flex flex-col gap-2 text-[14px] leading-[1.5] text-white/70">
              {BEFORE.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="mt-auto flex items-center gap-3 rounded-[16px] bg-black/22 p-[14px]">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/16">
                <Icon name="link" size={19} />
              </span>
              <span className="truncate font-mono text-[12px] text-white/60">instagram.com/yourbusiness</span>
            </div>
          </div>

          <div className="lp-reveal flex flex-col gap-[14px] rounded-[26px] bg-surface p-[22px] text-ink shadow-[0_26px_60px_rgba(0,0,0,.28)]" style={vars({ "--lp-delay": "120ms" })}>
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-whatsapp">After</span>
            <h3 className="text-[20px] font-bold">A website that does the answering</h3>
            <ul className="flex flex-col gap-2 text-[14px] leading-[1.5] text-muted">
              {AFTER.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="mt-auto overflow-hidden rounded-[16px] border border-line">
              <SitePreview site={DEMO_SITES["rasa-kampung"]} width={760} height={258} shift={790} className="bg-[#FBF7F0]" />
            </div>
          </div>
        </div>
      </Inner>
    </Band>
  );
}
