import type { IconName } from "@/components/ui/Icon";
import { ICON_PATHS } from "@/components/ui/icons.generated";
import { cn } from "@/lib/cn";
import { getCategory, type Category } from "@/lib/site/categories";
import { siteStrings, type SiteStrings } from "@/lib/site/i18n";
import { callNumber, chatUrl, ctaHref, telUrl } from "@/lib/site/links";
import { resolveLocation } from "@/lib/site/location";
import { PRESETS, type Preset } from "@/lib/site/presets";
import type { SectionOf, SectionType, SiteContent } from "@/lib/site/schema";
import { resolveTemplateId, type TemplateId } from "@/lib/site/templates";
import { SKINS, type Skin } from "./skin";

/**
 * "public" is the live site at /w/[slug]. "preview" is the same renderer inside
 * the product (ready screen, editor, landing phone): outbound links open in a
 * new tab. The Google Maps iframe is on for "public" and left out of "preview"
 * unless the caller asks for it (the owner's ready and editor previews do, so
 * they show the map the live site will; landing mockups don't).
 */
export type RenderMode = "public" | "preview";

export interface PrimaryCta {
  href: string | null;
  label: string;
  icon: IconName;
  /** A WhatsApp button (green on templates that use WhatsApp green). */
  green: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/** Everything a section needs, computed once per render. Plain data, no hooks. */
export interface RenderCtx {
  site: SiteContent;
  category: Category;
  /** The template this site renders with (always a known one, see templates.ts). */
  template: TemplateId;
  preset: Preset;
  skin: Skin;
  strings: SiteStrings;
  mode: RenderMode;
  /** Render the keyless Google Maps embed in the location section. */
  maps: boolean;
  primary: PrimaryCta;
  /** Generic WhatsApp chat link, when the business has a number. */
  chat: string | null;
  /** tel: link, when the business has a phone or WhatsApp number. */
  call: string | null;
  /** The number to show next to a call link, as the owner typed it. */
  phone: string | null;
  /** Anchor target for outbound links. */
  target?: "_blank";
  rel?: string;
}

export function buildCtx(site: SiteContent, mode: RenderMode, options: { maps?: boolean } = {}): RenderCtx {
  const category = getCategory(site.business.category);
  const template = resolveTemplateId(site);
  const number = callNumber(site);
  const isWhatsapp = site.cta.kind === "whatsapp";
  const green = isWhatsapp && (category.ctaIcon === "chat" || /whatsapp/i.test(site.cta.label));
  const phone = site.business.phone?.trim() || (site.business.whatsapp ? `+${site.business.whatsapp}` : null);
  return {
    site,
    category,
    template,
    preset: PRESETS[template],
    skin: SKINS[template],
    strings: siteStrings(site.language),
    mode,
    maps: options.maps ?? mode === "public",
    primary: { href: ctaHref(site), label: site.cta.label, icon: category.ctaIcon, green },
    chat: chatUrl(site),
    call: number ? telUrl(number) : null,
    phone: number ? phone : null,
    target: mode === "preview" ? "_blank" : undefined,
    rel: mode === "preview" ? "noreferrer" : undefined,
  };
}

/** Heading treatment per template (Marcellus has no bold; Archivo shouts). */
export function headingClass(preset: Preset): string {
  return SKINS[preset.id].heading;
}

/** A template button: filled or outline, or WhatsApp green where the template uses it. */
export function buttonClass(ctx: RenderCtx, variant: "primary" | "outline", green = false): string {
  const { skin } = ctx;
  if (green && skin.whatsappGreen) return cn(skin.btn, "bg-whatsapp text-white");
  return cn(skin.btn, variant === "primary" ? skin.btnPrimary : skin.btnOutline);
}

export function findSection<T extends SectionType>(site: SiteContent, type: T): SectionOf<T> | undefined {
  return site.sections.find((s): s is SectionOf<T> => s.type === type && s.enabled);
}

/** A section's place among the page's sections after the hero, from 0. */
export function sectionIndex(ctx: RenderCtx, id: string): number {
  return Math.max(0, ctx.site.sections.filter((s) => s.enabled && s.type !== "hero").findIndex((s) => s.id === id));
}

export const twoDigits = (n: number) => String(n).padStart(2, "0");

/** One or two letters for a monogram tile. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Average star rating and count from the site's own reviews, if it shows any. */
export function ratingOf(site: SiteContent): { average: string; count: number } | null {
  const reviews = findSection(site, "reviews");
  if (!reviews?.items.length) return null;
  const total = reviews.items.reduce((sum, r) => sum + (r.rating ?? 5), 0);
  return { average: (total / reviews.items.length).toFixed(1), count: reviews.items.length };
}

/** Up to four in-page anchors, in the order customers care about. */
export function buildNav(ctx: RenderCtx): NavItem[] {
  const { site, category, strings, call } = ctx;
  const items: NavItem[] = [];
  const anchor = (id: string) => `#s-${id}`;

  const offerings = findSection(site, "offerings");
  if (offerings && offerings.items.length) {
    items.push({ href: anchor(offerings.id), label: strings.kinds[offerings.kind], icon: category.icon });
  }
  const gallery = findSection(site, "gallery");
  if (gallery && gallery.images.length) items.push({ href: anchor(gallery.id), label: strings.gallery, icon: "photo_library" });
  const reviews = findSection(site, "reviews");
  if (reviews && reviews.items.length) items.push({ href: anchor(reviews.id), label: strings.reviews, icon: "star" });
  const location = findSection(site, "location");
  if (location && (resolveLocation(location, site.business) || location.hours?.length || location.note)) {
    items.push({ href: anchor(location.id), label: strings.location, icon: "location_on" });
  }
  if (call) items.push({ href: call, label: strings.call, icon: "call" });
  const faq = findSection(site, "faq");
  if (faq && faq.items.length) items.push({ href: anchor(faq.id), label: strings.faq, icon: "help" });
  const about = findSection(site, "about");
  if (about) items.push({ href: anchor(about.id), label: strings.about, icon: "info" });

  return items.slice(0, 4);
}

/** AI-suggested icon names are free text; fall back to a safe glyph. */
export function iconFor(name: string | undefined, fallback: IconName = "check_circle"): IconName {
  return name && name in ICON_PATHS ? (name as IconName) : fallback;
}

/** Accent-tinted surface used for placeholders and image-less heroes. */
export function tint(percent: number): string {
  return `color-mix(in srgb, var(--site-accent) ${percent}%, var(--site-ground))`;
}
