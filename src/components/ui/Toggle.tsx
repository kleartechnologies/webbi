"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-pill transition-colors disabled:opacity-45",
        checked ? "bg-navy" : "bg-line-input",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(20,26,59,.25)] transition-[left]",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
