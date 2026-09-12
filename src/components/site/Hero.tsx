import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { HERO_POSITION_CLASS, resolveHero, type ResolvedHero } from "@/lib/site/hero";
import type { SectionOf, SiteImage as SiteImageData } from "@/lib/site/schema";
import { findSection, headingClass, tint, type RenderCtx } from "./context";
import { ProfilePhoto } from "./ProfilePhoto";
import { SiteImage } from "./SiteImage";

type HeroSection = SectionOf<"hero">;
const HERO_SIZES = "(max-width: 768px) 100vw, 1120px";
const SPLIT_SIZES = "(max-width: 768px) 100vw, 560px";

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);

/** Does the headline already say who this is, i.e. contain their first name as a whole word? */
export function headlineNames(headline: string, name: string): boolean {
  const nameWords = words(name);
  const first = nameWords.find((w) => w.length >= 3) ?? nameWords[0];
  return Boolean(first) && words(headline).includes(first);
}

/**
 * Does the hero render its own buttons? Bold heroes always did; the person,
 * service and property layouts do too, so the renderer skips the full-width
 * button under the hero for them.
 */
export function heroIncludesCta(ctx: RenderCtx, section: HeroSection): boolean {
  return ctx.preset.heroDark || resolveHero(ctx.site, section).mode !== "visual";
}

/** The cover photo, cropped to its container with the owner's chosen focal edge. */
function Cover({ image, hero, sizes, className }: { image: SiteImageData; hero: ResolvedHero; sizes: string; className?: string }) {
  return <SiteImage image={image} sizes={sizes} priority marker="cover" className={cn(HERO_POSITION_CLASS[hero.position], className)} />;
}

/**
 * Person-led sites: the owner's photo above the copy, with their name and
 * tagline when the headline doesn't already say who they are.
 */
function HeroIdentity({
  ctx,
  section,
  light,
  center,
  overlap,
}: {
  ctx: RenderCtx;
  section: HeroSection;
  light: boolean;
  center?: boolean;
  /** Pull the photo up over the cover's bottom edge on small screens. */
  overlap?: boolean;
}) {
  const { business } = ctx.site;
  const photo = ctx.category.personLed ? business.profilePhoto : undefined;
  if (!photo) return null;
  const name = business.name.trim();
  const named = headlineNames(section.headline, name);
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        center && "flex-col text-center @3xl:flex-row @3xl:text-left",
        overlap ? "-mt-12 items-end @3xl:mt-0 @3xl:items-center" : "mb-2",
      )}
    >
      <span className={cn("shrink-0 rounded-full", overlap && (light ? "bg-site-ink p-[3px] @3xl:bg-transparent @3xl:p-0" : "bg-site-ground p-[3px] @3xl:bg-transparent @3xl:p-0"))}>
        <ProfilePhoto
          image={photo}
          name={name}
          size={88}
          priority
          className={cn(light ? "ring-white/80" : "ring-white shadow-[0_6px_20px_rgba(0,0,0,0.12)]")}
        />
      </span>
      {!named ? (
        <div className={cn("flex min-w-0 flex-col", overlap && "pb-1 @3xl:pb-0")}>
          <span className={cn("text-[17px] font-bold leading-[1.25]", light ? "text-white" : "text-site-ink")}>{name}</span>
          {business.tagline ? (
            <span className={cn("text-[14px] leading-[1.4]", light ? "text-white/85" : "text-site-muted")}>{business.tagline}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Kicker + headline + subheadline, in light (on photo/dark) or ink (on ground). */
function HeroCopy({
  ctx,
  section,
  light,
  center,
  identity = true,
}: {
  ctx: RenderCtx;
  section: HeroSection;
  light: boolean;
  center?: boolean;
  identity?: boolean;
}) {
  const kicker = section.badge ?? ctx.site.business.area;
  const bold = ctx.preset.heroDark;
  return (
    <div className={cn("flex flex-col gap-2", center && "items-center text-center @3xl:items-start @3xl:text-left")}>
      {identity ? <HeroIdentity ctx={ctx} section={section} light={light} center={center} /> : null}
      {kicker ? (
        <span
          className={cn("text-[12px] font-bold uppercase tracking-[0.12em]", light && !bold ? "text-white/85" : !light ? "text-site-accent" : undefined)}
          style={bold ? { color: "color-mix(in srgb, var(--site-accent) 55%, white)" } : undefined}
        >
          {kicker}
        </span>
      ) : null}
      <h1
        className={cn(
          headingClass(ctx.preset),
          "text-[40px] leading-[1.02] tracking-[-0.02em] @3xl:text-[56px]",
          light ? "text-white" : "text-site-ink",
        )}
      >
        {section.headline}
      </h1>
      {section.subheadline ? (
        <p className={cn("max-w-[52ch] text-[15px] leading-[1.5] @3xl:text-[18px]", light ? "text-white/90" : "text-site-muted")}>{section.subheadline}</p>
      ) : null}
    </div>
  );
}

const button = "flex h-[54px] items-center justify-center gap-[10px] rounded-pill px-6 text-[16px] font-bold";

/** Primary CTA plus one secondary (WhatsApp, or Call when there is no WhatsApp). */
function HeroButtons({ ctx, light }: { ctx: RenderCtx; light: boolean }) {
  const { primary, chat, call, strings, target, rel } = ctx;
  const secondary: { href: string; label: string; green: boolean; icon: IconName } | null =
    chat && !primary.green
      ? { href: chat, label: strings.chat, green: true, icon: "chat" }
      : !chat && call
        ? { href: call, label: strings.call, green: false, icon: "call" }
        : null;
  if (!primary.href && !secondary) return null;
  return (
    <div className="flex flex-col gap-[10px] @md:flex-row @md:flex-wrap" data-hero-cta>
      {primary.href ? (
        <a href={primary.href} target={target} rel={rel} className={cn(button, "text-white", primary.green ? "bg-whatsapp" : "bg-site-accent")}>
          <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />
          {primary.label}
        </a>
      ) : null}
      {secondary ? (
        <a
          href={secondary.href}
          target={target}
          rel={rel}
          className={cn(
            button,
            secondary.green ? "bg-whatsapp text-white" : light ? "border-[1.5px] border-white/80 text-white" : "border-[1.5px] border-site-ink text-site-ink",
          )}
        >
          <Icon name={secondary.icon} size={22} fill={secondary.green} />
          {secondary.label}
        </a>
      ) : null}
    </div>
  );
}

const darkFade = { background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, color-mix(in srgb, var(--site-ink) 88%, transparent) 100%)" };

/** Warm: full-bleed photo with copy on a dark gradient. */
function HeroWarm({ ctx, section, hero, image }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero; image: SiteImageData }) {
  return (
    <div className="relative" data-hero-mode="visual">
      <div className="relative aspect-[4/5] max-h-[560px] min-h-[420px] w-full overflow-hidden @3xl:aspect-auto @3xl:h-[560px]">
        <Cover image={image} hero={hero} sizes={HERO_SIZES} />
        <div className="absolute inset-0" style={darkFade} />
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-6 @3xl:px-8 @3xl:pb-12">
          <div className="max-w-[640px]">
            <HeroCopy ctx={ctx} section={section} light />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Elegant: photo fades into the ground, copy sits below in ink. */
function HeroElegant({ ctx, section, hero, image }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero; image: SiteImageData }) {
  return (
    <div className="@3xl:mx-auto @3xl:grid @3xl:w-full @3xl:max-w-[1120px] @3xl:grid-cols-2 @3xl:items-center @3xl:gap-12 @3xl:px-8 @3xl:py-12" data-hero-mode="visual">
      <div className="relative aspect-[4/5] max-h-[560px] w-full overflow-hidden @3xl:order-2 @3xl:max-h-[600px] @3xl:rounded-[24px]">
        <Cover image={image} hero={hero} sizes={HERO_SIZES} />
        <div className="absolute inset-0 @3xl:hidden" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, var(--site-ground) 100%)" }} />
      </div>
      <div className="relative -mt-20 px-5 @3xl:order-1 @3xl:mt-0 @3xl:px-0">
        <HeroCopy ctx={ctx} section={section} light={false} center />
      </div>
    </div>
  );
}

/** Trust / bright: inset rounded photo card. */
function HeroCard({ ctx, section, hero, image }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero; image: SiteImageData }) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-3 @3xl:px-8 @3xl:pt-6" data-hero-mode="visual">
      <div className="relative aspect-[4/5] max-h-[520px] min-h-[400px] w-full overflow-hidden rounded-[24px] @3xl:aspect-[21/9] @3xl:max-h-[480px] @3xl:min-h-0">
        <Cover image={image} hero={hero} sizes={HERO_SIZES} />
        <div className="absolute inset-0" style={darkFade} />
        <div className="absolute inset-x-0 bottom-0 p-5 @3xl:p-10">
          <div className="max-w-[640px]">
            <HeroCopy ctx={ctx} section={section} light />
          </div>
        </div>
      </div>
    </div>
  );
}

/** No photo yet: accent-tinted block with a faint category glyph. */
function HeroPlain({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  return (
    <div className="relative overflow-hidden" style={{ background: tint(12) }} data-hero-mode="visual">
      <Icon name={ctx.category.icon} size={180} className="pointer-events-none absolute -top-6 -right-8 text-site-accent opacity-[.08] @3xl:right-8" />
      <div className="relative mx-auto w-full max-w-[1120px] px-5 pt-10 pb-9 @3xl:px-8 @3xl:pt-16 @3xl:pb-14">
        <div className="max-w-[640px]">
          <HeroCopy ctx={ctx} section={section} light={false} />
        </div>
      </div>
    </div>
  );
}

/** Bold: dark hero with the photo in a grid and the buttons inside. */
function HeroBold({ ctx, section, hero, image }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero; image?: SiteImageData }) {
  return (
    <div className="bg-site-ink text-white" data-hero-mode="visual">
      <div className="mx-auto grid w-full max-w-[1120px] gap-5 px-4 pt-4 pb-7 @3xl:grid-cols-[1.1fr_1fr] @3xl:items-center @3xl:gap-12 @3xl:px-8 @3xl:py-14">
        {image ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] @3xl:order-2">
            <Cover image={image} hero={hero} sizes={SPLIT_SIZES} />
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-5 @3xl:order-1", !image && "pt-6 @3xl:col-span-2 @3xl:max-w-[720px]")}>
          <HeroCopy ctx={ctx} section={section} light />
          <HeroButtons ctx={ctx} light />
        </div>
      </div>
    </div>
  );
}

/** Up to three short proof points for the service layout, taken from the site's own content. */
function trustPoints(ctx: RenderCtx): string[] {
  const highlights = findSection(ctx.site, "highlights");
  if (highlights?.items.length) return highlights.items.slice(0, 3).map((item) => item.title);
  const about = findSection(ctx.site, "about");
  return (about?.highlights ?? []).filter(Boolean).slice(0, 3);
}

/**
 * Person / service / property layouts share one composition: the cover on
 * top (beside the copy on desktop, never behind it), then who or what this
 * is, the headline and the buttons. Without a cover the copy sits on an
 * accent-tinted ground with the category glyph, so nothing is ever blank.
 */
function HeroSplit({ ctx, section, hero }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero }) {
  const { business } = ctx.site;
  const dark = ctx.preset.heroDark;
  const image = hero.image;
  const showPerson = hero.mode !== "service";
  const trust = hero.mode === "service" ? trustPoints(ctx) : [];
  const place = hero.mode === "property" ? business.area ?? business.address : undefined;
  const chip = dark ? "border-white/25 text-white" : "border-site-line bg-white/70 text-site-ink";
  /** The photo pulls up over the cover's bottom edge, so the column needs no top padding. */
  const overlapPhoto = showPerson && Boolean(image) && ctx.category.personLed && Boolean(business.profilePhoto);

  return (
    <div className={cn("relative overflow-hidden", dark && "bg-site-ink text-white")} style={!dark && !image ? { background: tint(12) } : undefined} data-hero-mode={hero.mode}>
      {!image ? (
        <Icon
          name={ctx.category.icon}
          size={180}
          className={cn("pointer-events-none absolute -top-6 -right-8 opacity-[.08] @3xl:right-8", dark ? "text-white" : "text-site-accent")}
        />
      ) : null}
      <div
        className={cn(
          "relative mx-auto grid w-full max-w-[1120px] @3xl:items-center @3xl:gap-12 @3xl:px-8",
          image ? "@3xl:grid-cols-[1.1fr_1fr] @3xl:py-14" : "@3xl:py-16",
        )}
      >
        {image ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden @3xl:order-2 @3xl:aspect-[4/3] @3xl:rounded-[24px]">
            <Cover image={image} hero={hero} sizes={SPLIT_SIZES} />
          </div>
        ) : null}
        <div
          className={cn(
            "relative flex flex-col gap-4 px-4 pb-7 @3xl:order-1 @3xl:px-0 @3xl:pt-0 @3xl:pb-0",
            !image ? "pt-10 @3xl:max-w-[720px]" : overlapPhoto ? "pt-0" : "pt-5",
          )}
        >
          {showPerson ? <HeroIdentity ctx={ctx} section={section} light={dark} overlap={overlapPhoto} /> : null}
          <HeroCopy ctx={ctx} section={section} light={dark} identity={false} />
          {trust.length ? (
            <ul className="flex flex-wrap gap-2" aria-label={ctx.strings.about}>
              {trust.map((text) => (
                <li key={text} className={cn("inline-flex h-9 items-center gap-[6px] rounded-pill border-[1.5px] px-3 text-[13px] font-semibold", chip)}>
                  <Icon name="check_circle" size={16} fill className={dark ? "text-white" : "text-site-accent"} />
                  {text}
                </li>
              ))}
            </ul>
          ) : null}
          {place ? (
            <p className={cn("flex items-center gap-[6px] text-[14px] font-semibold", dark ? "text-white/85" : "text-site-ink")}>
              <Icon name="location_on" size={18} fill className={dark ? "text-white" : "text-site-accent"} />
              <span className="line-clamp-1">{place}</span>
            </p>
          ) : null}
          <HeroButtons ctx={ctx} light={dark} />
        </div>
      </div>
    </div>
  );
}

export function Hero({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  const hero = resolveHero(ctx.site, section);
  if (hero.mode !== "visual") return <HeroSplit ctx={ctx} section={section} hero={hero} />;
  if (ctx.preset.heroDark) return <HeroBold ctx={ctx} section={section} hero={hero} image={hero.image} />;
  if (!hero.image) return <HeroPlain ctx={ctx} section={section} />;
  switch (ctx.preset.id) {
    case "warm":
      return <HeroWarm ctx={ctx} section={section} hero={hero} image={hero.image} />;
    case "elegant":
      return <HeroElegant ctx={ctx} section={section} hero={hero} image={hero.image} />;
    default:
      return <HeroCard ctx={ctx} section={section} hero={hero} image={hero.image} />;
  }
}
