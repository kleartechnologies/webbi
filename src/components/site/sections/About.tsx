import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionHead } from "../Section";
import { SocialLinks } from "../SocialLinks";
import { buttonClass, type RenderCtx } from "../context";
import { brightTint } from "../skin";

const text = "[overflow-wrap:anywhere]";

export function About({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"about"> }) {
  const { template, skin, strings, category, chat, target, rel } = ctx;
  const highlights = section.highlights?.filter(Boolean) ?? [];
  const title = section.title ?? strings.about;
  const social = category.personLed ? <SocialLinks ctx={ctx} at="about" label={strings.follow} className="pt-2" /> : null;

  const body = (
    <div className={cn("flex flex-col gap-4", skin.body)}>
      {section.body.map((paragraph, i) => (
        <p key={i} className={cn(text, i === 0 && template === "warm" && "font-site text-[19px] leading-[1.5] text-site-ink @3xl:text-[23px]", i === 0 && template === "elegant" && "font-site text-[20px] leading-[1.5] text-site-ink @3xl:text-[24px]")}>
          {paragraph}
        </p>
      ))}
    </div>
  );

  const facts = highlights.length ? (
    template === "bright" ? (
      <ul className="flex flex-wrap gap-2">
        {highlights.map((fact, i) => (
          <li key={fact} className={cn("inline-flex min-h-9 items-center rounded-[10px] px-3 py-1 text-[14px] font-semibold", brightTint(i).chip, text)}>
            {fact}
          </li>
        ))}
      </ul>
    ) : (
      <ul className={cn(template === "bold" ? "border-t-2 border-site-ink" : "border-t border-site-line", template === "trust" && "overflow-hidden rounded-[12px] border bg-white")}>
        {highlights.map((fact) => (
          <li
            key={fact}
            className={cn(
              "flex items-start gap-3 border-b border-site-line py-3 last:border-b-0 @3xl:py-4",
              template === "trust" && "px-5",
              template === "bold" ? "text-[16px] font-bold uppercase site-wide @3xl:text-[18px]" : "text-[15px] font-semibold @3xl:text-[16px]",
            )}
          >
            {template === "bold" ? (
              <span className="mt-[7px] h-2 w-2 shrink-0 bg-site-accent" aria-hidden />
            ) : template === "trust" ? (
              <span className="shrink-0 font-site-mono text-[13px] text-site-accent" aria-hidden>
                —
              </span>
            ) : (
              <Icon name="check" size={20} className="mt-[1px] shrink-0 text-site-accent" />
            )}
            <span className={cn("min-w-0", text)}>{fact}</span>
          </li>
        ))}
      </ul>
    )
  ) : null;

  if (template === "trust" || template === "elegant") {
    return (
      <Section ctx={ctx} id={section.id} head={<SectionHead ctx={ctx} id={section.id} kicker={strings.about} title={title} action={social} />} aside>
        <div className="flex max-w-[760px] flex-col gap-7">
          {body}
          {facts}
        </div>
      </Section>
    );
  }

  return (
    <Section ctx={ctx} id={section.id} band={template === "bright" ? "bg-white" : undefined}>
      <div className={cn("grid gap-8", template === "bold" ? "@3xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @3xl:gap-20" : "@3xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @3xl:gap-16")}>
        <div className="flex min-w-0 flex-col gap-5">
          <SectionHead ctx={ctx} id={section.id} kicker={strings.about} title={title} />
          {social}
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          {body}
          {facts}
          {template === "bright" && chat ? (
            <a href={chat} target={target} rel={rel} className={cn(buttonClass(ctx, "outline"), "w-fit")}>
              <Icon name="chat" size={20} />
              {strings.chat}
            </a>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
