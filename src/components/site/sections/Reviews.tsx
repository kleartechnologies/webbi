import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import type { RenderCtx } from "../context";

export function Reviews({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"reviews"> }) {
  if (!section.items.length) return null;
  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx}>{section.title ?? ctx.strings.reviews}</SectionTitle>
      <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
        {section.items.map((review) => {
          const rating = review.rating ?? 5;
          return (
            <figure key={review.id} className={`${card} flex flex-col gap-2 p-4`}>
              <div className="flex gap-[2px]" aria-label={`${rating} / 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name="star" size={16} fill className={cn(i < rating ? "text-amber" : "text-site-line")} />
                ))}
              </div>
              <blockquote className="text-[14px] leading-[1.55]">&ldquo;{review.text}&rdquo;</blockquote>
              <figcaption className="text-[13px]">
                <span className="font-bold">{review.name}</span>
                {review.source ? <span className="text-site-muted"> · {review.source}</span> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </Section>
  );
}
