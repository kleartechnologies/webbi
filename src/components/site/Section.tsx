import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { sectionIndex, twoDigits, type RenderCtx } from "./context";
import { brightTint } from "./skin";

/**
 * Page section in the template's width and rhythm; the id is the in-page
 * anchor target. `band` paints a full-width background behind the content.
 * With a `head`, Trust (always) and `aside` sections put the title in a left
 * column on desktop; every other template stacks it above the content.
 */
export function Section({
  ctx,
  id,
  band,
  head,
  aside,
  className,
  children,
}: {
  ctx: RenderCtx;
  id: string;
  band?: string;
  head?: ReactNode;
  aside?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { skin, template } = ctx;
  const split = Boolean(head) && (template === "trust" || aside);
  const content = head ? (
    <div
      className={cn(
        split ? "grid gap-6" : "flex flex-col gap-8 @3xl:gap-12",
        split && (template === "trust" ? "@3xl:grid-cols-[220px_minmax(0,1fr)] @3xl:gap-14" : "@3xl:grid-cols-[240px_minmax(0,1fr)] @3xl:gap-12 @5xl:grid-cols-[332px_minmax(0,1fr)] @5xl:gap-[88px]"),
      )}
    >
      <div className="min-w-0">{head}</div>
      <div className="min-w-0">{children}</div>
    </div>
  ) : (
    children
  );
  return (
    <section id={`s-${id}`} className={cn("w-full scroll-mt-20", band)}>
      <div className={cn("mx-auto w-full", skin.container, skin.sectionY, className)}>
        {template === "trust" && !band ? <div className="border-t border-site-line pt-7 @3xl:pt-[34px]">{content}</div> : content}
      </div>
    </section>
  );
}

const DARK_KICKER = {
  warm: "text-[#E8A33C]",
  elegant: "text-[#C9B9BD]",
  bold: "text-[#FF4B33]",
  trust: "text-[#8FA6B4]",
  bright: "",
} as const;

/** Eyebrow + title + note in the template's own hierarchy. */
export function SectionHead({
  ctx,
  id,
  kicker,
  title,
  note,
  action,
  center,
  dark,
  tone,
}: {
  ctx: RenderCtx;
  id: string;
  kicker?: string;
  title: string;
  note?: string;
  action?: ReactNode;
  center?: boolean;
  dark?: boolean;
  /** Eyebrow colour for a band the dark default doesn't suit (e.g. Bold's red contact band). */
  tone?: string;
}) {
  const { skin, template } = ctx;
  const index = sectionIndex(ctx, id);
  const repeats = Boolean(kicker) && kicker!.trim().toLowerCase() === title.trim().toLowerCase();
  const eyebrow =
    template === "trust" ? `${twoDigits(index + 1)}${kicker && !repeats ? ` / ${kicker}` : ""}` : kicker && !repeats ? kicker : null;
  return (
    <div className={cn("flex min-w-0 flex-col", template === "trust" ? "gap-2" : "gap-3", center && "items-center text-center")}>
      {eyebrow ? (
        <span className={cn(skin.kicker, tone ?? (dark ? DARK_KICKER[template] : template === "bright" ? brightTint(index).chip : skin.kickerTone))}>{eyebrow}</span>
      ) : null}
      <h2 className={cn(skin.heading, skin.h2, "[overflow-wrap:anywhere]", center && "max-w-[22ch]", dark && "text-white")}>{title}</h2>
      {note ? <p className={cn(dark ? "text-[15px] leading-[1.6] text-white/75" : skin.note, center && "max-w-[60ch]")}>{note}</p> : null}
      {action}
    </div>
  );
}
