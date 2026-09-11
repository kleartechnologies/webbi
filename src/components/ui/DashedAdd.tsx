import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/** "Add another…" control: dashed 52px row in navy. */
export function DashedAdd({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line-input text-[15px] font-semibold text-navy transition-colors hover:border-navy hover:bg-navy-tint/40",
        className,
      )}
      {...rest}
    >
      <Icon name="add" size={20} />
      {children}
    </button>
  );
}
