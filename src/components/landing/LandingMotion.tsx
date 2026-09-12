"use client";

import { useEffect } from "react";

/**
 * The landing's motion, written straight to the DOM so nothing re-renders:
 * scroll-in reveals (.lp-reveal → .is-in) and the three parallax layers
 * ([data-float] → --py). Both are skipped under prefers-reduced-motion.
 */
export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];

    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".lp-reveal"));
    const show = (el: Element) => el.classList.add("is-in");
    let io: IntersectionObserver | undefined;
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(show);
    } else {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            show(entry.target);
            io?.unobserve(entry.target);
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
      );
      reveals.forEach((el) => io?.observe(el));
      // Failsafe: never leave content hidden if an observer never fires.
      timers.push(window.setTimeout(() => reveals.forEach(show), 3000));
    }

    const floats = reduce ? [] : Array.from(document.querySelectorAll<HTMLElement>("[data-float]"));
    let raf = 0;
    const tick = () => {
      raf = 0;
      const vh = window.innerHeight || 800;
      for (const el of floats) {
        const factor = parseFloat(el.dataset.float || "0");
        const r = el.getBoundingClientRect();
        const progress = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.setProperty("--py", `${(progress * factor * -100).toFixed(1)}px`);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    if (floats.length) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      tick();
    }

    return () => {
      timers.forEach(clearTimeout);
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <noscript>
      <style>{`.lp-reveal{opacity:1;transform:none}`}</style>
    </noscript>
  );
}
