import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { offeringWhatsappUrl } from "@/lib/site/links";
import type { OfferingItem, SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import { tint, type RenderCtx } from "../context";
import { SiteImage } from "../SiteImage";

type Layout = "carousel" | "grid" | "list";

function pickLayout(section: SectionOf<"offerings">): Layout {
  if (section.kind === "models" || section.kind === "listings" || section.kind === "packages") return "carousel";
  const withImages = section.items.filter((i) => i.image).length;
  return withImages > 0 && withImages * 2 >= section.items.length ? "grid" : "list";
}

function Tag({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-pill bg-site-accent px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.04em] text-white">{children}</span>
  );
}

function Placeholder({ ctx, className }: { ctx: RenderCtx; className: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)} style={{ background: tint(10) }}>
      <Icon name={ctx.category.icon} size={30} className="text-site-accent opacity-40" />
    </div>
  );
}

function Carousel({ ctx, items }: { ctx: RenderCtx; items: OfferingItem[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @3xl:mx-0 @3xl:grid @3xl:grid-cols-3 @3xl:overflow-visible @3xl:px-0">
      {items.map((item) => {
        const ask = offeringWhatsappUrl(ctx.site, item.name);
        return (
          <article key={item.id} className={cn(card, "flex w-[min(78%,300px)] shrink-0 snap-start flex-col overflow-hidden @3xl:w-auto")}>
            <div className="relative">
              {item.image ? (
                <div className="relative aspect-[16/10]">
                  <SiteImage image={item.image} sizes="(max-width: 768px) 78vw, 360px" />
                </div>
              ) : (
                <Placeholder ctx={ctx} className="aspect-[16/10]" />
              )}
              {item.tag ? (
                <div className="absolute top-2 left-2">
                  <Tag>{item.tag}</Tag>
                </div>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <h3 className="text-[16px] font-bold leading-[1.2]">{item.name}</h3>
              {item.description ? <p className="text-[13px] leading-[1.45] text-site-muted">{item.description}</p> : null}
              {item.price ? <span className="pt-1 text-[15px] font-bold text-site-accent">{item.price}</span> : null}
              {ask ? (
                <a href={ask} target={ctx.target} rel={ctx.rel} className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-bold text-site-accent">
                  {ctx.strings.askAbout}
                  <Icon name="arrow_forward" size={16} />
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Grid({ ctx, items }: { ctx: RenderCtx; items: OfferingItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 @md:grid-cols-3 @3xl:grid-cols-4">
      {items.map((item) => {
        const ask = offeringWhatsappUrl(ctx.site, item.name);
        const body = (
          <>
            <div className="relative">
              {item.image ? (
                <div className="relative aspect-[4/3]">
                  <SiteImage image={item.image} sizes="(max-width: 768px) 50vw, 280px" />
                </div>
              ) : (
                <Placeholder ctx={ctx} className="aspect-[4/3]" />
              )}
              {item.tag ? (
                <div className="absolute top-2 left-2">
                  <Tag>{item.tag}</Tag>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-[3px] px-3 pt-[10px] pb-3">
              <h3 className="text-[14px] font-bold leading-[1.25]">{item.name}</h3>
              {item.description ? <p className="line-clamp-2 text-[12px] leading-[1.4] text-site-muted">{item.description}</p> : null}
              {item.price ? <span className="text-[13px] font-bold text-site-accent">{item.price}</span> : null}
            </div>
          </>
        );
        const className = cn(card, "flex flex-col overflow-hidden");
        return ask ? (
          <a key={item.id} href={ask} target={ctx.target} rel={ctx.rel} className={className}>
            {body}
          </a>
        ) : (
          <article key={item.id} className={className}>
            {body}
          </article>
        );
      })}
    </div>
  );
}

function List({ items }: { items: OfferingItem[] }) {
  return (
    <ul className="@3xl:grid @3xl:grid-cols-2 @3xl:gap-x-10">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 border-b border-site-line py-3 last:border-0 @3xl:border-b">
          {item.image ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-thumb">
              <SiteImage image={item.image} sizes="56px" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold leading-[1.3]">
                {item.name}
                {item.tag ? (
                  <span className="ml-2 align-middle">
                    <Tag>{item.tag}</Tag>
                  </span>
                ) : null}
              </h3>
              {item.price ? <span className="shrink-0 text-[14px] font-bold text-site-accent">{item.price}</span> : null}
            </div>
            {item.description ? <p className="text-[13px] leading-[1.45] text-site-muted">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Offerings({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"offerings"> }) {
  if (!section.items.length) return null;
  const layout = pickLayout(section);
  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx} note={section.note}>
        {section.title}
      </SectionTitle>
      {layout === "carousel" ? <Carousel ctx={ctx} items={section.items} /> : layout === "grid" ? <Grid ctx={ctx} items={section.items} /> : <List items={section.items} />}
    </Section>
  );
}
