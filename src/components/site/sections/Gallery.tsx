import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import type { TemplateId } from "@/lib/site/templates";
import { Section, SectionHead } from "../Section";
import type { RenderCtx } from "../context";
import { SiteImage } from "../SiteImage";

/** Warm's editorial rhythm: a large lead tile, then a tall one, repeating. */
const warmSpan = (i: number) => (i % 6 === 0 ? "col-span-2 row-span-2" : i % 6 === 3 ? "@3xl:row-span-2" : "");
/** Elegant's 12-column mosaic. */
const ELEGANT_SPANS = ["@3xl:col-span-7 @3xl:row-span-2", "@3xl:col-span-5", "@3xl:col-span-5", "@3xl:col-span-4", "@3xl:col-span-4", "@3xl:col-span-4"] as const;

const RADIUS: Record<TemplateId, string> = {
  warm: "rounded-[4px]",
  elegant: "rounded-none",
  bold: "rounded-none",
  trust: "rounded-[12px]",
  bright: "rounded-[20px]",
};

export function Gallery({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"gallery"> }) {
  if (!section.images.length) return null;
  const { template, strings } = ctx;
  const images = section.images;
  const title = section.title ?? strings.gallery;
  const tile = (className: string) => cn("relative overflow-hidden bg-site-line", RADIUS[template], className);

  if (template === "bold") {
    const [lead, ...rest] = images;
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="grid gap-3 @md:grid-cols-2 @3xl:auto-rows-[240px] @3xl:grid-cols-12 @3xl:gap-4">
          <div className="flex flex-col justify-end gap-3 bg-site-ink p-6 text-white @md:col-span-2 @3xl:col-span-4 @3xl:row-span-2 @3xl:p-10">
            <SectionHead ctx={ctx} id={section.id} kicker={strings.gallery} title={title} dark />
          </div>
          <div className={tile("aspect-[4/3] @md:col-span-2 @3xl:col-span-8 @3xl:row-span-2 @3xl:aspect-auto")}>
            <SiteImage image={lead} sizes="(max-width: 768px) 100vw, 840px" />
          </div>
          {rest.map((image, i) => (
            <div key={`${image.url}-${i}`} className={tile("aspect-[4/3] @3xl:col-span-4 @3xl:aspect-auto")}>
              <SiteImage image={image} sizes="(max-width: 768px) 50vw, 420px" />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const head = <SectionHead ctx={ctx} id={section.id} kicker={strings.gallery} title={title} />;

  if (template === "trust") {
    return (
      <Section ctx={ctx} id={section.id} head={head}>
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-4">
          {images.map((image, i) => (
            <div key={`${image.url}-${i}`} className={tile("aspect-[4/3]")}>
              <SiteImage image={image} sizes="(max-width: 768px) 50vw, 320px" />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const grid =
    template === "warm" && images.length >= 5 ? (
      <div className="grid auto-rows-[150px] grid-cols-2 gap-2 @3xl:auto-rows-[200px] @3xl:grid-cols-4 @3xl:gap-3">
        {images.map((image, i) => (
          <div key={`${image.url}-${i}`} className={tile(warmSpan(i))}>
            <SiteImage image={image} sizes="(max-width: 768px) 50vw, 540px" />
          </div>
        ))}
      </div>
    ) : template === "elegant" && images.length >= 3 ? (
      <div className="grid auto-rows-[160px] grid-cols-2 gap-2 @3xl:auto-rows-[220px] @3xl:grid-cols-12 @3xl:gap-4">
        {images.map((image, i) => (
          <div key={`${image.url}-${i}`} className={tile(cn(i % 6 === 0 && "col-span-2", ELEGANT_SPANS[i % 6]))}>
            <SiteImage image={image} sizes="(max-width: 768px) 100vw, 640px" />
          </div>
        ))}
      </div>
    ) : (
      <div className={cn("grid grid-cols-2 gap-3 @3xl:gap-4", images.length >= 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2")}>
        {images.map((image, i) => (
          <div key={`${image.url}-${i}`} className={tile(template === "bright" ? "aspect-[4/3]" : "aspect-square")}>
            <SiteImage image={image} sizes="(max-width: 768px) 50vw, 420px" />
          </div>
        ))}
      </div>
    );

  return (
    <Section ctx={ctx} id={section.id}>
      <div className="flex flex-col gap-8 @3xl:gap-12">
        {head}
        {grid}
      </div>
    </Section>
  );
}
