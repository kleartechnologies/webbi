import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { mailUrl } from "@/lib/site/links";
import type { TemplateId } from "@/lib/site/templates";
import type { NavItem, RenderCtx } from "./context";
import { SocialLinks } from "./SocialLinks";

/** Footer surface and type per template (from each design's footer). */
const LOOK: Record<TemplateId, { shell: string; pad: string; grid: string; name: string; sub: string; label: string; link: string; bottom: string; credit: string; dark: boolean }> = {
  warm: {
    shell: "bg-[#2B1F16] text-[#FBF7F0] site-grain-dark",
    pad: "pt-10 pb-8 @3xl:pt-12",
    grid: "@3xl:grid-cols-[1.6fr_1fr_1fr_1fr]",
    name: "font-site text-[17px] font-bold @3xl:text-[19px]",
    sub: "text-[13px] leading-[1.6] text-[#FBF7F0]/60",
    label: "text-[10px] font-bold uppercase tracking-[0.18em] text-[#FBF7F0]/50",
    link: "text-[13px] font-semibold text-[#FBF7F0]/85 hover:text-white",
    bottom: "border-t border-[#FBF7F0]/15 text-[12px] text-[#FBF7F0]/55",
    credit: "font-bold text-[#FBF7F0]",
    dark: true,
  },
  elegant: {
    shell: "border-t border-site-line",
    pad: "pt-14 pb-9 @3xl:pt-[72px]",
    grid: "@3xl:grid-cols-[1.4fr_1fr_1fr_1fr]",
    name: "font-site text-[18px] uppercase tracking-[0.3em] @3xl:text-[20px]",
    sub: "text-[13px] leading-[1.7] text-[#6B5C60]",
    label: "text-[10px] font-bold uppercase tracking-[0.2em] text-site-accent",
    link: "text-[14px] text-site-ink hover:text-site-accent",
    bottom: "border-t border-site-line text-[12px] text-site-muted",
    credit: "font-semibold text-site-ink",
    dark: false,
  },
  bold: {
    shell: "bg-[#06080C] text-white",
    pad: "pt-12 pb-8 @3xl:pt-20",
    // The design's fixed columns need a desktop width; at tablet they'd push the last one off screen.
    grid: "@5xl:grid-cols-[minmax(0,1fr)_200px_200px_240px]",
    name: "text-[30px] leading-[0.95] font-extrabold uppercase site-wide @3xl:text-[44px]",
    sub: "text-[14px] leading-[1.6] text-[#8D95A2]",
    label: "text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7682]",
    link: "text-[15px] font-semibold text-white hover:text-[#FF4B33]",
    bottom: "border-t border-white/15 text-[13px] text-[#6E7682]",
    credit: "font-bold text-white",
    dark: true,
  },
  trust: {
    shell: "border-t border-site-line",
    pad: "pt-10 pb-10 @3xl:pt-12 @3xl:pb-14",
    grid: "@3xl:grid-cols-[1.4fr_1fr_1fr_1fr]",
    name: "text-[16px] font-bold",
    sub: "text-[14px] leading-[1.6] text-site-muted",
    label: "font-site-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-muted",
    link: "text-[14px] text-[#40525E] hover:text-site-ink",
    bottom: "border-t border-site-line text-[12.5px] text-site-muted",
    credit: "font-site-mono font-semibold text-site-ink",
    dark: false,
  },
  bright: {
    shell: "border-t border-[#EDE7DA]",
    pad: "pt-12 pb-12 @3xl:pt-14 @3xl:pb-[60px]",
    grid: "@3xl:grid-cols-[1.6fr_1fr_1fr_1fr]",
    name: "text-[16.5px] font-bold",
    sub: "text-[14.5px] leading-[1.6] text-[#5A6A75]",
    label: "text-[13.5px] font-bold text-site-ink",
    link: "text-[14.5px] text-[#5A6A75] hover:text-site-ink",
    bottom: "border-t border-[#EDE7DA] text-[13.5px] text-[#8695A0]",
    credit: "font-bold text-site-ink",
    dark: false,
  },
};

function Column({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span className={className}>{label}</span>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

export function SiteFooter({ ctx, nav }: { ctx: RenderCtx; nav: NavItem[] }) {
  const { site, strings, target, rel, template, skin, chat, call, phone } = ctx;
  const { business } = site;
  const look = LOOK[template];
  const place = business.address ?? business.area;
  const contact = [
    chat ? { href: chat, label: strings.whatsapp } : null,
    call && phone ? { href: call, label: phone } : null,
    business.email ? { href: mailUrl(business.email), label: business.email } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <footer className={cn("w-full", look.shell)}>
      <div className={cn("mx-auto w-full", skin.container, look.pad)}>
        <div className={cn("grid gap-8 @md:grid-cols-2", look.grid)}>
          <div className="flex min-w-0 flex-col gap-2">
            <span className={cn(look.name, "[overflow-wrap:anywhere]")}>{business.name}</span>
            {business.tagline ? <p className={look.sub}>{business.tagline}</p> : null}
            {/* Social icons land here only when the site has no contact (or, person-led, about) section. */}
            <SocialLinks ctx={ctx} at="footer" dark={look.dark} className="pt-3" />
          </div>
          {nav.length ? (
            <Column label={strings.explore} className={look.label}>
              {nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className={look.link}>
                    {item.label}
                  </a>
                </li>
              ))}
            </Column>
          ) : null}
          {contact.length ? (
            <Column label={strings.contact} className={look.label}>
              {contact.map((item) => (
                <li key={item.href} className="min-w-0">
                  <a href={item.href} target={target} rel={rel} className={cn(look.link, "[overflow-wrap:anywhere]", template === "trust" && item.href.startsWith("tel:") && "font-site-mono")}>
                    {item.label}
                  </a>
                </li>
              ))}
            </Column>
          ) : null}
          {place ? (
            <Column label={strings.visit} className={look.label}>
              <li className={cn(look.sub, "[overflow-wrap:anywhere]")}>{place}</li>
            </Column>
          ) : null}
        </div>
        <div className={cn("mt-10 flex flex-col gap-2 pt-6 @md:flex-row @md:items-center @md:justify-between", look.bottom)}>
          <span className="[overflow-wrap:anywhere]">
            © {new Date().getFullYear()} {business.name}
          </span>
          {site.theme?.showCredit === false ? null : (
            <span>
              {strings.builtWith}{" "}
              {/* A full page load, not a client-side navigation: Webbi's app has its own security policy (src/lib/security/headers.ts). */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate: next/link would keep the site's stricter CSP on the app */}
              <a href="/" target={target} rel={rel} className={look.credit}>
                Webbi
              </a>
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
