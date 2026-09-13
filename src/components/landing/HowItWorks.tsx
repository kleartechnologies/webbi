"use client";

import { Icon } from "@/components/ui";
import { PRICE_LABEL } from "@/lib/env";
import { HOST, vars } from "./content";
import { useLandingCopy } from "./i18n/LandingLanguage";
import { Band, Eyebrow, Heading, Inner } from "./Section";

const CARD = "lp-reveal flex flex-col gap-[14px] rounded-[26px] p-5 shadow-[0_12px_30px_rgba(20,26,59,.08)]";
const NUM = "font-display text-[34px] font-extrabold leading-none tracking-[-0.04em]";
const TITLE = "text-[19px] font-bold tracking-[-0.02em]";
const BODY = "text-[14px] leading-[1.5]";

export function HowItWorks() {
  const { how } = useLandingCopy();
  return (
    <Band id="how" z={4} className="bg-lavender text-ink">
      <Inner className="flex flex-col gap-9">
        <div className="lp-reveal flex max-w-[760px] flex-col gap-3">
          <Eyebrow className="text-blue">{how.eyebrow}</Eyebrow>
          <Heading>{how.title}</Heading>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-[18px]">
          <article className={`${CARD} bg-surface`}>
            <span className={`${NUM} text-blue`}>01</span>
            <h3 className={TITLE}>{how.tell.title}</h3>
            <p className={`${BODY} text-muted`}>{how.tell.body}</p>
            <div className="mt-auto flex flex-col gap-[10px] rounded-[16px] border-[1.5px] border-line-input bg-ground px-[14px] py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{how.tell.question}</span>
              <p className="text-[13px] leading-[1.45] text-ink">{how.tell.sample}</p>
              <span className="inline-flex h-8 w-fit items-center gap-[6px] rounded-pill bg-navy px-3 text-[12px] font-bold whitespace-nowrap text-white">
                <Icon name="arrow_forward" size={15} />
                {how.tell.button}
              </span>
            </div>
          </article>

          <article className={`${CARD} bg-surface`} style={vars({ "--lp-delay": "80ms" })}>
            <span className={`${NUM} text-blue`}>02</span>
            <h3 className={TITLE}>{how.build.title}</h3>
            <p className={`${BODY} text-muted`}>{how.build.body}</p>
            <ul className="mt-auto flex flex-col gap-[9px] rounded-[16px] bg-ground p-[14px] text-[13px] font-semibold text-ink">
              {how.build.steps.map((step, i) => (
                <li key={step} className="flex items-center gap-[9px]">
                  {i < 2 ? (
                    <Icon name="check_circle" size={18} fill className="text-success" />
                  ) : i === 2 ? (
                    <Icon name="progress_activity" size={18} className="animate-spin text-navy" />
                  ) : (
                    <span aria-hidden className="h-[18px] w-[18px] rounded-full border-2 border-placeholder" />
                  )}
                  {step}
                </li>
              ))}
            </ul>
          </article>

          <article className={`${CARD} bg-surface`} style={vars({ "--lp-delay": "160ms" })}>
            <span className={`${NUM} text-blue`}>03</span>
            <h3 className={TITLE}>{how.edit.title}</h3>
            <p className={`${BODY} text-muted`}>{how.edit.body}</p>
            <div className="mt-auto flex flex-col gap-3 rounded-[16px] bg-ground p-[14px]">
              <div className="flex flex-wrap gap-[6px]">
                {how.edit.tabs.map((t, i) => (
                  <span key={t} className={`flex h-[30px] items-center rounded-pill px-3 text-[12px] font-bold ${i === 0 ? "bg-ink text-white" : "bg-surface text-ink"}`}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-[6px]">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{how.edit.tagline}</span>
                <div className="flex h-10 items-center rounded-[12px] border-[1.5px] border-navy bg-surface px-3 text-[13px] text-ink">
                  Rasa kampung yang sentiasa dirindui
                  <span aria-hidden className="lp-blink ml-[2px] inline-block h-[17px] w-[1.5px] bg-navy" />
                </div>
              </div>
            </div>
          </article>

          <article className={`${CARD} bg-ink text-white shadow-[0_12px_30px_rgba(20,26,59,.16)]`} style={vars({ "--lp-delay": "240ms" })}>
            <span className={`${NUM} text-sun`}>04</span>
            <h3 className={TITLE}>{how.publish.title}</h3>
            <p className={`${BODY} text-white/72`}>{how.publish.body}</p>
            <div className="mt-auto flex flex-col gap-[10px] rounded-[16px] bg-white/9 p-[14px]">
              <span className="truncate rounded-[10px] bg-black/28 px-[11px] py-[9px] font-mono text-[12px]">
                {HOST}/w/<strong className="text-sun">rasa-kampung</strong>
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/72">{how.publish.oneTime}</span>
                <span className="text-[17px] font-bold">{PRICE_LABEL}</span>
              </div>
              <span className="flex h-10 items-center justify-center gap-[6px] rounded-pill bg-amber text-[13px] font-bold whitespace-nowrap text-ink">
                <Icon name="rocket_launch" size={17} />
                {how.publish.button}
              </span>
            </div>
          </article>
        </div>
      </Inner>
    </Band>
  );
}
