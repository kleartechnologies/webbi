import { Icon } from "@/components/ui";
import { CATEGORIES, type CategoryId } from "@/lib/site/categories";
import { PRESETS, type PresetId } from "@/lib/site/presets";
import { vars } from "./content";

const STRIPES: Record<PresetId | "teal", [string, string]> = {
  warm: ["#E6DCCB", "#DDD2BF"],
  bold: ["#D5D8DF", "#CBCED6"],
  elegant: ["#EBD6D8", "#E4CBCE"],
  trust: ["#DCE5F2", "#D2DCEC"],
  teal: ["#D9E8E6", "#CFE0DD"],
  bright: ["#DCE9E0", "#D2E1D7"],
};

interface RailCard {
  name: string;
  sub: string;
  category: CategoryId;
  item: string;
  price: string;
  tilt: number;
  /** Trust preset with the teal accent (one of the editor's accent choices). */
  teal?: boolean;
}

/**
 * Nine kinds of business Webbi lays out. The first three and SejukTech are
 * the shipped example sites; the rest illustrate other categories.
 */
const CARDS: RailCard[] = [
  { name: "Rasa Kampung", sub: "Nasi lemak · Kajang", category: "restaurant", item: "Nasi Lemak Ayam Berempah", price: "RM 9.50", tilt: -2.2 },
  { name: "Hafiz Rahman", sub: "Proton advisor · Shah Alam", category: "car", item: "Proton X50", price: "From RM 86,300", tilt: 1.8 },
  { name: "Sereni", sub: "Beauty studio · Bangsar", category: "beauty", item: "Signature Hydra Facial", price: "RM 180", tilt: -1.4 },
  { name: "Sarah Tan", sub: "Property agent · Penang", category: "property", item: "3-room, Tanjung Bungah", price: "RM 540,000", tilt: 2.4 },
  { name: "SejukTech", sub: "Aircond service · Klang Valley", category: "homeServices", item: "General service", price: "RM 60", tilt: -2, teal: true },
  { name: "Cikgu Amir", sub: "Maths tuition · Ipoh", category: "tutor", item: "SPM Add Maths", price: "RM 180/mo", tilt: 1.2 },
  { name: "Studio Dua", sub: "Wedding photography · KL", category: "photographer", item: "Half-day wedding", price: "RM 2,800", tilt: -1.8 },
  { name: "Kedai Rina", sub: "Online boutique · Melaka", category: "retail", item: "Kurung linen set", price: "RM 159", tilt: 2 },
  { name: "Lim & Co.", sub: "Accounting · Johor Bahru", category: "professional", item: "SST filing", price: "From RM 350", tilt: -1.2 },
];

export function ExampleRail() {
  return (
    <div className="mt-[clamp(32px,4vw,56px)] flex flex-col">
      <div className="lp-reveal mx-auto flex w-full max-w-[1180px] flex-wrap items-end justify-between gap-3 px-4">
        <h3 className="font-display text-[clamp(20px,2.4vw,28px)] font-extrabold leading-[1.1] tracking-[-0.03em]">Nine kinds of business. One way to start.</h3>
        <span className="text-[13px] text-white/60">Scroll →</span>
      </div>
      <div className="lp-rail flex snap-x snap-mandatory gap-4 overflow-x-auto px-[max(16px,calc((100%-1180px)/2))] pt-[10px] pb-[22px]" tabIndex={0} aria-label="More kinds of business">
        {CARDS.map((card) => {
          const category = CATEGORIES[card.category];
          const preset = PRESETS[category.preset];
          const accent = card.teal ? preset.accentAlt : preset.accent;
          const [a, b] = STRIPES[card.teal ? "teal" : category.preset];
          return (
            <article
              key={card.name}
              className="flex w-[clamp(228px,64vw,272px)] shrink-0 snap-center flex-col overflow-hidden rounded-[24px] bg-ground text-ink shadow-[0_24px_50px_rgba(0,0,0,.34)] rotate-(--tilt) transition-[rotate,translate,box-shadow] duration-[400ms] hover:-translate-y-2 hover:rotate-0 hover:shadow-[0_30px_62px_rgba(0,0,0,.44)]"
              style={vars({ "--tilt": `${card.tilt}deg` })}
            >
              <div className="flex items-center gap-[10px] bg-white/72 px-[14px] py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[14px] font-extrabold text-white" style={{ background: accent }}>
                  {card.name[0]}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-bold" style={{ fontFamily: preset.font, color: preset.ink }}>{card.name}</span>
                  <span className="truncate text-[10px] text-muted">{card.sub}</span>
                </span>
                <span className="ml-auto flex shrink-0" style={{ color: accent }}>
                  <Icon name={category.icon} size={17} fill />
                </span>
              </div>
              <div aria-hidden className="h-[104px]" style={{ background: `repeating-linear-gradient(135deg,${a} 0 10px,${b} 10px 20px)` }} />
              <div className="flex flex-col gap-[9px] px-[14px] pt-3 pb-[15px]">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{category.offeringsLabel}</span>
                <div className="flex items-baseline justify-between gap-3 text-[12px] text-ink">
                  <span className="truncate">{card.item}</span>
                  <span className="shrink-0 font-semibold">{card.price}</span>
                </div>
                <span className="flex h-9 items-center justify-center gap-[6px] rounded-pill text-[12px] font-bold text-white" style={{ background: accent }}>
                  <Icon name={category.ctaIcon} size={16} fill />
                  {category.cta}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
