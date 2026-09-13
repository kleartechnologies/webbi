"use client";

import { cn } from "@/lib/cn";
import type { LandingLang } from "./i18n/copy";
import { useLandingLanguage } from "./i18n/LandingLanguage";

const OPTIONS: [LandingLang, string][] = [
  ["en", "EN"],
  ["ms", "BM"],
];

/** EN | BM switch in the nav pill. The active side is filled and bold, not only recoloured. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, copy, setLang } = useLandingLanguage();
  return (
    <div role="group" aria-label={copy.language.group} data-language-toggle className={cn("flex shrink-0 items-center rounded-pill bg-ground p-[3px] max-[429px]:p-[2px]", className)}>
      {OPTIONS.map(([id, short]) => {
        const active = id === lang;
        return (
          <button
            key={id}
            type="button"
            lang={id}
            aria-pressed={active}
            aria-label={copy.language[id]}
            title={copy.language[id]}
            onClick={() => setLang(id)}
            className={cn(
              "flex h-[34px] min-w-[38px] items-center justify-center rounded-pill px-[9px] text-[13px] tracking-[0.02em] transition-colors max-[429px]:min-w-[32px] max-[429px]:px-[6px] max-[389px]:min-w-[30px] max-[389px]:px-[5px]",
              active ? "bg-ink font-extrabold text-white" : "font-semibold text-muted hover:text-ink",
            )}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}
