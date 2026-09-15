import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { resolveLocation } from "@/lib/site/location";
import type { SectionOf } from "@/lib/site/schema";
import type { TemplateId } from "@/lib/site/templates";
import { MapFrame } from "../MapFrame";
import { Section, SectionHead } from "../Section";
import type { RenderCtx } from "../context";

/** Map, address card, Maps link and hours per template. */
const LOOK: Record<
  TemplateId,
  { grid: string; map: string; card: string; label: string; address: string; link: string; hours: string; hoursHead: string; row: string }
> = {
  warm: {
    grid: "@3xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @3xl:gap-10",
    map: "rounded-[14px] border border-site-line aspect-[4/3] @3xl:aspect-[16/10]",
    card: "flex flex-col gap-4",
    label: "text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6E57]",
    address: "font-site text-[19px] leading-[1.45] font-bold @3xl:text-[22px]",
    link: "inline-flex h-12 w-fit items-center justify-center gap-2 rounded-pill border-[1.5px] border-site-ink px-5 text-[14px] font-bold",
    hours: "rounded-[14px] border border-site-line bg-white px-5 py-3",
    hoursHead: "py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6E57]",
    row: "border-t border-site-line py-3 text-[14px]",
  },
  elegant: {
    // Side by side from @4xl: at a 768px container the fixed 404px column left the map ~220px wide.
    grid: "@4xl:grid-cols-[minmax(0,1fr)_404px] @4xl:gap-16",
    map: "aspect-[4/3] @3xl:aspect-[16/10]",
    card: "flex flex-col gap-4",
    label: "text-[10px] font-semibold uppercase tracking-[0.24em] text-site-accent",
    address: "font-site text-[20px] leading-[1.45] @3xl:text-[22px]",
    link: "inline-flex w-fit items-center gap-2 text-[14px] font-semibold underline underline-offset-4 hover:text-site-accent",
    hours: "border-t border-site-line pt-2",
    hoursHead: "py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-site-muted",
    row: "border-b border-site-line py-3 text-[14px]",
  },
  bold: {
    grid: "@3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @3xl:gap-14",
    map: "border-2 border-site-ink aspect-[4/3]",
    card: "flex flex-col gap-5",
    label: "text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7682]",
    address: "text-[22px] leading-[1.1] font-extrabold uppercase site-wide @3xl:text-[28px]",
    link: "inline-flex h-14 w-fit items-center justify-center gap-2 bg-site-accent px-6 text-[14px] font-extrabold uppercase tracking-[0.07em] text-white",
    hours: "border-t-2 border-site-ink",
    hoursHead: "py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7682]",
    row: "border-b border-site-line py-3 text-[15px] font-semibold",
  },
  trust: {
    // Side by side from @4xl: at a 768px container the card's column left the map ~217px wide.
    grid: "@4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] @4xl:gap-6",
    map: "rounded-[12px] border border-site-line aspect-[4/3] @4xl:order-2 @4xl:aspect-auto @4xl:min-h-[320px]",
    card: "flex flex-col gap-4 rounded-[12px] border border-site-line bg-white p-5 @3xl:p-6",
    label: "font-site-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-muted",
    address: "text-[17px] leading-[1.5] font-semibold",
    link: "inline-flex h-11 w-fit items-center justify-center gap-2 rounded-[8px] border-[1.5px] border-site-ink px-4 text-[14px] font-semibold",
    hours: "border-t border-site-line pt-1",
    hoursHead: "py-2 font-site-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-muted",
    row: "border-b border-site-line py-3 text-[14px] last:border-0",
  },
  bright: {
    grid: "@3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @3xl:gap-6",
    map: "rounded-[20px] border border-site-line aspect-[4/3] @3xl:aspect-auto @3xl:min-h-[340px]",
    card: "flex flex-col gap-4 rounded-[20px] bg-[#E8F5FA] p-6 @3xl:p-8",
    label: "text-[13.5px] font-bold text-[#2C5468]",
    address: "text-[18px] leading-[1.5] font-bold",
    link: "inline-flex h-12 w-fit items-center justify-center gap-2 rounded-[14px] bg-site-accent px-5 text-[15px] font-bold text-white",
    hours: "rounded-[16px] bg-white px-5 py-2",
    hoursHead: "py-2 text-[13.5px] font-bold",
    row: "border-t border-[#EDE7DA] py-3 text-[14.5px]",
  },
};

/**
 * Location: address card with a real "Open in Google Maps" destination, plus a
 * keyless Google Maps embed for the same place wherever the renderer allows
 * maps (the published site and the owner's ready/editor previews; not the
 * landing mockups). Without a location there is no map box at all.
 */
export function Location({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"location"> }) {
  const { site, strings, maps, target, rel, template } = ctx;
  const look = LOOK[template];
  const place = resolveLocation(section, site.business);
  const hours = section.hours ?? [];
  if (!place && !hours.length && !section.note) return null;
  const embed = maps && place ? place : null;

  const map = embed ? (
    <div data-site-map-frame className={cn("relative min-w-0 overflow-hidden bg-site-line", look.map)}>
      <MapFrame src={embed.embedSrc} title={`${strings.location}: ${embed.query}`} />
    </div>
  ) : null;

  const info = (
    <div className={cn("min-w-0", look.card)}>
      {place ? (
        <div className="flex min-w-0 flex-col gap-2">
          <span className={look.label}>{place.precise ? strings.visit : <span>{strings.area}</span>}</span>
          <p className={cn("break-words [overflow-wrap:anywhere]", look.address)}>{place.label}</p>
          <a href={place.href} target={target} rel={rel} className={cn("mt-2", look.link)}>
            <Icon name="near_me" size={18} />
            {strings.openMaps}
          </a>
        </div>
      ) : null}
      {hours.length ? (
        <div className={look.hours}>
          <h3 className={look.hoursHead}>{strings.hours}</h3>
          <dl>
            {hours.map((row) => (
              <div key={row.id} className={cn("flex justify-between gap-4", look.row)}>
                <dt className="min-w-0 font-semibold [overflow-wrap:anywhere]">{row.days}</dt>
                <dd className={cn("text-right", template === "trust" ? "font-site-mono text-[13px]" : "text-site-muted")}>{row.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {section.note ? <p className="text-[14px] leading-[1.55] text-site-muted [overflow-wrap:anywhere]">{section.note}</p> : null}
    </div>
  );

  const head = <SectionHead ctx={ctx} id={section.id} kicker={strings.location} title={section.title ?? strings.location} />;
  const body = map ? (
    <div className={cn("grid gap-6", look.grid)}>
      {map}
      {info}
    </div>
  ) : (
    <div className={cn(template !== "trust" && "max-w-[560px]")}>{info}</div>
  );

  if (template === "trust") {
    return (
      <Section ctx={ctx} id={section.id} head={head}>
        {body}
      </Section>
    );
  }
  return (
    <Section ctx={ctx} id={section.id}>
      <div className="flex flex-col gap-8 @3xl:gap-12">
        {head}
        {body}
      </div>
    </Section>
  );
}
