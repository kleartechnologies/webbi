import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { offeringWhatsappUrl } from "@/lib/site/links";
import type { OfferingItem, SectionOf } from "@/lib/site/schema";
import { Section, SectionHead } from "../Section";
import { tint, twoDigits, type RenderCtx } from "../context";
import { brightTint } from "../skin";
import { SiteImage } from "../SiteImage";

type OfferingsSection = SectionOf<"offerings">;

/** Models, listings and packages read as cards; anything else as rows unless most items have photos. */
function wantsCards(section: OfferingsSection): boolean {
  if (section.kind === "models" || section.kind === "listings" || section.kind === "packages") return true;
  const withImages = section.items.filter((i) => i.image).length;
  return withImages > 0 && withImages * 2 >= section.items.length;
}

function Ask({ ctx, item, className, children }: { ctx: RenderCtx; item: OfferingItem; className: string; children?: React.ReactNode }) {
  const ask = offeringWhatsappUrl(ctx.site, item.name);
  if (!ask) return null;
  return (
    <a href={ask} target={ctx.target} rel={ctx.rel} className={className}>
      {children ?? ctx.strings.askAbout}
      <Icon name="arrow_forward" size={16} />
    </a>
  );
}

function Photo({ ctx, item, className, sizes, dark }: { ctx: RenderCtx; item: OfferingItem; className: string; sizes: string; dark?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={item.image ? undefined : { background: dark ? "#1B222C" : tint(10) }}>
      {item.image ? (
        <SiteImage image={item.image} sizes={sizes} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Icon name={ctx.category.icon} size={34} className={dark ? "text-white/25" : "text-site-accent opacity-40"} />
        </div>
      )}
    </div>
  );
}

const text = "[overflow-wrap:anywhere]";

/* Warm: featured photo cards (4:5), then the rest as menu rows with a dotted leader. */
function Warm({ ctx, section }: { ctx: RenderCtx; section: OfferingsSection }) {
  const featured = section.items.filter((i) => i.image).slice(0, 3);
  const rows = section.items.filter((i) => !featured.includes(i));
  return (
    <Section ctx={ctx} id={section.id} head={null}>
      <div className="flex flex-col gap-8 @3xl:gap-12">
        <SectionHead ctx={ctx} id={section.id} kicker={ctx.strings.kinds[section.kind]} title={section.title} note={section.note} />
        {featured.length ? (
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @3xl:mx-0 @3xl:grid @3xl:grid-cols-3 @3xl:gap-7 @3xl:overflow-visible @3xl:px-0">
            {featured.map((item) => (
              <article key={item.id} className="flex w-[228px] shrink-0 snap-start flex-col gap-3 @3xl:w-auto">
                <div className="relative">
                  <Photo ctx={ctx} item={item} className="aspect-[4/5] rounded-[4px]" sizes="(max-width: 768px) 228px, 360px" />
                  {item.tag ? (
                    <span className="absolute top-3 left-3 rounded-pill bg-site-ground px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-site-accent">{item.tag}</span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className={cn("font-site text-[19px] font-bold leading-[1.2] @3xl:text-[22px]", text)}>{item.name}</h3>
                  {item.price ? <span className="max-w-[45%] shrink-0 text-right text-[15px] font-bold text-site-accent [overflow-wrap:anywhere] @3xl:text-[16px]">{item.price}</span> : null}
                </div>
                {item.description ? <p className={cn("text-[14px] leading-[1.55] text-site-muted @3xl:text-[15px]", text)}>{item.description}</p> : null}
                <Ask ctx={ctx} item={item} className="inline-flex items-center gap-1 text-[13px] font-bold text-site-accent" />
              </article>
            ))}
          </div>
        ) : null}
        {rows.length ? (
          <ul className="grid gap-x-14 @3xl:grid-cols-2">
            {rows.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 border-b border-site-line py-4">
                <div className="flex items-baseline gap-3">
                  <h3 className={cn("font-site text-[17px] font-bold leading-[1.25] @3xl:text-[19px]", text)}>{item.name}</h3>
                  {item.tag ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-site-accent">{item.tag}</span> : null}
                  <span aria-hidden className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-[#C9B8A6]" />
                  {item.price ? <span className="max-w-[45%] shrink-0 text-right text-[15px] font-bold text-site-ink [overflow-wrap:anywhere]">{item.price}</span> : null}
                </div>
                {item.description ? <p className={cn("text-[14px] leading-[1.5] text-site-muted", text)}>{item.description}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

/* Elegant: rows beside a 332px title column, or square-cornered portrait cards. */
function Elegant({ ctx, section }: { ctx: RenderCtx; section: OfferingsSection }) {
  const head = <SectionHead ctx={ctx} id={section.id} kicker={ctx.strings.kinds[section.kind]} title={section.title} note={section.note} />;
  if (wantsCards(section) && section.items.some((i) => i.image)) {
    return (
      <Section ctx={ctx} id={section.id}>
        <div className="flex flex-col gap-10 @3xl:gap-14">
          {head}
          <div className="grid gap-x-7 gap-y-10 @md:grid-cols-2 @3xl:grid-cols-3">
            {section.items.map((item) => (
              <article key={item.id} className="flex flex-col gap-3">
                <Photo ctx={ctx} item={item} className="aspect-[4/5]" sizes="(max-width: 768px) 100vw, 360px" />
                {item.tag ? <span className="pt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-site-accent">{item.tag}</span> : null}
                <h3 className={cn("font-site text-[22px] leading-[1.2]", text)}>{item.name}</h3>
                {item.description ? <p className={cn("text-[14px] leading-[1.7] text-[#6B5C60]", text)}>{item.description}</p> : null}
                <div className="flex items-center justify-between gap-3 border-t border-site-line pt-3">
                  {item.price ? <span className="text-[15px] font-semibold">{item.price}</span> : <span />}
                  <Ask ctx={ctx} item={item} className="inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>
    );
  }
  return (
    <Section ctx={ctx} id={section.id} head={head} aside>
      <ul className="border-t border-site-line">
        {section.items.map((item) => (
          <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-b border-site-line py-5 @3xl:py-6">
            <div className="flex min-w-0 items-center gap-3">
              {item.image ? (
                <Photo ctx={ctx} item={item} className="h-14 w-14 shrink-0" sizes="56px" />
              ) : null}
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className={cn("font-site text-[19px] leading-[1.25] @3xl:text-[22px]", text)}>
                  {item.name}
                  {item.tag ? <span className="ml-3 align-middle font-ui text-[9px] font-semibold uppercase tracking-[0.22em] text-site-accent">{item.tag}</span> : null}
                </h3>
                {item.description ? <p className={cn("text-[14px] leading-[1.65] text-[#6B5C60]", text)}>{item.description}</p> : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {item.price ? <span className="text-[15px] font-semibold whitespace-nowrap @3xl:text-[16px]">{item.price}</span> : null}
              <Ask ctx={ctx} item={item} className="hidden items-center gap-1 text-[12px] font-semibold text-site-accent @md:inline-flex">
                {ctx.strings.whatsapp}
              </Ask>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Bold: a dark band of 4:3 cards with red tags, or numbered rows that invert on hover. */
function Bold({ ctx, section }: { ctx: RenderCtx; section: OfferingsSection }) {
  if (wantsCards(section)) {
    return (
      <Section ctx={ctx} id={section.id} band="bg-site-ink text-white">
        <div className="flex flex-col gap-10 @3xl:gap-14">
          <SectionHead ctx={ctx} id={section.id} kicker={ctx.strings.kinds[section.kind]} title={section.title} note={section.note} dark />
          <div className="grid gap-4 @md:grid-cols-2 @5xl:grid-cols-3 @3xl:gap-5">
            {section.items.map((item) => (
              <article key={item.id} className="flex flex-col bg-[#1B222C]">
                <div className="relative">
                  <Photo ctx={ctx} item={item} className="aspect-[4/3]" sizes="(max-width: 768px) 100vw, 400px" dark />
                  {item.tag ? <span className="absolute top-0 left-0 bg-site-accent px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white">{item.tag}</span> : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5 @3xl:p-6">
                  <h3 className={cn("text-[24px] leading-[0.98] font-extrabold uppercase site-wide @3xl:text-[28px]", text)}>{item.name}</h3>
                  {item.description ? <p className={cn("text-[15px] leading-[1.55] text-[#C3C8D1]", text)}>{item.description}</p> : null}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    {item.price ? <span className="text-[18px] font-extrabold text-white">{item.price}</span> : <span />}
                    <Ask ctx={ctx} item={item} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#FF4B33]" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>
    );
  }
  return (
    <Section ctx={ctx} id={section.id}>
      <div className="flex flex-col gap-10 @3xl:gap-14">
        <SectionHead ctx={ctx} id={section.id} kicker={ctx.strings.kinds[section.kind]} title={section.title} note={section.note} />
        <ol className="border-t-2 border-site-ink">
          {section.items.map((item, i) => {
            const ask = offeringWhatsappUrl(ctx.site, item.name);
            const row = (
              <>
                <span className="text-[34px] leading-none font-extrabold text-site-accent site-wide group-hover:text-[#FF4B33] @3xl:text-[56px]">{twoDigits(i + 1)}</span>
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className={cn("text-[22px] leading-[0.98] font-extrabold uppercase site-wide @3xl:text-[30px]", text)}>{item.name}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.price ? <span className="text-[15px] font-extrabold">{item.price}</span> : null}
                    {item.tag ? <span className="bg-site-accent px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">{item.tag}</span> : null}
                  </div>
                </div>
                {item.description ? (
                  <p className={cn("col-span-2 text-[15px] leading-[1.6] text-[#2A3038] group-hover:text-[#C3C8D1] @3xl:col-span-1 @3xl:text-[16px]", text)}>{item.description}</p>
                ) : (
                  <span className="hidden @3xl:block" />
                )}
                <span className="hidden h-14 w-14 items-center justify-center border-2 border-site-ink group-hover:border-site-accent group-hover:bg-site-accent @3xl:flex">
                  <Icon name="arrow_outward" size={24} />
                </span>
              </>
            );
            const className =
              "group grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 border-b border-site-line px-1 py-6 transition-colors hover:bg-site-ink hover:text-white @3xl:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_56px] @3xl:items-center @3xl:gap-x-6 @3xl:px-4 @3xl:py-8 @6xl:grid-cols-[140px_420px_minmax(0,1fr)_56px] @6xl:gap-x-8";
            return (
              <li key={item.id}>
                {ask ? (
                  <a href={ask} target={ctx.target} rel={ctx.rel} className={className}>
                    {row}
                  </a>
                ) : (
                  <div className={className}>{row}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}

/* Trust: white cards with a mono price, or service rows in one card. */
function Trust({ ctx, section }: { ctx: RenderCtx; section: OfferingsSection }) {
  const head = <SectionHead ctx={ctx} id={section.id} kicker={ctx.strings.kinds[section.kind]} title={section.title} note={section.note} />;
  const anyImage = section.items.some((i) => i.image);
  if (wantsCards(section)) {
    return (
      <Section ctx={ctx} id={section.id} head={head}>
        <div className="grid gap-4 @md:grid-cols-2 @5xl:grid-cols-3">
          {section.items.map((item) => (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-[12px] border border-site-line bg-white">
              {anyImage ? <Photo ctx={ctx} item={item} className="aspect-[4/3]" sizes="(max-width: 768px) 100vw, 400px" /> : null}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className={cn("text-[17px] leading-[1.3] font-bold", text)}>{item.name}</h3>
                  {item.tag ? <span className="shrink-0 rounded-[6px] bg-[#DCE8EF] px-2 py-1 font-site-mono text-[10px] font-medium uppercase tracking-[0.08em] text-site-accent">{item.tag}</span> : null}
                </div>
                {item.description ? <p className={cn("text-[14px] leading-[1.55] text-site-muted", text)}>{item.description}</p> : null}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-site-line pt-3">
                  {item.price ? <span className="font-site-mono text-[14px] font-semibold">{item.price}</span> : <span />}
                  <Ask ctx={ctx} item={item} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-site-accent" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
    );
  }
  return (
    <Section ctx={ctx} id={section.id} head={head}>
      <ul className="overflow-hidden rounded-[12px] border border-site-line bg-white">
        {section.items.map((item) => (
          <li key={item.id} className="flex items-start gap-4 border-b border-site-line px-5 py-4 last:border-0 @3xl:px-6 @3xl:py-5">
            {item.image ? <Photo ctx={ctx} item={item} className="h-14 w-14 shrink-0 rounded-[8px]" sizes="56px" /> : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className={cn("text-[16px] leading-[1.3] font-semibold @3xl:text-[17px]", text)}>
                {item.name}
                {item.tag ? <span className="ml-2 rounded-[6px] bg-[#DCE8EF] px-2 py-[2px] align-middle font-site-mono text-[10px] font-medium uppercase tracking-[0.08em] text-site-accent">{item.tag}</span> : null}
              </h3>
              {item.description ? <p className={cn("text-[14px] leading-[1.55] text-site-muted", text)}>{item.description}</p> : null}
            </div>
            {item.price ? <span className="shrink-0 pt-[2px] font-site-mono text-[14px] font-semibold whitespace-nowrap">{item.price}</span> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Bright: a six-column grid of rounded panels; the first one leads wide. */
function Bright({ ctx, section }: { ctx: RenderCtx; section: OfferingsSection }) {
  const anyImage = section.items.some((i) => i.image);
  return (
    <Section ctx={ctx} id={section.id}>
      <div className="flex flex-col gap-8 @3xl:gap-12">
        <SectionHead ctx={ctx} id={section.id} kicker={ctx.strings.kinds[section.kind]} title={section.title} note={section.note} />
        <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-6 @3xl:gap-5">
          {section.items.map((item, i) => {
            const lead = anyImage && i === 0;
            const tintOf = brightTint(i);
            return (
              <article
                key={item.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-[20px] border border-site-line bg-white",
                  lead ? "@md:col-span-2 @3xl:col-span-4 @3xl:grid @3xl:grid-cols-2" : anyImage ? "@3xl:col-span-2" : "@3xl:col-span-3",
                )}
              >
                {anyImage ? (
                  <Photo ctx={ctx} item={item} className={cn("aspect-[4/3]", lead && "@3xl:aspect-auto @3xl:h-full @3xl:min-h-[280px]")} sizes="(max-width: 768px) 100vw, 480px" />
                ) : null}
                <div className="flex flex-1 flex-col gap-3 p-6 @3xl:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("h-3 w-3 rounded-full", tintOf.mark)} aria-hidden />
                    {item.tag ? <span className={cn("rounded-[9px] px-[10px] py-1 text-[12.5px] font-semibold", tintOf.chip)}>{item.tag}</span> : null}
                  </div>
                  <h3 className={cn("text-[20px] leading-[1.2] font-bold tracking-[-0.015em] @3xl:text-[22px]", lead && "@3xl:text-[26px]", text)}>{item.name}</h3>
                  {item.description ? <p className={cn("text-[15px] leading-[1.6] text-[#4C5C67]", text)}>{item.description}</p> : null}
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#EDE7DA] pt-4">
                    {item.price ? <span className="text-[16px] font-bold">{item.price}</span> : <span />}
                    <Ask ctx={ctx} item={item} className="inline-flex shrink-0 items-center gap-1 text-[14px] font-bold" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

export function Offerings({ ctx, section }: { ctx: RenderCtx; section: OfferingsSection }) {
  if (!section.items.length) return null;
  switch (ctx.template) {
    case "warm":
      return <Warm ctx={ctx} section={section} />;
    case "elegant":
      return <Elegant ctx={ctx} section={section} />;
    case "bold":
      return <Bold ctx={ctx} section={section} />;
    case "bright":
      return <Bright ctx={ctx} section={section} />;
    default:
      return <Trust ctx={ctx} section={section} />;
  }
}
