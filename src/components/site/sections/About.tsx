import { Icon } from "@/components/ui/Icon";
import type { SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import { SocialLinks } from "../SocialLinks";
import type { RenderCtx } from "../context";

export function About({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"about"> }) {
  const highlights = section.highlights?.filter(Boolean) ?? [];
  return (
    <Section id={section.id}>
      <div className="grid gap-5 @3xl:grid-cols-2 @3xl:gap-12">
        <div>
          <SectionTitle ctx={ctx}>{section.title ?? ctx.strings.about}</SectionTitle>
          <div className="flex flex-col gap-3 text-[15px] leading-[1.6] @3xl:text-[17px]">
            {section.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          {ctx.category.personLed ? <SocialLinks ctx={ctx} at="about" label={ctx.strings.follow} className="pt-4" /> : null}
        </div>
        {highlights.length ? (
          <ul className="grid gap-2 @md:grid-cols-2 @3xl:grid-cols-1 @3xl:self-center">
            {highlights.map((text) => (
              <li key={text} className={`${card} flex items-start gap-[10px] px-4 py-3 text-[14px] font-semibold leading-[1.35]`}>
                <Icon name="check_circle" size={20} fill className="mt-[1px] shrink-0 text-site-accent" />
                {text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
