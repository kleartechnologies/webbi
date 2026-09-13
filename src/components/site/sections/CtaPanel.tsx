import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { Section } from "../Section";
import { headingClass, type RenderCtx } from "../context";

const text = "[overflow-wrap:anywhere]";

export function CtaPanel({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"cta"> }) {
  const { primary, preset, target, rel, template, skin } = ctx;
  if (!primary.href) return null;
  const icon = <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />;
  const heading = headingClass(preset);

  if (template === "trust") {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col gap-6 rounded-[12px] bg-[#DCE8EF] p-6 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:gap-10 @3xl:p-10">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className={cn(heading, "text-[24px] leading-[1.15] @3xl:text-[32px]", text)}>{section.headline}</h2>
            {section.body ? <p className={cn("text-[15px] leading-[1.55] text-[#40525E] @3xl:text-[17px]", text)}>{section.body}</p> : null}
          </div>
          <a href={primary.href} target={target} rel={rel} className={cn(skin.btn, skin.btnPrimary, "shrink-0")}>
            {icon}
            {primary.label}
          </a>
        </div>
      </Section>
    );
  }

  const band = {
    warm: "bg-[#2B1F16] text-[#FBF7F0] site-grain-dark",
    elegant: "bg-site-ink text-site-ground",
    bold: "bg-site-ink text-white",
    bright: "bg-[#FFF7D9] text-site-ink",
  }[template];
  const h2 = {
    warm: "text-[32px] leading-[1.1] @3xl:text-[48px]",
    elegant: "text-[32px] leading-[1.12] @3xl:text-[46px]",
    bold: "text-[42px] leading-[0.92] @3xl:text-[72px] @3xl:leading-[0.9]",
    bright: "text-[32px] leading-[1.1] @3xl:text-[46px]",
  }[template];
  const sub = {
    warm: "text-[#FBF7F0]/75",
    elegant: "text-[#C9B9BD]",
    bold: "text-[#C3C8D1]",
    bright: "text-[#5C4F26]",
  }[template];
  const button = {
    warm: cn(skin.btn, primary.green ? "bg-whatsapp text-white" : "bg-site-accent text-white"),
    elegant: cn(skin.btn, "bg-site-ground text-site-ink hover:bg-[#EFE6E1]"),
    bold: cn(skin.btn, "bg-site-accent text-white"),
    bright: cn(skin.btn, skin.btnPrimary),
  }[template];
  const center = template !== "bold";

  return (
    <Section ctx={ctx} id={section.id} band={band}>
      <div className={cn("flex flex-col gap-6", center ? "items-center text-center" : "@3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-12")}>
        <div className={cn("flex min-w-0 flex-col gap-3", center && "items-center")}>
          <h2 className={cn(heading, h2, center && "max-w-[20ch]", text)}>{section.headline}</h2>
          {section.body ? <p className={cn("max-w-[56ch] text-[16px] leading-[1.6] @3xl:text-[18px]", sub, text)}>{section.body}</p> : null}
        </div>
        <a href={primary.href} target={target} rel={rel} className={cn(button, "shrink-0")}>
          {icon}
          {primary.label}
        </a>
      </div>
    </Section>
  );
}
