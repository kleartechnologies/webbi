import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { headingClass, type RenderCtx } from "./context";

/** Page-width section wrapper; the id is the in-page anchor target. */
export function Section({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <section id={`s-${id}`} className={cn("mx-auto w-full max-w-[1120px] scroll-mt-16 px-4 py-6 @3xl:px-8 @3xl:py-10", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ ctx, note, children }: { ctx: RenderCtx; note?: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <h2 className={cn(headingClass(ctx.preset), "text-[22px] leading-[1.15] tracking-[-0.01em] @3xl:text-[30px]")}>{children}</h2>
      {note ? <p className="text-[13px] leading-[1.45] text-site-muted @3xl:text-[14px]">{note}</p> : null}
    </div>
  );
}

/** Rounded surface for cards inside sections. */
export const card = "rounded-card border border-site-line bg-white";
