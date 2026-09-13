import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { HERO_POSITION_CLASS, resolveHero, type HeroFrame, type ResolvedHero } from "@/lib/site/hero";
import type { SectionOf, SiteImage as SiteImageData } from "@/lib/site/schema";
import { findSection, headingClass, tint, type RenderCtx } from "./context";
import { ProfilePhoto } from "./ProfilePhoto";
import { SiteImage } from "./SiteImage";

type HeroSection = SectionOf<"hero">;

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);

/** Does the headline already say who this is, i.e. contain their first name as a whole word? */
export function headlineNames(headline: string, name: string): boolean {
  const nameWords = words(name);
  const first = nameWords.find((w) => w.length >= 3) ?? nameWords[0];
  return Boolean(first) && words(headline).includes(first);
}

/**
 * Copy colours as CSS variables, so one DOM can read white over the photo on
 * phones and ink beside it on desktop (or the other way round) without hooks.
 * `light` is for copy on the photo, `ink` for the light ground, `bold` for the
 * bold preset's dark ground (its kicker is the accent lifted towards white).
 */
const TONE = {
  light: "[--hero-fg:#fff] [--hero-soft:rgba(255,255,255,0.88)] [--hero-kicker:rgba(255,255,255,0.85)]",
  ink: "[--hero-fg:var(--site-ink)] [--hero-soft:var(--site-muted)] [--hero-kicker:var(--site-accent)]",
  bold: "[--hero-fg:#fff] [--hero-soft:rgba(255,255,255,0.88)] [--hero-kicker:color-mix(in_srgb,var(--site-accent)_55%,white)]",
  lightDesktop: "@3xl:[--hero-fg:#fff] @3xl:[--hero-soft:rgba(255,255,255,0.88)] @3xl:[--hero-kicker:rgba(255,255,255,0.85)]",
  inkDesktop: "@3xl:[--hero-fg:var(--site-ink)] @3xl:[--hero-soft:var(--site-muted)] @3xl:[--hero-kicker:var(--site-accent)]",
  boldDesktop: "@3xl:[--hero-fg:#fff] @3xl:[--hero-soft:rgba(255,255,255,0.88)] @3xl:[--hero-kicker:color-mix(in_srgb,var(--site-accent)_55%,white)]",
} as const;

/** The copy sits on the photo → light; on the bold preset's ink → bold; on the light ground → ink. */
const toneFor = (onPhoto: boolean, dark: boolean, desktop: boolean) =>
  onPhoto ? (desktop ? TONE.lightDesktop : TONE.light) : dark ? (desktop ? TONE.boldDesktop : TONE.bold) : desktop ? TONE.inkDesktop : TONE.ink;

/** Height caps so a hero can never run past the first screen, whatever the photo's shape. */
const MOBILE_MAX_H = "max-h-[min(88svh,760px)]";
const DESKTOP_MAX_H = "@3xl:max-h-[min(72svh,640px)]";

const HERO_SIZES: Record<HeroFrame["desktop"], string> = {
  overlay: "100vw",
  split: "(max-width: 768px) 100vw, 640px",
};

/** The cover photo filling its frame; the owner's focal edge only matters when a frame bound crops it. */
function Cover({ image, hero, sizes }: { image: SiteImageData; hero: ResolvedHero; sizes: string }) {
  return <SiteImage image={image} sizes={sizes} priority marker="cover" className={HERO_POSITION_CLASS[hero.position]} />;
}

/**
 * Person-led sites: the owner's photo above the copy, with their name and
 * tagline when the headline doesn't already say who they are.
 */
function HeroIdentity({
  ctx,
  section,
  center,
  overlap,
}: {
  ctx: RenderCtx;
  section: HeroSection;
  center?: boolean;
  /** Pull the photo up over the cover's bottom edge on small screens. */
  overlap?: boolean;
}) {
  const { business } = ctx.site;
  const photo = ctx.category.personLed ? business.profilePhoto : undefined;
  if (!photo) return null;
  const name = business.name.trim();
  const named = headlineNames(section.headline, name);
  const dark = ctx.preset.heroDark;
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        center && "flex-col text-center @3xl:flex-row @3xl:text-left",
        overlap ? "-mt-12 items-end @3xl:mt-0 @3xl:items-center" : "mb-2",
      )}
    >
      <span className={cn("shrink-0 rounded-full", overlap && (dark ? "bg-site-ink p-[3px] @3xl:bg-transparent @3xl:p-0" : "bg-site-ground p-[3px] @3xl:bg-transparent @3xl:p-0"))}>
        <ProfilePhoto image={photo} name={name} size={88} priority className="ring-white shadow-[0_6px_20px_rgba(0,0,0,0.12)]" />
      </span>
      {!named ? (
        <div className={cn("flex min-w-0 flex-col", overlap && "pb-1 @3xl:pb-0")}>
          <span className="text-[17px] font-bold leading-[1.25] text-(--hero-fg)">{name}</span>
          {business.tagline ? <span className="text-[14px] leading-[1.4] text-(--hero-soft)">{business.tagline}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Kicker + headline + subheadline in the current tone (see TONE). */
function HeroCopy({ ctx, section, center, identity = true }: { ctx: RenderCtx; section: HeroSection; center?: boolean; identity?: boolean }) {
  const kicker = section.badge ?? ctx.site.business.area;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", center && "items-center text-center @3xl:items-start @3xl:text-left")}>
      {identity ? <HeroIdentity ctx={ctx} section={section} center={center} /> : null}
      {kicker ? <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-(--hero-kicker)">{kicker}</span> : null}
      <h1
        className={cn(
          headingClass(ctx.preset),
          "text-[40px] leading-[1.02] tracking-[-0.02em] text-(--hero-fg) [overflow-wrap:anywhere] @3xl:text-[56px]",
        )}
      >
        {section.headline}
      </h1>
      {section.subheadline ? <p className="max-w-[52ch] text-[15px] leading-[1.5] text-(--hero-soft) @3xl:text-[18px]">{section.subheadline}</p> : null}
    </div>
  );
}

const button = "flex h-[54px] items-center justify-center gap-[10px] rounded-pill px-6 text-[16px] font-bold";

/** Primary CTA plus one secondary (WhatsApp, or Call when there is no WhatsApp). */
function HeroButtons({ ctx, className }: { ctx: RenderCtx; className?: string }) {
  const { primary, chat, call, strings, target, rel } = ctx;
  const secondary: { href: string; label: string; green: boolean; icon: IconName } | null =
    chat && !primary.green
      ? { href: chat, label: strings.chat, green: true, icon: "chat" }
      : !chat && call
        ? { href: call, label: strings.call, green: false, icon: "call" }
        : null;
  if (!primary.href && !secondary) return null;
  return (
    <div className={cn("flex flex-col gap-[10px] @md:flex-row @md:flex-wrap", className)} data-hero-cta>
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
          className={cn(button, secondary.green ? "bg-whatsapp text-white" : "border-[1.5px] border-(--hero-fg) text-(--hero-fg)")}
        >
          <Icon name={secondary.icon} size={22} fill={secondary.green} />
          {secondary.label}
        </a>
      ) : null}
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

/** What each mode adds around the headline: the person, the service's proof points, the property's area. */
function modeExtras(ctx: RenderCtx, hero: ResolvedHero) {
  const { business } = ctx.site;
  return {
    showPerson: hero.mode !== "service",
    trust: hero.mode === "service" ? trustPoints(ctx) : [],
    place: hero.mode === "property" ? (business.area ?? business.address) : undefined,
  };
}

function ModeExtras({ ctx, trust, place }: { ctx: RenderCtx; trust: string[]; place?: string }) {
  const dark = ctx.preset.heroDark;
  const chip = dark ? "border-white/25 text-white" : "border-site-line bg-white/70 text-site-ink";
  return (
    <>
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
        <p className="flex items-center gap-[6px] text-[14px] font-semibold text-(--hero-fg)">
          <Icon name="location_on" size={18} fill className={dark ? "text-white" : "text-site-accent"} />
          <span className="line-clamp-1">{place}</span>
        </p>
      ) : null}
    </>
  );
}

/**
 * Only the lower part of the photo is shaded, and only where copy sits on it,
 * so the picture itself is never dimmed: clear for the top quarter, then a
 * soft ramp into the site's ink behind the text.
 */
const fade = {
  background:
    "linear-gradient(180deg, rgba(0,0,0,0) 28%, color-mix(in srgb, var(--site-ink) 42%, transparent) 62%, color-mix(in srgb, var(--site-ink) 88%, transparent) 100%)",
};

/**
 * The cover photo as the hero. One grid, three items (frame, copy, buttons)
 * placed differently per breakpoint from the photo's own shape (see
 * heroFrameOf): the frame takes the photo's aspect ratio, so nothing is
 * cropped unless a height cap or a frame bound forces it, and then the owner's
 * focal edge decides what stays.
 *
 * Phones: rows [1fr auto auto]. "overlay" spans the frame over rows 1–2 with
 * the copy in row 2 (over the photo's lower part, buttons under the photo);
 * "stack" keeps the frame in row 1 and the copy below it.
 * Desktop: "overlay" spans the frame over all three rows full-width, copy and
 * buttons at the bottom left; "split" puts the whole photo in a second column
 * (height-capped, width follows) with the copy centred beside it.
 */
function HeroPhoto({ ctx, section, hero, image, frame }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero; image: SiteImageData; frame: HeroFrame }) {
  const { business } = ctx.site;
  const dark = ctx.preset.heroDark;
  const overlayM = frame.mobile === "overlay";
  const overlayD = frame.desktop === "overlay";
  const { showPerson, trust, place } = modeExtras(ctx, hero);
  /** Stacked person hero: the round photo pulls up over the cover's bottom edge, so the copy needs no top padding. */
  const overlapPhoto = !overlayM && showPerson && ctx.category.personLed && Boolean(business.profilePhoto);
  const gutter = "mx-auto w-full max-w-[1120px] px-4 @3xl:px-8";
  const vars = { "--hero-ratio-m": frame.mobileRatio, "--hero-ratio-d": frame.desktopRatio } as CSSProperties;

  return (
    <div
      className={cn("relative w-full", dark && "bg-site-ink text-white")}
      data-hero-mode={hero.mode}
      data-hero-shape={frame.shape}
      data-hero-layout={`${frame.mobile}/${frame.desktop}`}
    >
      <div
        className={cn(
          "grid w-full grid-cols-1 grid-rows-[1fr_auto_auto]",
          overlayD
            ? "@3xl:grid-rows-[1fr_auto_auto]"
            : "@3xl:mx-auto @3xl:max-w-[1120px] @3xl:grid-cols-[1fr_1fr] @3xl:grid-rows-[1fr_auto_auto_1fr] @3xl:gap-x-12 @3xl:px-8 @3xl:py-12",
        )}
      >
        <div
          className={cn(
            "relative col-start-1 row-start-1 w-full overflow-hidden aspect-(--hero-ratio-m) @3xl:aspect-(--hero-ratio-d)",
            MOBILE_MAX_H,
            DESKTOP_MAX_H,
            overlayM ? "row-span-2" : "row-span-1",
            overlayD
              ? "@3xl:col-start-1 @3xl:row-start-1 @3xl:row-span-3 @3xl:min-h-[420px]"
              : "@3xl:col-start-2 @3xl:row-start-1 @3xl:row-span-4 @3xl:max-w-[calc(min(72svh,640px)*var(--hero-ratio-d))] @3xl:self-center @3xl:justify-self-center @3xl:rounded-[24px]",
          )}
          style={dark ? vars : { ...vars, background: tint(12) }}
        >
          <Cover image={image} hero={hero} sizes={HERO_SIZES[frame.desktop]} />
          {overlayM || overlayD ? (
            <div aria-hidden className={cn("absolute inset-0", overlayM && !overlayD && "@3xl:hidden", !overlayM && overlayD && "hidden @3xl:block")} style={fade} />
          ) : null}
        </div>
        <div
          className={cn(
            "relative z-10 col-start-1 row-start-2 flex min-w-0 flex-col gap-4",
            gutter,
            overlayM ? "pt-16 pb-5" : overlapPhoto ? "pt-0" : "pt-5",
            overlayD ? "@3xl:pt-24 @3xl:pb-0" : "@3xl:max-w-none @3xl:px-0 @3xl:pt-0",
            toneFor(overlayM, dark, false),
            toneFor(overlayD, dark, true),
          )}
        >
          <div className={cn("flex flex-col gap-4", overlayD && "@3xl:max-w-[640px]")}>
            {showPerson ? <HeroIdentity ctx={ctx} section={section} overlap={overlapPhoto} /> : null}
            <HeroCopy ctx={ctx} section={section} identity={false} />
            <ModeExtras ctx={ctx} trust={trust} place={place} />
          </div>
        </div>
        <div
          className={cn(
            "relative z-10 col-start-1 row-start-3 pt-4 pb-6",
            gutter,
            overlayD ? "@3xl:pt-5 @3xl:pb-12" : "@3xl:max-w-none @3xl:px-0 @3xl:pt-5 @3xl:pb-0",
            toneFor(overlayM, dark, false),
            toneFor(overlayD, dark, true),
          )}
        >
          <HeroButtons ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

/**
 * No photo yet: the copy on an accent-tinted ground (the bold preset's ink)
 * with a faint category glyph, so a brand-new site never shows an empty box.
 */
function HeroNoPhoto({ ctx, section, hero }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero }) {
  const dark = ctx.preset.heroDark;
  const { showPerson, trust, place } = modeExtras(ctx, hero);
  return (
    <div className={cn("relative overflow-hidden", dark && "bg-site-ink text-white", dark ? TONE.bold : TONE.ink)} style={!dark ? { background: tint(12) } : undefined} data-hero-mode={hero.mode}>
      <Icon name={ctx.category.icon} size={180} className={cn("pointer-events-none absolute -top-6 -right-8 opacity-[.08] @3xl:right-8", dark ? "text-white" : "text-site-accent")} />
      <div className="relative mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 pt-10 pb-8 @3xl:px-8 @3xl:pt-16 @3xl:pb-14">
        <div className="flex max-w-[720px] flex-col gap-4">
          {showPerson ? <HeroIdentity ctx={ctx} section={section} /> : null}
          <HeroCopy ctx={ctx} section={section} identity={false} />
          <ModeExtras ctx={ctx} trust={trust} place={place} />
        </div>
        <HeroButtons ctx={ctx} className="pt-1" />
      </div>
    </div>
  );
}

export function Hero({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  const hero = resolveHero(ctx.site, section);
  if (hero.image && hero.frame) return <HeroPhoto ctx={ctx} section={section} hero={hero} image={hero.image} frame={hero.frame} />;
  return <HeroNoPhoto ctx={ctx} section={section} hero={hero} />;
}
