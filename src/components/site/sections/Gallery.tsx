import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionTitle } from "../Section";
import type { RenderCtx } from "../context";
import { SiteImage } from "../SiteImage";

export function Gallery({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"gallery"> }) {
  if (!section.images.length) return null;
  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx}>{section.title ?? ctx.strings.gallery}</SectionTitle>
      <div className="grid grid-cols-3 gap-2 @3xl:grid-cols-6 @3xl:gap-3">
        {section.images.map((image, i) => (
          <div key={`${image.url}-${i}`} className="relative aspect-square overflow-hidden rounded-thumb bg-site-line">
            <SiteImage image={image} sizes="(max-width: 768px) 33vw, 180px" />
          </div>
        ))}
      </div>
    </Section>
  );
}
