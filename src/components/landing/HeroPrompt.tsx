"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { useLandingCopy } from "./i18n/LandingLanguage";

type Stage = "typing" | "working" | "done";

/** The "What do you do?" card on the hero phone: types the example brief, then reports the build. */
export function HeroPrompt() {
  const { prompt } = useLandingCopy();
  const text = useRef<HTMLSpanElement>(null);
  /** The brief being typed; a language switch swaps it without replaying. */
  const brief = useRef(prompt.text);
  const [stage, setStage] = useState<Stage>("typing");

  useEffect(() => {
    const el = text.current;
    if (!el) return;
    const timers: number[] = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = brief.current;
      timers.push(window.setTimeout(() => setStage("done"), 0));
      return () => timers.forEach(clearTimeout);
    }
    let i = 0;
    const type = () => {
      i += 1;
      el.textContent = brief.current.slice(0, i);
      if (i < brief.current.length) {
        timers.push(window.setTimeout(type, 24));
      } else {
        setStage("working");
        timers.push(window.setTimeout(() => setStage("done"), 1800));
      }
    };
    timers.push(window.setTimeout(type, 900));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const previous = brief.current;
    if (previous === prompt.text) return;
    brief.current = prompt.text;
    const el = text.current;
    const shown = el?.textContent ?? "";
    // A finished brief shows in full in the new language; one mid-typing carries on from where it was.
    if (el && shown) el.textContent = shown.length >= previous.length ? prompt.text : prompt.text.slice(0, shown.length);
  }, [prompt.text]);

  return (
    <>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{prompt.question}</span>
      <p className="min-h-[72px] text-[11px] leading-[1.45] text-ink">
        <span ref={text} />
        {stage === "typing" ? <span aria-hidden className="lp-blink ml-px inline-block h-[11px] w-[2px] translate-y-[2px] bg-navy" /> : null}
      </p>
      <div
        className="flex items-center gap-[6px] border-t border-[#EDEBE5] pt-[7px] text-[11px] font-bold transition-opacity duration-300"
        style={{ opacity: stage === "typing" ? 0 : 1 }}
        aria-live="polite"
      >
        {stage === "done" ? (
          <>
            <Icon name="check_circle" size={15} fill className="text-success" />
            <span className="text-ink">{prompt.done}</span>
          </>
        ) : (
          <>
            <Icon name="progress_activity" size={15} className="animate-spin text-navy" />
            <span className="text-ink">{prompt.working}</span>
          </>
        )}
      </div>
    </>
  );
}
