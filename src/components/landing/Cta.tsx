"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLandingCopy } from "./i18n/LandingLanguage";

const LIFT = "transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_36px_rgba(0,0,0,.26)] active:translate-y-0";

/** Amber "Create My Website" pill: every primary action on the landing goes to /start. */
export function CreateCta({ height = 60, className, children }: { height?: number; className?: string; children?: ReactNode }) {
  const copy = useLandingCopy();
  return (
    <Link
      href="/start"
      className={cn(
        "inline-flex items-center justify-center gap-[10px] rounded-pill bg-amber px-7 text-[17px] font-bold whitespace-nowrap text-ink shadow-[0_10px_26px_rgba(0,0,0,.18)]",
        LIFT,
        className,
      )}
      style={{ height }}
    >
      {children ?? copy.cta.create}
      <Icon name="arrow_forward" size={21} />
    </Link>
  );
}

/** Outlined secondary pill for dark grounds (in-page anchors). */
export function GhostCta({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-[60px] items-center justify-center gap-2 rounded-pill border-[1.5px] border-white/50 px-[26px] text-[17px] font-bold whitespace-nowrap text-white transition-colors hover:bg-white/10",
        className,
      )}
    >
      {children}
    </a>
  );
}
