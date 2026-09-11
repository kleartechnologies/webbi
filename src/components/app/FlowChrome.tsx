"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, Wordmark } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Back button + "Step n of 3" + 4px progress bar (design screens 02/03). */
export function FlowHeader({
  step,
  total = 3,
  backHref,
  onBack,
  backLabel = "Back",
}: {
  step: number;
  total?: number;
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  const router = useRouter();
  const pct = Math.round((step / total) * 100);
  const goBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-3 pt-1">
        <button
          type="button"
          onClick={goBack}
          aria-label={backLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-[#EDEBE5]"
        >
          <Icon name="arrow_back" size={24} />
        </button>
        <span className="text-[13px] font-bold text-muted">
          Step {step} of {total}
        </span>
      </div>
      <div
        className="mx-5 mt-1 h-1 overflow-hidden rounded-[2px] bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
      >
        <div className="h-full rounded-[2px] bg-navy transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Centered wordmark used by the Start and Generating screens. */
export function CenteredWordmark() {
  return (
    <div className="flex items-center justify-center pb-[6px] pt-[14px]">
      <Wordmark href="/" size={22} />
    </div>
  );
}

/** Sticky bottom action area with the design's fade-in gradient. */
export function StickyFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("sticky bottom-0 mt-auto flex flex-col gap-[10px] px-5 pt-4 pb-safe", className)}
      style={{ background: "linear-gradient(180deg, rgba(246,245,241,0) 0%, #F6F5F1 24%)" }}
    >
      {children}
    </div>
  );
}

export function FooterNote({ children }: { children: ReactNode }) {
  return <span className="text-center text-[12px] text-muted">{children}</span>;
}
