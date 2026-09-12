import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { resolveLocation } from "@/lib/site/location";
import type { SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import { tint, type RenderCtx } from "../context";

/**
 * Location: address card with a real "Open in Google Maps" destination, plus a
 * keyless Google Maps embed on the published site. Previews (ready screen,
 * editor, landing mockup) show the card only — never an empty map box.
 */
export function Location({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"location"> }) {
  const { site, strings, mode, target, rel } = ctx;
  const place = resolveLocation(section, site.business);
  const hours = section.hours ?? [];
  if (!place && !hours.length && !section.note) return null;
  const embed = mode === "public" && Boolean(place);
  const twoColumns = Boolean(place) && (hours.length > 0 || Boolean(section.note));
  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx}>{section.title ?? strings.location}</SectionTitle>
      <div className={cn("grid gap-4 @3xl:gap-8", twoColumns && "@3xl:grid-cols-2")}>
        {place ? (
          <div className="flex min-w-0 flex-col gap-3">
            {embed ? (
              <div className={`${card} relative aspect-[4/3] overflow-hidden @3xl:aspect-[16/10]`}>
                <iframe
                  src={place.embedSrc}
                  title={`${strings.location}: ${place.query}`}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            ) : null}
            <div className={`${card} flex min-w-0 flex-col gap-4 p-4 @md:flex-row @md:items-center @md:justify-between @md:gap-5 @md:p-5`}>
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-site-accent"
                  style={{ background: tint(12) }}
                  aria-hidden
                >
                  <Icon name="location_on" size={24} fill />
                </span>
                <div className="flex min-w-0 flex-col gap-[2px]">
                  {!place.precise ? (
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-site-muted">{strings.area}</span>
                  ) : null}
                  <p className="text-[15px] leading-[1.5] break-words [overflow-wrap:anywhere] @3xl:text-[16px]">{place.label}</p>
                </div>
              </div>
              <a
                href={place.href}
                target={target}
                rel={rel}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill border-[1.5px] border-site-ink px-5 text-[14px] font-bold text-site-ink"
              >
                <Icon name="near_me" size={18} />
                {strings.openMaps}
              </a>
            </div>
          </div>
        ) : null}
        {hours.length || section.note ? (
          <div className="flex min-w-0 flex-col gap-3">
            {hours.length ? (
              <div className={`${card} px-4 py-2`}>
                <h3 className="py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-site-muted">{strings.hours}</h3>
                <dl>
                  {hours.map((row) => (
                    <div key={row.id} className="flex justify-between gap-4 border-t border-site-line py-[10px] text-[14px]">
                      <dt className="font-semibold">{row.days}</dt>
                      <dd className="text-right text-site-muted">{row.hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {section.note ? <p className="text-[13px] leading-[1.5] text-site-muted">{section.note}</p> : null}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
