import { Icon } from "@/components/ui/Icon";
import { mapsEmbedUrl, mapsUrl } from "@/lib/site/links";
import type { SectionOf } from "@/lib/site/schema";
import { card, Section, SectionTitle } from "../Section";
import { tint, type RenderCtx } from "../context";

export function Location({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"location"> }) {
  const { site, strings, mode } = ctx;
  const address = section.address ?? site.business.address;
  const query = address ?? section.mapsQuery;
  const hours = section.hours ?? [];
  if (!query && !hours.length && !section.note) return null;
  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx}>{section.title ?? strings.location}</SectionTitle>
      <div className="grid gap-4 @3xl:grid-cols-2 @3xl:gap-8">
        {query ? (
          <div className="flex flex-col gap-3">
            <div className={`${card} relative aspect-[4/3] overflow-hidden @3xl:aspect-[16/10]`}>
              {mode === "public" ? (
                <iframe
                  src={mapsEmbedUrl(query)}
                  title={`${strings.location}: ${query}`}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-site-muted" style={{ background: tint(8) }}>
                  <Icon name="map" size={34} className="text-site-accent opacity-60" />
                  <span className="text-[12px] font-semibold">Google Maps</span>
                </div>
              )}
            </div>
            {address ? <p className="text-[15px] leading-[1.5]">{address}</p> : null}
            <a
              href={mapsUrl(query)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 self-start rounded-pill border-[1.5px] border-site-ink px-5 text-[14px] font-bold text-site-ink"
            >
              <Icon name="near_me" size={18} />
              {strings.openMaps}
            </a>
          </div>
        ) : null}
        {hours.length || section.note ? (
          <div className="flex flex-col gap-3">
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
