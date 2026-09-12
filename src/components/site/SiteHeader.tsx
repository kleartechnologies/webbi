import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { NavItem, RenderCtx } from "./context";
import { ProfilePhoto } from "./ProfilePhoto";
import { SiteImage } from "./SiteImage";

export function SiteHeader({ ctx, nav }: { ctx: RenderCtx; nav: NavItem[] }) {
  const { site, category, preset, primary, chat, strings, target, rel } = ctx;
  const dark = preset.heroDark;
  const elegant = preset.id === "elegant";
  const name = site.business.name;
  const initial = name.trim().charAt(0).toUpperCase();
  const photo = category.personLed ? site.business.profilePhoto : undefined;
  const logo = !category.personLed ? site.business.logo : undefined;
  const tagline = site.business.tagline && site.business.tagline.length <= 32 ? site.business.tagline : undefined;

  const action: { href: string; icon: IconName; fill: boolean; green: boolean; label: string } | null = primary.href
    ? { href: primary.href, icon: primary.icon, fill: primary.icon === "chat", green: primary.green, label: primary.label }
    : chat
      ? { href: chat, icon: "chat", fill: true, green: true, label: strings.whatsapp }
      : null;

  return (
    <header
      className={cn("sticky top-0 z-30 border-b backdrop-blur-md", dark ? "border-white/10 text-white" : "border-site-line text-site-ink")}
      style={{ background: dark ? "color-mix(in srgb, var(--site-ink) 92%, transparent)" : "color-mix(in srgb, var(--site-ground) 92%, transparent)" }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 @3xl:h-16 @3xl:px-8">
        <div className="flex min-w-0 items-center gap-[10px]">
          {photo ? (
            <ProfilePhoto image={photo} name={name} size={32} className={dark ? "ring-white/20" : "ring-site-line"} />
          ) : logo ? (
            <span className={cn("relative block h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-white ring-1", dark ? "ring-white/20" : "ring-site-line")} data-logo>
              <SiteImage image={{ ...logo, alt: logo.alt ?? name }} sizes="32px" className="object-contain" />
            </span>
          ) : !elegant ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-site-accent font-site text-[16px] font-bold text-white">
              {initial}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className={cn("truncate", elegant ? "font-site text-[18px] tracking-[0.02em]" : "font-site text-[17px] font-bold")}>{name}</span>
            {tagline ? (
              <span className={cn("truncate text-[11px]", elegant ? "uppercase tracking-[0.14em] text-site-muted" : dark ? "text-white/70" : "text-site-muted")}>
                {tagline}
              </span>
            ) : null}
          </span>
        </div>

        {nav.length ? (
          <nav className="ml-auto hidden items-center gap-6 @3xl:flex" aria-label="Sections">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="text-[14px] font-semibold opacity-85 hover:opacity-100">
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
              "ml-auto flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-pill text-white @3xl:ml-0 @3xl:w-auto @3xl:px-4 @3xl:text-[14px] @3xl:font-bold",
              action.green ? "bg-whatsapp" : "bg-site-accent",
            )}
          >
            <Icon name={action.icon} size={20} fill={action.fill} />
            <span className="hidden @3xl:inline">{action.label}</span>
          </a>
        ) : null}
      </div>
    </header>
  );
}
