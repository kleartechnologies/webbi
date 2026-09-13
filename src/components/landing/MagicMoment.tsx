"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_SITES } from "@/lib/site/demo";
import { BrowserChrome } from "./BrowserChrome";
import { siteAddress, vars } from "./content";
import { useLandingCopy } from "./i18n/LandingLanguage";
import { Band, Eyebrow, Heading, Inner } from "./Section";
import { SitePreview } from "./SitePreview";

function Num({ n, className }: { n: string; className: string }) {
  return <span className={cn("flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-[11px] font-extrabold", className)}>{n}</span>;
}

/**
 * The description → website sequence: the brief types itself, Webbi reads it,
 * the website appears. Plays once when 30% visible; "Watch again" replays.
 */
export function MagicMoment() {
  const { moment, prompt } = useLandingCopy();
  const host = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  /** The brief being typed; a language switch swaps it without replaying. */
  const brief = useRef(prompt.text);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const [typing, setTyping] = useState(false);
  const [stage, setStage] = useState(0);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const play = useCallback(() => {
    clear();
    const el = text.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = brief.current;
      setStage(4);
      return;
    }
    el.textContent = "";
    setStage(0);
    setTyping(true);
    let i = 0;
    const type = () => {
      i += 1;
      el.textContent = brief.current.slice(0, i);
      if (i < brief.current.length) {
        timers.current.push(window.setTimeout(type, 26));
        return;
      }
      setTyping(false);
      for (let n = 1; n <= 4; n += 1) {
        timers.current.push(window.setTimeout(() => setStage(n), 420 + (n - 1) * 620));
      }
    };
    timers.current.push(window.setTimeout(type, 200));
  }, []);

  useEffect(() => {
    const previous = brief.current;
    if (previous === prompt.text) return;
    brief.current = prompt.text;
    const el = text.current;
    const shown = el?.textContent ?? "";
    if (el && shown) el.textContent = shown.length >= previous.length ? prompt.text : prompt.text.slice(0, shown.length);
  }, [prompt.text]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      timers.current.push(window.setTimeout(play, 0));
      return clear;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (started.current || !entries.some((e) => e.isIntersecting)) return;
        started.current = true;
        io.disconnect();
        play();
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, [play]);

  const at = (n: number) => ({ opacity: stage >= n ? 1 : 0 });

  return (
    <Band z={2} className="bg-ground">
      <Inner className="flex flex-col gap-9">
        <div className="lp-reveal flex max-w-[760px] flex-col gap-3">
          <Eyebrow className="text-blue">{moment.eyebrow}</Eyebrow>
          <Heading className="text-ink">
            {moment.titleLead}
            <br />
            {moment.titleRest}
          </Heading>
        </div>

        <div ref={host} className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-stretch gap-5">
          <div className="lp-reveal flex flex-col gap-4 rounded-[26px] border border-line bg-surface p-[22px] shadow-[0_10px_30px_rgba(20,26,59,.06)]">
            <div className="flex items-center gap-[10px]">
              <Num n="1" className="bg-ink text-white" />
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{moment.youType}</span>
            </div>
            <div className="min-h-[132px] rounded-[18px] border-[1.5px] border-line-input bg-ground px-4 py-[14px] text-[16px] leading-[1.5] text-ink">
              <span ref={text} />
              {typing ? <span aria-hidden className="lp-blink ml-px inline-block h-[18px] w-[2px] translate-y-[3px] bg-navy" /> : null}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={play}
                className="inline-flex h-[38px] items-center gap-[6px] rounded-pill border-[1.5px] border-line-input bg-surface px-[14px] text-[13px] font-bold whitespace-nowrap text-ink transition-colors hover:bg-ground"
              >
                <Icon name="refresh" size={17} />
                {moment.again}
              </button>
              <span className="text-[12px] text-muted">{moment.noForms}</span>
            </div>
          </div>

          <div className="lp-reveal flex flex-col gap-4 rounded-[26px] bg-ink p-[22px] text-white" style={vars({ "--lp-delay": "90ms" })}>
            <div className="flex items-center gap-[10px]">
              <Num n="2" className="bg-sun text-ink" />
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/70">{moment.reads}</span>
            </div>
            <div className="flex items-center gap-[10px] text-[15px] font-semibold transition-opacity duration-500" style={at(1)} aria-live="polite">
              <Icon name="progress_activity" size={20} className={cn("text-sun", stage < 3 && "animate-spin")} />
              {moment.understanding}
            </div>
            <div className="flex flex-wrap gap-2 transition-opacity duration-500" style={at(2)}>
              {moment.chips.map((chip) => (
                <span key={chip} className="rounded-pill bg-white/12 px-[13px] py-[7px] text-[13px] font-semibold">
                  {chip}
                </span>
              ))}
              <span className="rounded-pill bg-sun px-[13px] py-[7px] text-[13px] font-bold text-ink">{moment.style("Warm")}</span>
            </div>
            <div className="mt-auto flex flex-col gap-3 transition-opacity duration-500" style={at(3)}>
              <p className="text-[13px] leading-[1.5] text-white/75">{moment.written}</p>
              <span className="flex items-center gap-[6px] text-[13px] font-bold text-sun">
                <Icon name="check_circle" size={18} fill />
                {moment.ready}
              </span>
            </div>
          </div>

          <div className="lp-reveal flex flex-col gap-4 overflow-hidden rounded-[26px] bg-gradient-to-b from-lavender to-[#EFEDFB] px-[22px] pt-[22px]" style={vars({ "--lp-delay": "180ms" })}>
            <div className="flex items-center gap-[10px]">
              <Num n="3" className="bg-blue text-white" />
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#3A3670]">{moment.publish}</span>
            </div>
            <div
              className="mt-auto overflow-hidden rounded-t-[20px] bg-surface shadow-[0_-6px_40px_rgba(20,26,59,.18)] transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
              style={{ opacity: stage >= 4 ? 1 : 0, transform: stage >= 4 ? "translateY(0)" : "translateY(24px)" }}
            >
              <BrowserChrome url={siteAddress("rasa-kampung")} size="sm" />
              <SitePreview site={DEMO_SITES["rasa-kampung"]} width={840} scale={0.42} height={260} className="bg-[#FBF7F0]" />
            </div>
          </div>
        </div>
      </Inner>
    </Band>
  );
}
