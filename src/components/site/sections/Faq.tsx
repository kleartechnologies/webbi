import { Icon } from "@/components/ui/Icon";
import type { SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import type { RenderCtx } from "../context";

export function Faq({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"faq"> }) {
  if (!section.items.length) return null;
  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx}>{section.title ?? ctx.strings.faq}</SectionTitle>
      <div className={`${card} overflow-hidden`}>
        {section.items.map((item) => (
          <details key={item.id} className="group border-b border-site-line last:border-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-[14px] text-[15px] font-semibold leading-[1.35] [&::-webkit-details-marker]:hidden">
              {item.question}
              <Icon name="expand_more" size={22} className="shrink-0 text-site-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-[14px] leading-[1.55] text-site-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
