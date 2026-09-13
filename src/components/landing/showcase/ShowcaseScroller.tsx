"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLandingCopy } from "../i18n/LandingLanguage";

/**
 * The showcase list: a 3×3 grid from lg up, and below that a swipeable rail
 * with previous/next buttons and a counter, so a phone shows one business at a
 * time at a size worth looking at.
 */
export function ShowcaseScroller({ count, children }: { count: number; children: ReactNode }) {
  const { showcase } = useLandingCopy();
  const rail = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  const step = () => {
    const el = rail.current;
    const [a, b] = el ? Array.from(el.children as HTMLCollectionOf<HTMLElement>) : [];
    return a && b ? b.offsetLeft - a.offsetLeft : 1;
  };

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step()))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count]);

  const go = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: (index + dir) * step(), behavior: smooth ? "smooth" : "auto" });
  };

  const arrow = "flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-white/22 text-white transition-[border-color,opacity] hover:border-white/50 disabled:opacity-35 disabled:hover:border-white/22";

  return (
    <>
      <ul
        ref={rail}
        tabIndex={0}
        aria-label={showcase.rail}
        className="lp-rail flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-[max(16px,calc((100%-1180px)/2))] pt-1 pb-3 sm:gap-6 lg:mx-auto lg:grid lg:w-full lg:max-w-[1180px] lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14 lg:overflow-visible lg:px-4 lg:pb-0"
      >
        {children}
      </ul>
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 lg:hidden">
        <p className="font-mono text-[12px] text-white/60" aria-live="polite">
          {index + 1} / {count}
        </p>
        <div className="flex gap-2">
          <button type="button" className={arrow} onClick={() => go(-1)} disabled={index === 0} aria-label={showcase.previous}>
            <Icon name="arrow_back" size={20} />
          </button>
          <button type="button" className={cn(arrow)} onClick={() => go(1)} disabled={index === count - 1} aria-label={showcase.next}>
            <Icon name="arrow_forward" size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
