import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Icon } from "@/components/ui";
import { PRICE_LABEL } from "@/lib/env";
import { DEMO_SITES } from "@/lib/site/demo";
import { HeroPrompt } from "./HeroPrompt";

/** iPhone-sized viewport the example site is laid out at, scaled into a 276×600 frame. */
const INNER = { width: 402, height: 874, scale: 0.687 };

/**
 * Hero mockup: the real renderer showing the Rasa Kampung example inside an
 * iOS frame, with the brief, the price and the WhatsApp button floating
 * around it. Marketing preview and product are the same code.
 */
export function HeroPhone() {
  return (
    <div className="relative w-[276px]">
      <div data-float="0.10" className="relative [transform:rotate(-4deg)_translateY(var(--py,0px))]">
        <div aria-hidden data-site-preview className="relative h-[600px] w-[276px] overflow-hidden rounded-[38px] bg-[#F2F2F7] shadow-[0_40px_80px_rgba(8,12,40,.45)]">
          <div className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-[48px] bg-[#F2F2F7]" style={{ width: INNER.width, height: INNER.height, transform: `scale(${INNER.scale})` }}>
            <div className="absolute top-[11px] left-1/2 z-20 h-[37px] w-[126px] -translate-x-1/2 rounded-[24px] bg-black" />
            <div className="absolute inset-x-0 top-0 z-10 flex h-[54px] items-center justify-between px-6 pt-[2px] text-[17px] font-semibold text-black">
              <span className="font-ui tracking-[-0.01em]">9:41</span>
              <span className="flex items-center gap-[7px]" aria-hidden>
                <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 9.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm0-3.6c1.6 0 3.1.6 4.2 1.7l-1.4 1.4a4 4 0 0 0-5.6 0L4.3 7.6A6 6 0 0 1 8.5 5.9Zm0-3.6c2.6 0 5 1 6.8 2.8l-1.4 1.4A7.6 7.6 0 0 0 3.1 6.5L1.7 5.1A9.6 9.6 0 0 1 8.5 2.3Z" /></svg>
                <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor" /><path d="M24.5 4.5v4a2 2 0 0 0 0-4Z" fill="currentColor" opacity=".4" /></svg>
              </span>
            </div>
            <div className="pt-[54px]">
              <SiteRenderer site={DEMO_SITES["rasa-kampung"]} mode="preview" stickyCta={false} />
            </div>
            <div className="absolute inset-x-0 bottom-0 z-20 h-[34px] bg-gradient-to-t from-black/10 to-transparent" />
            <div className="absolute bottom-2 left-1/2 z-20 h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>

        <div className="lp-float absolute top-[72px] -left-[38px] flex w-[206px] flex-col gap-[7px] rounded-[18px] bg-surface px-[14px] py-3 shadow-[0_18px_40px_rgba(8,12,40,.28)]">
          <HeroPrompt />
        </div>

        <div className="lp-float-slow absolute -right-[26px] bottom-[118px] flex items-center gap-2 rounded-[16px] bg-whatsapp px-[14px] py-[10px] text-[12px] font-bold text-white shadow-[0_18px_40px_rgba(8,12,40,.28)]">
          <Icon name="chat" size={18} fill />
          Order on WhatsApp
        </div>

        <div className="lp-float-9 absolute top-9 -right-[18px] rounded-[14px] bg-sun px-3 py-2 text-[12px] font-extrabold text-ink shadow-[0_14px_30px_rgba(8,12,40,.25)]">
          {PRICE_LABEL} · one time
        </div>
      </div>
    </div>
  );
}
