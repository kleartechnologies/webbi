import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import type { TemplateId } from "@/lib/site/templates";
import { Section, SectionHead } from "../Section";
import type { RenderCtx } from "../context";

/** Question list, row, summary and toggle per template. */
const LOOK: Record<TemplateId, { list: string; row: string; q: string; a: string; toggle: string }> = {
  warm: {
    list: "overflow-hidden rounded-[14px] border border-site-line bg-white",
    row: "border-b border-site-line last:border-0",
    q: "px-5 py-4 font-site text-[17px] font-bold @3xl:px-6 @3xl:py-5 @3xl:text-[19px]",
    a: "px-5 pb-5 text-[15px] leading-[1.6] text-site-muted @3xl:px-6",
    toggle: "text-site-accent",
  },
  elegant: {
    list: "border-t border-site-line",
    row: "border-b border-site-line",
    q: "py-5 font-site text-[19px] @3xl:py-6 @3xl:text-[22px]",
    a: "pb-6 text-[15px] leading-[1.7] text-[#6B5C60]",
    toggle: "text-site-accent",
  },
  bold: {
    list: "border-t-2 border-site-ink",
    row: "border-b border-site-line",
    q: "py-5 text-[18px] leading-[1.05] font-extrabold uppercase site-wide @3xl:py-7 @3xl:text-[24px]",
    a: "pb-6 text-[16px] leading-[1.65] text-[#2A3038] @3xl:max-w-[70ch]",
    toggle: "h-9 w-9 bg-site-accent text-white",
  },
  trust: {
    list: "overflow-hidden rounded-[12px] border border-site-line bg-white",
    row: "border-b border-site-line last:border-0",
    q: "px-5 py-4 text-[16px] font-semibold @3xl:px-6 @3xl:text-[17px]",
    a: "px-5 pb-5 text-[15px] leading-[1.6] text-site-muted @3xl:px-6",
    toggle: "text-site-accent",
  },
  bright: {
    list: "flex flex-col gap-3",
    row: "rounded-[16px] border border-site-line bg-white",
    q: "px-5 py-4 text-[16px] font-bold @3xl:px-6 @3xl:py-5 @3xl:text-[17px]",
    a: "px-5 pb-5 text-[15px] leading-[1.65] text-[#4C5C67] @3xl:px-6",
    toggle: "h-8 w-8 rounded-[10px] bg-[#E8F5FA] text-[#2C5468]",
  },
};

export function Faq({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"faq"> }) {
  if (!section.items.length) return null;
  const { template, strings } = ctx;
  const look = LOOK[template];
  const head = <SectionHead ctx={ctx} id={section.id} kicker={strings.faq} title={section.title ?? strings.faq} />;
  const list = (
    <div className={look.list}>
      {section.items.map((item) => (
        <details key={item.id} className={cn("group", look.row)}>
          <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-4 leading-[1.35] [&::-webkit-details-marker]:hidden", look.q)}>
            <span className="min-w-0 [overflow-wrap:anywhere]">{item.question}</span>
            <span className={cn("flex shrink-0 items-center justify-center transition-transform group-open:rotate-45", look.toggle)}>
              <Icon name="add" size={20} />
            </span>
          </summary>
          <p className={cn("[overflow-wrap:anywhere]", look.a)}>{item.answer}</p>
        </details>
      ))}
    </div>
  );

  if (template === "trust" || template === "elegant") {
    return (
      <Section ctx={ctx} id={section.id} head={head} aside>
        {list}
      </Section>
    );
  }
  return (
    <Section ctx={ctx} id={section.id}>
      <div className={cn("flex flex-col gap-8 @3xl:gap-12", template === "warm" && "mx-auto max-w-[820px]")}>
        {head}
        {list}
      </div>
    </Section>
  );
}
