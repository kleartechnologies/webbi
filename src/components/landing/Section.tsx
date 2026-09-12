import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One coloured band of the landing. Each band rounds its top corners and
 * overlaps the previous one by 30px, so z-index climbs down the page.
 */
export function Band({
  id,
  z,
  className,
  gutter = true,
  children,
}: {
  id?: string;
  z: number;
  className?: string;
  /** Off for bands that manage their own side padding (the examples rail bleeds). */
  gutter?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative -mt-[30px] rounded-t-[36px] pt-[clamp(72px,8vw,116px)] pb-[clamp(56px,8vw,104px)]",
        gutter && "px-4",
        className,
      )}
      style={{ zIndex: z }}
    >
      {children}
    </section>
  );
}

export function Inner({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1180px]", className)}>{children}</div>;
}

export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("text-[13px] font-bold uppercase tracking-[0.14em]", className)}>{children}</span>;
}

export function Heading({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h2 className={cn("font-display text-[clamp(34px,5.4vw,62px)] font-extrabold leading-[1.02] tracking-[-0.04em] text-pretty", className)}>
      {children}
    </h2>
  );
}
