import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionHead } from "../Section";
import type { RenderCtx } from "../context";

const text = "[overflow-wrap:anywhere]";

function Stars({ rating, className, off }: { rating: number; className: string; off: string }) {
  return (
    <div className="flex gap-[2px]" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" size={16} fill className={i < rating ? className : off} />
      ))}
    </div>
  );
}

export function Reviews({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"reviews"> }) {
  if (!section.items.length) return null;
  const { template, strings } = ctx;
  const title = section.title ?? strings.reviews;
  const items = section.items;

  if (template === "elegant") {
    return (
      <Section ctx={ctx} id={section.id} band="bg-[#E8D7D5]">
        <div className="flex flex-col gap-10 @3xl:gap-14">
          <SectionHead ctx={ctx} id={section.id} kicker={strings.reviews} title={title} tone="text-[#8A4A61]" />
          <div className="grid gap-10 @3xl:grid-cols-3 @3xl:gap-12">
            {items.map((review) => (
              <figure key={review.id} className="flex flex-col gap-5 border-t border-[#2B2024]/20 pt-6">
                <Icon name="format_quote" size={28} className="text-[#8A4A61]" />
                <blockquote className={cn("font-site text-[20px] leading-[1.45] @3xl:text-[22px]", text)}>{review.text}</blockquote>
                <figcaption className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6E4E57]">
                  <span className={text}>{review.name}</span>
                  {review.source ? <span> · {review.source}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>
    );
  }

  if (template === "bold") {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col gap-10 @3xl:gap-14">
          <SectionHead ctx={ctx} id={section.id} kicker={strings.reviews} title={title} />
          <div className="grid gap-8 @md:grid-cols-2 @5xl:grid-cols-3">
            {items.map((review) => (
              <figure key={review.id} className="flex flex-col gap-4 border-l-4 border-site-accent pl-5 @3xl:pl-7">
                <span className="text-[72px] leading-[0.6] font-extrabold text-site-accent" aria-hidden>
                  &ldquo;
                </span>
                <blockquote className={cn("text-[18px] leading-[1.5] font-semibold @3xl:text-[20px]", text)}>{review.text}</blockquote>
                <figcaption className="flex flex-col gap-1">
                  <span className={cn("text-[15px] font-extrabold uppercase site-wide", text)}>{review.name}</span>
                  <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#5A626D]">
                    <Stars rating={review.rating ?? 5} className="text-site-accent" off="text-site-line" />
                    {review.source}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>
    );
  }

  if (template === "trust") {
    return (
      <Section ctx={ctx} id={section.id} head={<SectionHead ctx={ctx} id={section.id} kicker={strings.reviews} title={title} />}>
        <div className="grid gap-4 @3xl:grid-cols-2">
          {items.map((review) => (
            <figure key={review.id} className="flex flex-col gap-4 rounded-[12px] border border-site-line bg-white p-5 @3xl:p-7">
              <Stars rating={review.rating ?? 5} className="text-site-accent" off="text-site-line" />
              <blockquote className={cn("text-[16px] leading-[1.6] @3xl:text-[18px]", text)}>&ldquo;{review.text}&rdquo;</blockquote>
              <figcaption className="flex items-center gap-3 font-site-mono text-[11px] font-medium uppercase tracking-[0.1em] text-site-muted before:h-px before:w-6 before:bg-site-accent before:content-['']">
                <span className={cn("text-site-ink", text)}>{review.name}</span>
                {review.source ? <span>/ {review.source}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>
    );
  }

  if (template === "bright") {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col items-center gap-10 @3xl:gap-12">
          <SectionHead ctx={ctx} id={section.id} kicker={strings.reviews} title={title} center />
          <div className="grid w-full gap-4 @md:grid-cols-2 @5xl:grid-cols-3 @3xl:gap-5">
            {items.map((review) => (
              <figure key={review.id} className="flex flex-col gap-4 rounded-[20px] border border-site-line bg-white p-6 @3xl:p-8">
                <Stars rating={review.rating ?? 5} className="text-[#E8A33C]" off="text-[#EFE8DA]" />
                <blockquote className={cn("text-[16px] leading-[1.65] @3xl:text-[17px]", text)}>&ldquo;{review.text}&rdquo;</blockquote>
                <figcaption className="mt-auto text-[14px]">
                  <span className={cn("font-bold", text)}>{review.name}</span>
                  {review.source ? <span className="text-[#7B8A94]"> · {review.source}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>
    );
  }

  // Warm
  return (
    <Section ctx={ctx} id={section.id}>
      <div className="flex flex-col gap-8 @3xl:gap-12">
        <SectionHead ctx={ctx} id={section.id} kicker={strings.reviews} title={title} />
        <div className="grid divide-y divide-site-line border-y border-site-line @3xl:grid-cols-3 @3xl:divide-x @3xl:divide-y-0">
          {items.map((review) => (
            <figure key={review.id} className="flex flex-col gap-4 py-7 @3xl:px-8 @3xl:py-10 @3xl:first:pl-0 @3xl:last:pr-0">
              <Stars rating={review.rating ?? 5} className="text-[#E8A33C]" off="text-site-line" />
              <blockquote className={cn("font-site text-[19px] leading-[1.45] @3xl:text-[21px]", text)}>&ldquo;{review.text}&rdquo;</blockquote>
              <figcaption className="text-[13px]">
                <span className={cn("font-bold", text)}>{review.name}</span>
                {review.source ? <span className="text-[#8A6E57]"> · {review.source}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}
