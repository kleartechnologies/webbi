import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { TemplateId } from "@/lib/site/templates";
import { initialsOf, type NavItem, type RenderCtx } from "./context";
import { ProfilePhoto } from "./ProfilePhoto";
import { SiteImage } from "./SiteImage";

const glass = { background: "color-mix(in srgb, var(--site-ground) 94%, transparent)" };

/** Bar, brand, nav and action per template (from each design's header). */
const LOOK: Record<
  TemplateId,
  { bar: string; row: string; tile: string; name: string; meta: string; nav: string; action: string; glass: boolean }
> = {
  warm: {
    bar: "border-b border-site-line backdrop-blur-md",
    row: "h-16 @3xl:h-[84px]",
    tile: "h-9 w-9 rounded-full bg-site-ink font-site text-[17px] font-bold text-site-ground",
    name: "font-site text-[19px] font-bold leading-[1.1] @3xl:text-[24px]",
    meta: "text-[9px] font-bold uppercase tracking-[0.18em] text-[#8A6E57] @3xl:text-[10px]",
    nav: "text-[14px] font-semibold hover:text-site-accent",
    action: "h-10 w-10 rounded-full text-white @3xl:h-11 @3xl:w-auto @3xl:px-5 @3xl:text-[14px] @3xl:font-bold",
    glass: true,
  },
  elegant: {
    bar: "border-b border-site-line backdrop-blur-md",
    row: "h-[62px] @3xl:h-[94px]",
    tile: "",
    name: "font-site text-[17px] uppercase leading-[1.1] tracking-[0.28em] @3xl:text-[24px] @3xl:tracking-[0.3em]",
    meta: "hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-site-muted @3xl:block",
    nav: "text-[14px] font-medium hover:text-site-accent",
    action:
      "h-10 px-1 text-[13px] font-semibold underline underline-offset-4 @3xl:h-[46px] @3xl:bg-site-ink @3xl:px-6 @3xl:text-[14px] @3xl:text-site-ground @3xl:no-underline @3xl:transition-colors @3xl:hover:bg-site-accent",
    glass: true,
  },
  bold: {
    bar: "bg-site-ink text-white @3xl:border-b @3xl:border-site-ink @3xl:bg-site-ground @3xl:text-site-ink",
    row: "h-[60px] @3xl:h-[78px]",
    tile: "h-9 w-9 bg-site-accent text-[18px] font-extrabold text-white",
    name: "text-[19px] font-extrabold uppercase leading-none site-wide @3xl:text-[23px]",
    meta: "hidden",
    nav: "text-[14px] font-semibold uppercase tracking-[0.04em] hover:text-site-accent",
    action: "h-9 w-9 bg-site-accent text-white @3xl:h-12 @3xl:w-auto @3xl:px-5 @3xl:text-[14px] @3xl:font-extrabold @3xl:uppercase @3xl:tracking-[0.07em]",
    glass: false,
  },
  trust: {
    bar: "border-b border-site-line bg-white",
    row: "h-[58px] @3xl:h-20",
    tile: "h-[30px] w-[30px] rounded-[8px] bg-site-ink font-site-mono text-[11px] font-medium text-white @3xl:h-9 @3xl:w-9 @3xl:rounded-[9px] @3xl:text-[13px]",
    name: "text-[14px] font-bold leading-[1.2] @3xl:text-[16px]",
    meta: "font-site-mono text-[8.5px] uppercase tracking-[0.12em] text-site-muted @3xl:text-[10px]",
    nav: "text-[14.5px] font-medium text-[#40525E] hover:text-site-ink",
    action: "h-10 w-10 rounded-[8px] bg-site-accent text-white @3xl:h-[46px] @3xl:w-auto @3xl:px-5 @3xl:text-[14px] @3xl:font-semibold",
    glass: false,
  },
  bright: {
    bar: "backdrop-blur-md",
    row: "h-[60px] @3xl:h-[88px]",
    tile: "h-[30px] w-[30px] rounded-[10px] bg-[#E8F5FA] @3xl:h-[38px] @3xl:w-[38px] @3xl:rounded-[12px]",
    name: "text-[15px] font-bold leading-[1.2] @3xl:text-[16.5px]",
    meta: "text-[12px] text-[#7B8A94] @3xl:text-[12.5px]",
    nav: "text-[15px] font-medium text-[#4C5C67] hover:text-site-ink",
    action: "h-10 w-10 rounded-[12px] bg-site-accent text-white @3xl:h-[46px] @3xl:w-auto @3xl:px-5 @3xl:text-[15px] @3xl:font-bold",
    glass: true,
  },
};

export function SiteHeader({ ctx, nav }: { ctx: RenderCtx; nav: NavItem[] }) {
  const { site, category, template, skin, primary, chat, strings, target, rel } = ctx;
  const look = LOOK[template];
  const name = site.business.name;
  const initial = name.trim().charAt(0).toUpperCase();
  const photo = category.personLed ? site.business.profilePhoto : undefined;
  const logo = !category.personLed ? site.business.logo : undefined;
  const tagline = site.business.tagline && site.business.tagline.length <= 32 ? site.business.tagline : undefined;
  const meta = tagline ?? (template === "warm" || template === "elegant" ? site.business.area : undefined);
  const [firstWord, ...restWords] = name.trim().split(/\s+/);

  const action: { href: string; icon: IconName; fill: boolean; green: boolean; label: string } | null = primary.href
    ? { href: primary.href, icon: primary.icon, fill: primary.icon === "chat", green: primary.green, label: primary.label }
    : chat
      ? { href: chat, icon: "chat", fill: true, green: true, label: strings.whatsapp }
      : null;

  const mark = photo ? (
    <ProfilePhoto image={photo} name={name} size={36} className={template === "bold" ? "ring-white/20 @3xl:ring-site-line" : "ring-site-line"} />
  ) : logo ? (
    <span className={cn("relative block h-9 w-9 shrink-0 overflow-hidden bg-white ring-1 ring-site-line", template === "warm" ? "rounded-full" : template === "bold" || template === "elegant" ? "rounded-none" : "rounded-[9px]")} data-logo>
      <SiteImage image={{ ...logo, alt: logo.alt ?? name }} sizes="36px" className="object-contain" />
    </span>
  ) : template === "elegant" ? null : template === "bright" ? (
    <span className={cn("flex shrink-0 items-center justify-center", look.tile)} aria-hidden>
      <span className="h-[11px] w-[11px] rounded-full bg-[#8CC9E8] @3xl:h-[14px] @3xl:w-[14px]" />
    </span>
  ) : template === "trust" ? (
    <span className={cn("flex shrink-0 items-center justify-center", look.tile)} data-site-initial>
      {initialsOf(name)}
    </span>
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center", look.tile)} data-site-initial>
      {initial}
    </span>
  );

  return (
    <header className={cn("sticky top-0 z-30", look.bar)} style={look.glass ? glass : undefined}>
      <div className={cn("mx-auto flex w-full items-center gap-3 @3xl:gap-6", skin.container, look.row)}>
        <div className="flex min-w-0 flex-1 items-center gap-[10px] @3xl:gap-3">
          {mark}
          <span className="flex min-w-0 flex-col gap-[3px]">
            {template === "bold" ? (
              <span className={cn("truncate", look.name)}>
                {firstWord}
                {restWords.length ? <span className="text-[#FF4B33] @3xl:text-site-accent"> {restWords.join(" ")}</span> : null}
              </span>
            ) : (
              <span className={cn("truncate", look.name)}>{name}</span>
            )}
            {meta ? <span className={cn("truncate", look.meta)}>{meta}</span> : null}
          </span>
        </div>

        {nav.length ? (
          <nav className="hidden shrink-0 items-center gap-6 @5xl:flex @6xl:gap-8" aria-label="Sections">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className={look.nav}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}

        {action ? (
          <a
            href={action.href}
            target={target}
            rel={rel}
            aria-label={action.label}
            className={cn(
              "flex shrink-0 items-center justify-center gap-2",
              look.action,
              template === "warm" && (action.green ? "bg-whatsapp" : "bg-site-accent"),
            )}
          >
            {template === "elegant" ? (
              <span className="max-w-[9rem] truncate @3xl:max-w-[16rem]">{action.label}</span>
            ) : (
              <>
                <Icon name={action.icon} size={20} fill={action.fill} />
                <span className="hidden max-w-[16rem] truncate @3xl:inline">{action.label}</span>
              </>
            )}
          </a>
        ) : null}
      </div>
    </header>
  );
}
