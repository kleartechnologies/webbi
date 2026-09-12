"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Wordmark } from "@/components/ui";
import { PRICE_LABEL } from "@/lib/env";
import { NavAuthLink } from "./NavAuthLink";

const LINKS = [
  ["how", "How it works"],
  ["examples", "Examples"],
  ["pricing", "Pricing"],
] as const;

/**
 * Floating pill nav with a reading-progress bar. On the landing it also owns
 * the mobile dock (fixed "Create My Website" bar once the hero is scrolled
 * past). Legal pages render it without `landing` and link back to /#anchors.
 */
export function LandingNav({ landing = false }: { landing?: boolean }) {
  const pill = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
      pill.current?.setAttribute("data-lifted", String(y > 30));
      if (dock.current) {
        const hero = document.getElementById("top");
        const past = hero ? y > hero.offsetTop + hero.offsetHeight - 240 : y > 600;
        dock.current.setAttribute("data-show", String(window.innerWidth < 760 && past));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    tick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const anchor = (id: string) => (landing ? `#${id}` : `/#${id}`);

  return (
    <>
      <nav className="sticky top-0 z-40 h-[72px] px-4 pt-3">
        <div ref={bar} aria-hidden className="absolute top-0 left-0 h-[3px] w-0 rounded-r-[3px] bg-sun" />
        <div
          ref={pill}
          data-lifted="false"
          className="mx-auto flex max-w-[1180px] items-center gap-4 rounded-pill bg-surface py-2 pr-[10px] pl-5 shadow-[0_8px_30px_rgba(20,26,59,.14)] transition-[box-shadow,padding] duration-300 data-[lifted=true]:py-1.5 data-[lifted=true]:pr-2 data-[lifted=true]:pl-[18px] data-[lifted=true]:shadow-[0_12px_36px_rgba(20,26,59,.22)]"
        >
          <Wordmark href={landing ? "#top" : "/"} size={25} className="tracking-[-0.04em] text-ink!" />
          <div className="ml-auto hidden items-center gap-0.5 min-[760px]:flex">
            {LINKS.map(([id, label]) => (
              <a key={id} href={anchor(id)} className="flex h-10 items-center rounded-pill px-[14px] text-[15px] font-semibold text-ink transition-colors hover:bg-ground">
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5 max-[759px]:ml-auto">
            <NavAuthLink className="hidden h-[42px] items-center rounded-pill px-4 text-[15px] font-semibold text-ink transition-colors hover:bg-ground min-[560px]:flex" />
            <Link href="/start" className="flex h-11 items-center rounded-pill bg-ink px-5 text-[15px] font-bold text-white transition-colors hover:bg-navy">
              Create My Website
            </Link>
          </div>
        </div>
      </nav>

      {landing ? (
        <div
          ref={dock}
          data-show="false"
          className="fixed inset-x-0 bottom-0 z-50 translate-y-[115%] border-t border-line bg-ground/95 px-[14px] pt-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-[12px] transition-transform duration-[400ms] ease-[cubic-bezier(.2,.7,.2,1)] data-[show=true]:translate-y-0 min-[760px]:hidden"
        >
          <Link href="/start" className="flex h-[54px] items-center justify-center gap-2 rounded-pill bg-amber text-[16px] font-bold text-ink">
            Create My Website
            <span className="text-[13px] font-semibold opacity-70">{PRICE_LABEL} once</span>
          </Link>
        </div>
      ) : null}
    </>
  );
}
