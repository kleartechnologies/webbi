import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionHead } from "../Section";
import { iconFor, twoDigits, type RenderCtx } from "../context";
import { brightTint } from "../skin";

const text = "[overflow-wrap:anywhere]";

/** Bright's value marks: circle, square, diamond. */
const MARK = ["rounded-full", "rounded-[6px]", "rotate-45 rounded-[4px]"] as const;

export function Highlights({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"highlights"> }) {
  if (!section.items.length) return null;
  const { template } = ctx;
  const head = section.title ? (
    <SectionHead ctx={ctx} id={section.id} title={section.title} center={template === "bright"} />
  ) : null;

  if (template === "trust") {
    return (
      <Section ctx={ctx} id={section.id} head={head ?? <SectionHead ctx={ctx} id={section.id} title={ctx.strings.whyUs} />}>
        <ul className="grid gap-4 @md:grid-cols-2 @5xl:grid-cols-3">
          {section.items.map((item, i) => (
            <li key={item.id} className="flex flex-col gap-3 rounded-[12px] border border-site-line bg-white p-5 @3xl:p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#DCE8EF] text-site-accent">
                  <Icon name={iconFor(item.icon)} size={22} />
                </span>
                <span className="font-site-mono text-[11px] font-medium text-site-muted">{twoDigits(i + 1)}</span>
              </div>
              <h3 className={cn("text-[17px] leading-[1.3] font-bold", text)}>{item.title}</h3>
              {item.text ? <p className={cn("text-[14px] leading-[1.55] text-site-muted", text)}>{item.text}</p> : null}
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  if (template === "bold") {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col gap-10 @3xl:gap-14">
          {head}
          <ul className="grid gap-x-8 gap-y-10 @md:grid-cols-2 @5xl:grid-cols-3">
            {section.items.map((item, i) => (
              <li key={item.id} className="flex flex-col gap-3 border-t-2 border-site-ink pt-5">
                <span className="text-[56px] leading-[0.85] font-extrabold text-site-accent site-wider @3xl:text-[80px]">{twoDigits(i + 1)}</span>
                <h3 className={cn("text-[22px] leading-[1] font-extrabold uppercase site-wide @3xl:text-[26px]", text)}>{item.title}</h3>
                {item.text ? <p className={cn("text-[15px] leading-[1.6] text-[#2A3038] @3xl:text-[16px]", text)}>{item.text}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }

  if (template === "elegant") {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col gap-10 @3xl:gap-14">
          {head}
          <ul className="grid gap-px border-y border-site-line bg-site-line @md:grid-cols-2 @3xl:grid-cols-3">
            {section.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 bg-site-ground py-7 @md:px-6 @3xl:px-8 @3xl:py-10">
                <Icon name={iconFor(item.icon)} size={24} className="text-site-accent" />
                <h3 className={cn("font-site text-[21px] leading-[1.2] @3xl:text-[24px]", text)}>{item.title}</h3>
                {item.text ? <p className={cn("text-[14px] leading-[1.7] text-[#6B5C60]", text)}>{item.text}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }

  if (template === "bright") {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col items-center gap-10 @3xl:gap-14">
          {head}
          <ul className="grid w-full gap-8 @md:grid-cols-2 @3xl:grid-cols-3 @3xl:gap-12">
            {section.items.map((item, i) => (
              <li key={item.id} className="flex flex-col items-center gap-3 text-center">
                <span className={cn("mb-2 flex h-14 w-14 items-center justify-center", brightTint(i).panel, i % 3 === 2 ? "rounded-[14px]" : MARK[i % 3])}>
                  <span className={cn("h-5 w-5", brightTint(i).mark, MARK[i % 3])} aria-hidden />
                </span>
                <h3 className={cn("text-[20px] leading-[1.25] font-bold tracking-[-0.015em] @3xl:text-[22px]", text)}>{item.title}</h3>
                {item.text ? <p className={cn("max-w-[34ch] text-[15px] leading-[1.6] text-[#4C5C67] @3xl:text-[16px]", text)}>{item.text}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }

  // Warm
  return (
    <Section ctx={ctx} id={section.id}>
      <div className="flex flex-col gap-8 @3xl:gap-12">
        {head}
        <ul className="grid gap-x-10 gap-y-7 @md:grid-cols-2 @3xl:grid-cols-3">
          {section.items.map((item) => (
            <li key={item.id} className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F3E9DC] text-site-accent">
                <Icon name={iconFor(item.icon)} size={24} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className={cn("font-site text-[18px] leading-[1.25] font-bold @3xl:text-[20px]", text)}>{item.title}</h3>
                {item.text ? <p className={cn("text-[14px] leading-[1.6] text-site-muted @3xl:text-[15px]", text)}>{item.text}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
