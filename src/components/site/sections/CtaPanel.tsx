import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { Section } from "../Section";
import { headingClass, type RenderCtx } from "../context";

export function CtaPanel({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"cta"> }) {
  const { primary, preset, target, rel } = ctx;
  if (!primary.href) return null;
  const dark = preset.heroDark;
  return (
    <Section id={section.id}>
      <div className={cn("flex flex-col gap-4 rounded-panel p-6 text-white @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:gap-8 @3xl:p-10", dark ? "bg-site-ink" : "bg-site-accent")}>
        <div className="flex flex-col gap-2">
          <h2 className={cn(headingClass(preset), "text-[26px] leading-[1.1] tracking-[-0.01em] @3xl:text-[34px]")}>{section.headline}</h2>
          {section.body ? <p className="text-[15px] leading-[1.5] text-white/85">{section.body}</p> : null}
        </div>
        <a
          href={primary.href}
          target={target}
          rel={rel}
          className={cn(
            "inline-flex h-[54px] shrink-0 items-center justify-center gap-[10px] rounded-pill px-6 text-[16px] font-bold",
            primary.green ? "bg-whatsapp text-white" : dark ? "bg-site-accent text-white" : "bg-white text-site-accent",
          )}
        >
          <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />
          {primary.label}
        </a>
      </div>
    </Section>
  );
}
