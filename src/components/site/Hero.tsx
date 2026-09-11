import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SectionOf } from "@/lib/site/schema";
import { headingClass, tint, type RenderCtx } from "./context";
import { SiteImage } from "./SiteImage";

type HeroSection = SectionOf<"hero">;
const HERO_SIZES = "(max-width: 768px) 100vw, 1120px";

/** Kicker + headline + subheadline, in light (on photo/dark) or ink (on ground). */
function HeroCopy({ ctx, section, light, center }: { ctx: RenderCtx; section: HeroSection; light: boolean; center?: boolean }) {
  const kicker = section.badge ?? ctx.site.business.area;
  const bold = ctx.preset.heroDark;
  return (
    <div className={cn("flex flex-col gap-2", center && "items-center text-center @3xl:items-start @3xl:text-left")}>
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

const darkFade = { background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, color-mix(in srgb, var(--site-ink) 88%, transparent) 100%)" };

/** Warm: full-bleed photo with copy on a dark gradient. */
function HeroWarm({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  return (
    <div className="relative">
      <div className="relative aspect-[4/5] max-h-[560px] min-h-[420px] w-full overflow-hidden @3xl:aspect-auto @3xl:h-[560px]">
        <SiteImage image={section.image!} sizes={HERO_SIZES} priority />
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
function HeroElegant({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  return (
    <div className="@3xl:mx-auto @3xl:grid @3xl:w-full @3xl:max-w-[1120px] @3xl:grid-cols-2 @3xl:items-center @3xl:gap-12 @3xl:px-8 @3xl:py-12">
      <div className="relative aspect-[4/5] max-h-[560px] w-full overflow-hidden @3xl:order-2 @3xl:max-h-[600px] @3xl:rounded-[24px]">
        <SiteImage image={section.image!} sizes={HERO_SIZES} priority />
        <div className="absolute inset-0 @3xl:hidden" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, var(--site-ground) 100%)" }} />
      </div>
      <div className="relative -mt-20 px-5 @3xl:order-1 @3xl:mt-0 @3xl:px-0">
        <HeroCopy ctx={ctx} section={section} light={false} center />
      </div>
    </div>
  );
}

/** Trust / bright: inset rounded photo card. */
function HeroCard({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-3 @3xl:px-8 @3xl:pt-6">
      <div className="relative aspect-[4/5] max-h-[520px] min-h-[400px] w-full overflow-hidden rounded-[24px] @3xl:aspect-[21/9] @3xl:max-h-[480px] @3xl:min-h-0">
        <SiteImage image={section.image!} sizes={HERO_SIZES} priority />
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
    <div className="relative overflow-hidden" style={{ background: tint(12) }}>
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
function HeroBold({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  const { primary, chat, call, strings, target, rel } = ctx;
  const secondary = chat && !primary.green ? { href: chat, label: strings.chat, green: true } : !chat && call ? { href: call, label: strings.call, green: false } : null;
  return (
    <div className="bg-site-ink text-white">
      <div className="mx-auto grid w-full max-w-[1120px] gap-5 px-4 pt-4 pb-7 @3xl:grid-cols-[1.1fr_1fr] @3xl:items-center @3xl:gap-12 @3xl:px-8 @3xl:py-14">
        {section.image ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] @3xl:order-2">
            <SiteImage image={section.image} sizes="(max-width: 768px) 100vw, 560px" priority />
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-5 @3xl:order-1", !section.image && "pt-6 @3xl:col-span-2 @3xl:max-w-[720px]")}>
          <HeroCopy ctx={ctx} section={section} light />
          {primary.href || secondary ? (
            <div className="flex flex-col gap-[10px] @md:flex-row @md:flex-wrap">
              {primary.href ? (
                <a
                  href={primary.href}
                  target={target}
                  rel={rel}
                  className={cn("flex h-[54px] items-center justify-center gap-[10px] rounded-pill px-6 text-[16px] font-bold text-white", primary.green ? "bg-whatsapp" : "bg-site-accent")}
                >
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
                    "flex h-[54px] items-center justify-center gap-[10px] rounded-pill px-6 text-[16px] font-bold",
                    secondary.green ? "bg-whatsapp text-white" : "border-[1.5px] border-white/80 text-white",
                  )}
                >
                  <Icon name={secondary.green ? "chat" : "call"} size={22} fill={secondary.green} />
                  {secondary.label}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Hero({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  if (ctx.preset.heroDark) return <HeroBold ctx={ctx} section={section} />;
  if (!section.image) return <HeroPlain ctx={ctx} section={section} />;
  switch (ctx.preset.id) {
    case "warm":
      return <HeroWarm ctx={ctx} section={section} />;
    case "elegant":
      return <HeroElegant ctx={ctx} section={section} />;
    default:
      return <HeroCard ctx={ctx} section={section} />;
  }
}
