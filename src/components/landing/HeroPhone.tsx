import { SiteRenderer } from "@/components/site/SiteRenderer";
import { DEMO_SITES } from "@/lib/site/demo";

/**
 * Phone mockup in the landing hero: the real renderer showing the example
 * restaurant site, scaled to fit. Marketing preview and product are the same
 * code, so what visitors see here is exactly what they get.
 */
const INNER_WIDTH = 402;
const SCALE = 0.672;
const NOTCH_AREA = 44;
const INNER_HEIGHT = Math.round((612 - 12 - NOTCH_AREA) / SCALE);

export function HeroPhone() {
  return (
    <div
      aria-hidden
      className="relative h-[612px] w-[282px] shrink-0 overflow-hidden rounded-[34px] border-[6px] border-[#1C1C1E] bg-[#1C1C1E] shadow-floating"
    >
      <div className="absolute top-2 left-1/2 z-40 h-[22px] w-[84px] -translate-x-1/2 rounded-pill bg-[#1C1C1E]" />
      <div className="h-full w-full overflow-hidden rounded-[28px] bg-[#FBF7F0]" style={{ paddingTop: NOTCH_AREA }}>
        <div className="origin-top-left overflow-hidden" style={{ width: INNER_WIDTH, height: INNER_HEIGHT, transform: `scale(${SCALE})` }}>
          <SiteRenderer site={DEMO_SITES["rasa-kampung"]} mode="preview" />
        </div>
      </div>
    </div>
  );
}
