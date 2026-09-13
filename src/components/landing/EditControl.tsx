"use client";

import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { PRESETS, type PresetId } from "@/lib/site/presets";
import { vars } from "./content";
import { useLandingCopy } from "./i18n/LandingLanguage";
import { Band, Eyebrow, Heading, Inner } from "./Section";

/** One icon per line of copy.control.lines, in order. */
const ICONS: IconName[] = ["edit", "add_a_photo", "palette", "tune"];

/** The editor's accent choices (kept in step with StyleTab's ACCENTS). */
const ACCENTS = ["#B4472B", "#0E6B63", "#1D3A8A", "#A8546A", "#E7A33E", "#1C1C1E"];
const STYLES: PresetId[] = ["warm", "elegant", "bold", "trust"];

/** Static replica of the editor's Style tab: the real thing lives in src/components/app/editor. */
export function EditControl() {
  const { control } = useLandingCopy();
  const [whatsapp, table, call] = control.buttons;
  return (
    <Band z={5} className="bg-surface text-ink">
      <Inner className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-[clamp(28px,4vw,56px)]">
        <div className="lp-reveal flex flex-col gap-[18px]">
          <Eyebrow className="text-blue">{control.eyebrow}</Eyebrow>
          <Heading className="text-[clamp(32px,4.8vw,56px)]">{control.title}</Heading>
          <ul className="flex flex-col gap-3 text-[16px] leading-[1.5]">
            {control.lines.map((text, i) => (
              <li key={ICONS[i]} className="flex items-start gap-3">
                <Icon name={ICONS[i]} size={22} className="shrink-0 text-blue" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-reveal" style={vars({ "--lp-delay": "120ms", "--lp-rise": "20px" })}>
          <div data-float="0.06" aria-hidden className="flex flex-col gap-[14px] rounded-[28px] border border-line bg-ground p-5 [transform:translateY(var(--py,0px))]">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{control.style}</span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
              {STYLES.map((id, i) => {
                const p = PRESETS[id];
                return (
                  <div key={id} className={cn("flex flex-col gap-[7px] rounded-[14px] bg-surface p-[10px]", i === 0 ? "border-2 border-ink" : "border border-line")}>
                    <span className={cn("text-[15px]", id === "bold" ? "font-extrabold uppercase" : id === "elegant" ? "font-normal" : "font-bold")} style={{ fontFamily: p.font, color: p.ink }}>
                      {p.label}
                    </span>
                    <span className="flex gap-1">
                      <span className="h-4 w-4 rounded-[5px]" style={{ background: p.accent }} />
                      <span className="h-4 w-4 rounded-[5px] border" style={{ background: p.ground, borderColor: p.line }} />
                      <span className="h-4 w-4 rounded-[5px]" style={{ background: p.ink }} />
                    </span>
                  </div>
                );
              })}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{control.accent}</span>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((hex, i) => (
                <span key={hex} className={cn("h-[38px] w-[38px] rounded-[12px]", i === 0 && "shadow-[0_0_0_2px_#fff,0_0_0_4px_#141A3B]")} style={{ background: hex }} />
              ))}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{control.wording}</span>
            <div className="flex flex-wrap gap-2">
              <span className="flex h-9 items-center gap-[6px] rounded-pill bg-whatsapp px-[14px] text-[13px] font-bold whitespace-nowrap text-white">
                <Icon name="chat" size={16} fill />
                {whatsapp}
              </span>
              <span className="flex h-9 items-center rounded-pill border-[1.5px] border-line-input bg-surface px-[14px] text-[13px] font-bold whitespace-nowrap text-ink">{table}</span>
              <span className="flex h-9 items-center rounded-pill border-[1.5px] border-line-input bg-surface px-[14px] text-[13px] font-bold whitespace-nowrap text-ink">{call}</span>
            </div>
          </div>
        </div>
      </Inner>
    </Band>
  );
}
