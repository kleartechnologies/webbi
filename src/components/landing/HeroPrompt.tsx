"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { PROMPT } from "./content";

type Stage = "typing" | "working" | "done";

/** The "What do you do?" card on the hero phone: types the example brief, then reports the build. */
export function HeroPrompt() {
  const text = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<Stage>("typing");

  useEffect(() => {
    const el = text.current;
    if (!el) return;
    const timers: number[] = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = PROMPT;
      timers.push(window.setTimeout(() => setStage("done"), 0));
      return () => timers.forEach(clearTimeout);
    }
    let i = 0;
    const type = () => {
      i += 1;
      el.textContent = PROMPT.slice(0, i);
      if (i < PROMPT.length) {
        timers.push(window.setTimeout(type, 24));
      } else {
        setStage("working");
        timers.push(window.setTimeout(() => setStage("done"), 1800));
      }
    };
    timers.push(window.setTimeout(type, 900));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">What do you do?</span>
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
            <span className="text-ink">Your website is ready</span>
          </>
        ) : (
          <>
            <Icon name="progress_activity" size={15} className="animate-spin text-navy" />
            <span className="text-ink">Building your website…</span>
          </>
        )}
      </div>
    </>
  );
}
