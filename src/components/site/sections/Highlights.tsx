import { Icon } from "@/components/ui/Icon";
import type { SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import { iconFor, type RenderCtx } from "../context";

export function Highlights({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"highlights"> }) {
  if (!section.items.length) return null;
  return (
    <Section id={section.id}>
      {section.title ? <SectionTitle ctx={ctx}>{section.title}</SectionTitle> : null}
      <ul className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
        {section.items.map((item) => (
          <li key={item.id} className={`${card} flex items-start gap-3 p-4 @md:flex-col @md:gap-2`}>
            <Icon name={iconFor(item.icon)} size={26} className="shrink-0 text-site-accent" />
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-bold leading-[1.25]">{item.title}</span>
              {item.text ? <p className="text-[13px] leading-[1.45] text-site-muted">{item.text}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
