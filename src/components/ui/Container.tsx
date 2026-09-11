import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** 1120px container with the design's 20px side padding on mobile. */
export function Container({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-webbi px-5 sm:px-8", className)} {...rest}>
      {children}
    </div>
  );
}
