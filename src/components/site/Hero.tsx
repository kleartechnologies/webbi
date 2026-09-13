import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { HERO_POSITION_CLASS, resolveHero, type HeroFrame, type ResolvedHero } from "@/lib/site/hero";
import type { SectionOf, SiteImage as SiteImageData } from "@/lib/site/schema";
import type { TemplateId } from "@/lib/site/templates";
import { buttonClass, findSection, headingClass, ratingOf, type RenderCtx } from "./context";
import { ProfilePhoto } from "./ProfilePhoto";
import { brightTint } from "./skin";
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
 * dark hero ground (its kicker is the accent lifted towards white).
 */
const TONE = {
  light: "[--hero-fg:#fff] [--hero-soft:rgba(255,255,255,0.88)] [--hero-kicker:rgba(255,255,255,0.85)]",
  ink: "[--hero-fg:var(--site-ink)] [--hero-soft:var(--site-muted)] [--hero-kicker:var(--site-accent)]",
  bold: "[--hero-fg:#fff] [--hero-soft:#C3C8D1] [--hero-kicker:var(--site-accent-alt)]",
  lightDesktop: "@3xl:[--hero-fg:#fff] @3xl:[--hero-soft:rgba(255,255,255,0.88)] @3xl:[--hero-kicker:rgba(255,255,255,0.85)]",
  inkDesktop: "@3xl:[--hero-fg:var(--site-ink)] @3xl:[--hero-soft:var(--site-muted)] @3xl:[--hero-kicker:var(--site-accent)]",
  boldDesktop: "@3xl:[--hero-fg:#fff] @3xl:[--hero-soft:#C3C8D1] @3xl:[--hero-kicker:var(--site-accent-alt)]",
} as const;

/** The copy sits on the photo → light; on a dark hero ground → bold; on the light ground → ink. */
const toneFor = (onPhoto: boolean, dark: boolean, desktop: boolean) =>
  onPhoto ? (desktop ? TONE.lightDesktop : TONE.light) : dark ? (desktop ? TONE.boldDesktop : TONE.bold) : desktop ? TONE.inkDesktop : TONE.ink;

/** Height caps so a hero can never run past the first screen, whatever the photo's shape. */
const MOBILE_MAX_H = "max-h-[min(88svh,760px)]";
const DESKTOP_MAX_H = "@3xl:max-h-[min(72svh,640px)]";

const HERO_SIZES: Record<HeroFrame["desktop"], string> = {
  overlay: "100vw",
  split: "(max-width: 768px) 100vw, 640px",
};

/**
 * Each template's hero type and surfaces (from the approved designs). `pad` is
 * the phone gutter; `wide` the desktop width and gutter, kept apart so a split
 * hero can drop the gutter on its cells without conflicting classes.
 */
const LOOK: Record<
  TemplateId,
  { pad: string; wide: string; kicker: string; h1: string; h1Long: string; sub: string; radius: string; ground: string | null; chip: string }
> = {
  warm: {
    pad: "px-5",
    wide: "@3xl:max-w-[1120px] @3xl:px-8",
    kicker: "text-[11px] font-bold uppercase tracking-[0.18em] text-(--hero-kicker) @3xl:text-[12px]",
    h1: "text-[34px] leading-[1.06] @3xl:text-[66px] @3xl:leading-[1.0]",
    h1Long: "text-[30px] leading-[1.1] @3xl:text-[48px] @3xl:leading-[1.05]",
    sub: "text-[16px] leading-[1.55] @3xl:text-[19px]",
    radius: "@3xl:rounded-[4px]",
    ground: "#F3E9DC",
    chip: "rounded-pill border-[1.5px] border-site-line bg-white/70 text-site-ink",
  },
  elegant: {
    pad: "px-5",
    wide: "@3xl:max-w-[1152px] @3xl:px-10",
    kicker: "text-[10px] font-semibold uppercase tracking-[0.24em] text-(--hero-kicker) @3xl:text-[11px]",
    h1: "text-[36px] leading-[1.08] @3xl:text-[60px] @3xl:leading-[1.04]",
    h1Long: "text-[30px] leading-[1.12] @3xl:text-[44px] @3xl:leading-[1.08]",
    sub: "text-[15px] leading-[1.7] @3xl:text-[18px]",
    radius: "",
    ground: "#EFE6E1",
    chip: "rounded-none border border-site-line bg-white/70 text-site-ink",
  },
  bold: {
    pad: "px-5",
    wide: "@3xl:max-w-[1280px] @3xl:px-12 @6xl:px-20",
    kicker:
      "flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-(--hero-kicker) site-wider before:h-[2px] before:w-8 before:shrink-0 before:bg-site-accent before:content-['']",
    h1: "text-[48px] leading-[0.9] @3xl:text-[92px] @3xl:leading-[0.86]",
    h1Long: "text-[34px] leading-[0.94] @3xl:text-[60px] @3xl:leading-[0.92]",
    sub: "text-[16px] font-medium leading-[1.55] @3xl:text-[20px]",
    radius: "",
    ground: null,
    chip: "rounded-none border border-white/25 uppercase tracking-[0.06em] text-white",
  },
  trust: {
    pad: "px-5",
    wide: "@3xl:max-w-[1440px] @3xl:px-10 @6xl:px-20",
    kicker:
      "inline-flex items-center gap-2 font-site-mono text-[11px] font-medium uppercase tracking-[0.14em] text-(--hero-soft) before:h-[7px] before:w-[7px] before:shrink-0 before:rounded-full before:bg-[#6E8B78] before:content-['']",
    h1: "text-[32px] leading-[1.1] tracking-[-0.03em] @3xl:text-[54px] @3xl:leading-[1.04]",
    h1Long: "text-[28px] leading-[1.14] tracking-[-0.02em] @3xl:text-[40px] @3xl:leading-[1.1]",
    sub: "text-[16px] leading-[1.6] @3xl:text-[19px]",
    radius: "@3xl:rounded-[12px]",
    ground: "#DCE8EF",
    chip: "rounded-[8px] border border-site-line bg-white text-site-ink",
  },
  bright: {
    pad: "px-[22px]",
    wide: "@3xl:max-w-[1440px] @3xl:px-12 @6xl:px-[120px]",
    kicker: "inline-flex h-8 w-fit items-center rounded-[10px] bg-[#E8F5FA] px-3 text-[13.5px] font-semibold text-[#2C5468]",
    h1: "text-[36px] leading-[1.08] @3xl:text-[64px] @3xl:leading-[1.02]",
    h1Long: "text-[30px] leading-[1.12] @3xl:text-[46px] @3xl:leading-[1.06]",
    sub: "text-[16px] leading-[1.65] @3xl:text-[19px]",
    radius: "@3xl:rounded-[24px]",
    ground: "#E8F5FA",
    chip: "rounded-[10px]",
  },
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
          <span className={cn("text-[17px] font-bold leading-[1.25] text-(--hero-fg) [overflow-wrap:anywhere]", ctx.template === "bold" && "uppercase site-wide")}>{name}</span>
          {business.tagline ? <span className="text-[14px] leading-[1.4] text-(--hero-soft)">{business.tagline}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Bold sets its last word on a red block; Bright marks its closing words with a highlighter. */
function Headline({ ctx, text }: { ctx: RenderCtx; text: string }) {
  const parts = text.trim().split(/\s+/);
  if (ctx.template === "bold") {
    const last = parts.pop();
    return (
      <>
        {parts.length ? `${parts.join(" ")} ` : null}
        <span className="site-block px-[0.08em] text-white">{last}</span>
      </>
    );
  }
  if (ctx.template === "bright" && parts.length > 1) {
    const marked = parts.splice(parts.length >= 4 ? -2 : -1);
    return (
      <>
        {`${parts.join(" ")} `}
        <span className="site-marker text-site-ink">{marked.join(" ")}</span>
      </>
    );
  }
  return <>{text}</>;
}

/** Kicker + headline + subheadline in the current tone (see TONE). */
function HeroCopy({ ctx, section, compact }: { ctx: RenderCtx; section: HeroSection; compact?: boolean }) {
  const look = LOOK[ctx.template];
  const kicker = section.badge ?? ctx.site.business.area;
  const long = compact || section.headline.length > 48;
  return (
    <div className={cn("flex min-w-0 flex-col", ctx.template === "trust" ? "gap-3" : "gap-3 @3xl:gap-4")}>
      {kicker ? <span className={look.kicker}>{kicker}</span> : null}
      <h1
        className={cn(
          headingClass(ctx.preset),
          long ? look.h1Long : look.h1,
          "text-(--hero-fg) [overflow-wrap:anywhere]",
          ctx.template === "warm" && !long && section.headline.length <= 28 && "@3xl:max-w-[11ch]",
        )}
      >
        <Headline ctx={ctx} text={section.headline} />
      </h1>
      {section.subheadline ? <p className={cn("max-w-[52ch] text-(--hero-soft)", look.sub)}>{section.subheadline}</p> : null}
    </div>
  );
}

/** Primary CTA plus one secondary (WhatsApp, or Call when there is no WhatsApp), in the template's buttons. */
function HeroButtons({ ctx, className }: { ctx: RenderCtx; className?: string }) {
  const { primary, chat, call, strings, target, rel, skin, template } = ctx;
  const secondary: { href: string; label: string; green: boolean; icon: IconName } | null =
    chat && !primary.green
      ? { href: chat, label: strings.chat, green: true, icon: "chat" }
      : !chat && call
        ? { href: call, label: strings.call, green: false, icon: "call" }
        : null;
  if (!primary.href && !secondary) return null;
  const outline = template === "bold" ? "border-2" : template === "elegant" ? "border" : "border-[1.5px]";
  return (
    <div className={cn("flex flex-col gap-[10px] @md:flex-row @md:flex-wrap", className)} data-hero-cta>
      {primary.href ? (
        <a href={primary.href} target={target} rel={rel} className={buttonClass(ctx, "primary", primary.green)}>
          <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />
          {primary.label}
        </a>
      ) : null}
      {secondary ? (
        <a
          href={secondary.href}
          target={target}
          rel={rel}
          className={cn(skin.btn, secondary.green && skin.whatsappGreen ? "bg-whatsapp text-white" : cn(outline, "border-(--hero-fg) text-(--hero-fg)"))}
        >
          <Icon name={secondary.icon} size={22} fill={secondary.green && skin.whatsappGreen} />
          {secondary.label}
        </a>
      ) : null}
    </div>
  );
}

/** Warm and Elegant show the site's own review score under the buttons. */
function HeroRating({ ctx }: { ctx: RenderCtx }) {
  const rating = ctx.template === "warm" || ctx.template === "elegant" ? ratingOf(ctx.site) : null;
  if (!rating) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-[13px] text-(--hero-soft) @3xl:pt-5 @3xl:text-[14px]">
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Icon key={i} name="star" size={15} fill className={ctx.template === "warm" ? "text-[#E8A33C]" : "text-(--hero-kicker)"} />
        ))}
      </span>
      <span className="font-bold text-(--hero-fg)">{rating.average}</span>
      <span>
        · {rating.count} {ctx.strings.reviews.toLowerCase()}
      </span>
    </p>
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
  const look = LOOK[ctx.template];
  const bright = ctx.template === "bright";
  return (
    <>
      {trust.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={ctx.strings.about}>
          {trust.map((text, i) => (
            <li key={text} className={cn("inline-flex min-h-9 max-w-full items-center gap-[6px] px-3 py-1 text-[13px] font-semibold", look.chip, bright && brightTint(i).chip)}>
              <Icon name="check_circle" size={16} fill className={cn("shrink-0", dark ? "text-site-accent" : bright ? "" : "text-site-accent")} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {place ? (
        <p className="flex items-center gap-[6px] text-[14px] font-semibold text-(--hero-fg)">
          <Icon name="location_on" size={18} fill className={dark ? "text-site-accent" : "text-site-accent"} />
          <span className="line-clamp-1">{place}</span>
        </p>
      ) : null}
    </>
  );
}

/** Trust's identity bar under the hero: where they work, how to reach them, what customers say. */
function TrustBar({ ctx }: { ctx: RenderCtx }) {
  if (ctx.template !== "trust") return null;
  const { site, strings, call, phone, target, rel } = ctx;
  const look = LOOK.trust;
  const area = site.business.area ?? site.business.address;
  const rating = ratingOf(site);
  const items = [
    area ? { key: "area", label: strings.serviceArea, value: <dd className="truncate text-[15px] font-semibold">{area}</dd> } : null,
    call && phone
      ? {
          key: "phone",
          label: strings.directContact,
          value: (
            <dd className="truncate">
              <a href={call} target={target} rel={rel} className="font-site-mono text-[15px] font-semibold text-site-accent">
                {phone}
              </a>
            </dd>
          ),
        }
      : null,
    rating
      ? {
          key: "rating",
          label: strings.reviews,
          value: (
            <dd className="flex items-center gap-2 text-[15px] font-semibold">
              <Icon name="star" size={16} fill className="text-site-accent" />
              <span className="font-site-mono">{rating.average}</span>
              <span className="font-normal text-site-muted">· {rating.count}</span>
            </dd>
          ),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!items.length) return null;
  return (
    <div className={cn("mx-auto w-full pb-2", look.pad, look.wide)}>
      <dl className="grid gap-x-8 gap-y-4 rounded-[12px] border border-site-line bg-white px-5 py-4 @md:grid-cols-3 @3xl:px-7 @3xl:py-5">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-col gap-1">
            <dt className="font-site-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-muted">{item.label}</dt>
            {item.value}
          </div>
        ))}
      </dl>
    </div>
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
 * (height-capped, width follows) with the copy centred beside it. Elegant's
 * split pulls the copy panel over the photo's edge, as in its design.
 */
function HeroPhoto({ ctx, section, hero, image, frame }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero; image: SiteImageData; frame: HeroFrame }) {
  const { business } = ctx.site;
  const { template } = ctx;
  const look = LOOK[template];
  const dark = ctx.preset.heroDark;
  const overlayM = frame.mobile === "overlay";
  const overlayD = frame.desktop === "overlay";
  const panel = template === "elegant" && !overlayD;
  const { showPerson, trust, place } = modeExtras(ctx, hero);
  /** Stacked person hero: the round photo pulls up over the cover's bottom edge, so the copy needs no top padding. */
  const overlapPhoto = !overlayM && showPerson && ctx.category.personLed && Boolean(business.profilePhoto);
  const cell = cn("mx-auto w-full", look.pad, overlayD ? look.wide : "@3xl:max-w-none");
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
            : cn("@3xl:mx-auto @3xl:grid-cols-[1fr_1fr] @3xl:grid-rows-[1fr_auto_auto_1fr] @3xl:gap-x-12 @3xl:py-12", look.wide, template === "bold" && "@3xl:py-16"),
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
              : cn("@3xl:col-start-2 @3xl:row-start-1 @3xl:row-span-4 @3xl:max-w-[calc(min(72svh,640px)*var(--hero-ratio-d))] @3xl:self-center @3xl:justify-self-center", look.radius),
          )}
          style={look.ground && !dark ? { ...vars, background: look.ground } : vars}
        >
          <Cover image={image} hero={hero} sizes={HERO_SIZES[frame.desktop]} />
          {overlayM || overlayD ? (
            <div aria-hidden className={cn("absolute inset-0", overlayM && !overlayD && "@3xl:hidden", !overlayM && overlayD && "hidden @3xl:block")} style={fade} />
          ) : null}
        </div>
        <div
          className={cn(
            "relative z-10 col-start-1 row-start-2 flex min-w-0 flex-col gap-4",
            cell,
            overlayM ? "pt-16 pb-5" : overlapPhoto ? "pt-0" : "pt-5",
            overlayD ? "@3xl:pt-24 @3xl:pb-0" : panel ? "@3xl:-mr-24 @3xl:bg-site-ground @3xl:px-12 @3xl:pt-12" : "@3xl:px-0 @3xl:pt-0",
            toneFor(overlayM, dark, false),
            toneFor(overlayD, dark, true),
          )}
        >
          <div className={cn("flex flex-col gap-4", overlayD && "@3xl:max-w-[680px]")}>
            {showPerson ? <HeroIdentity ctx={ctx} section={section} overlap={overlapPhoto} /> : null}
            <HeroCopy ctx={ctx} section={section} compact={template === "bold" && !overlayD} />
            <ModeExtras ctx={ctx} trust={trust} place={place} />
          </div>
        </div>
        <div
          className={cn(
            "relative z-10 col-start-1 row-start-3 pt-4 pb-6",
            cell,
            overlayD ? "@3xl:pt-6 @3xl:pb-12" : panel ? "@3xl:-mr-24 @3xl:bg-site-ground @3xl:px-12 @3xl:pt-6 @3xl:pb-12" : "@3xl:px-0 @3xl:pt-6 @3xl:pb-0",
            toneFor(overlayM, dark, false),
            toneFor(overlayD, dark, true),
          )}
        >
          <HeroButtons ctx={ctx} />
          <HeroRating ctx={ctx} />
        </div>
      </div>
      <TrustBar ctx={ctx} />
    </div>
  );
}

/**
 * No photo yet: the copy on the template's own hero ground (Bold's ink) with a
 * faint category glyph, so a brand-new site never shows an empty box.
 */
function HeroNoPhoto({ ctx, section, hero }: { ctx: RenderCtx; section: HeroSection; hero: ResolvedHero }) {
  const { template } = ctx;
  const look = LOOK[template];
  const dark = ctx.preset.heroDark;
  const { showPerson, trust, place } = modeExtras(ctx, hero);
  return (
    <div
      className={cn("relative overflow-hidden", dark && "bg-site-ink text-white", dark ? TONE.bold : TONE.ink)}
      style={!dark && look.ground ? { background: look.ground } : undefined}
      data-hero-mode={hero.mode}
    >
      <Icon
        name={ctx.category.icon}
        size={180}
        className={cn("pointer-events-none absolute -top-6 -right-8 opacity-[.08] @3xl:right-8", dark ? "text-white" : "text-site-accent", template === "elegant" && "@3xl:hidden")}
      />
      {template === "elegant" ? <div className="site-stripe hidden @3xl:absolute @3xl:inset-y-12 @3xl:right-10 @3xl:block @3xl:w-[30%]" aria-hidden /> : null}
      <div className={cn("relative mx-auto flex w-full flex-col gap-5 pt-10 pb-8 @3xl:pt-20 @3xl:pb-16", look.pad, look.wide, template === "bold" && "@3xl:pt-24 @3xl:pb-20")}>
        <div className={cn("flex flex-col gap-4", template === "elegant" ? "max-w-[720px] @3xl:max-w-[60%]" : "max-w-[820px]")}>
          {showPerson ? <HeroIdentity ctx={ctx} section={section} /> : null}
          <HeroCopy ctx={ctx} section={section} />
          <ModeExtras ctx={ctx} trust={trust} place={place} />
        </div>
        <div>
          <HeroButtons ctx={ctx} className="pt-1" />
          <HeroRating ctx={ctx} />
        </div>
      </div>
      {template === "trust" ? (
        <div className="pb-4" style={{ background: "var(--site-ground)" }}>
          <div className="pt-4">
            <TrustBar ctx={ctx} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Hero({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  const hero = resolveHero(ctx.site, section);
  if (hero.image && hero.frame) return <HeroPhoto ctx={ctx} section={section} hero={hero} image={hero.image} frame={hero.frame} />;
  return <HeroNoPhoto ctx={ctx} section={section} hero={hero} />;
}
