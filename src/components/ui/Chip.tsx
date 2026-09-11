import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-pill px-[14px] text-[13px] whitespace-nowrap transition-colors",
        selected ? "bg-ink font-bold text-white" : "border border-line-input bg-surface font-semibold text-ink hover:border-navy",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
