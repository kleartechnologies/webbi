import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** White surface with the design's 1px line and 16px radius. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  );
}
