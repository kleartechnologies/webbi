import type { IconName } from "@/components/ui/Icon";
import { ICON_PATHS } from "@/components/ui/icons.generated";
import { getCategory, type Category } from "@/lib/site/categories";
import { siteStrings, type SiteStrings } from "@/lib/site/i18n";
import { callNumber, chatUrl, ctaHref, telUrl } from "@/lib/site/links";
import { resolveLocation } from "@/lib/site/location";
import { PRESETS, type Preset } from "@/lib/site/presets";
import type { SectionOf, SectionType, SiteContent } from "@/lib/site/schema";

/**
 * "public" is the live site at /w/[slug]. "preview" is the same renderer inside
 * the product (ready screen, editor, landing phone): outbound links open in a
 * new tab and heavy third-party embeds (the Google Maps iframe) are left out.
 */
export type RenderMode = "public" | "preview";

export interface PrimaryCta {
  href: string | null;
  label: string;
  icon: IconName;
  /** WhatsApp green instead of the site accent. */
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
  preset: Preset;
  strings: SiteStrings;
  mode: RenderMode;
  primary: PrimaryCta;
  /** Generic WhatsApp chat link, when the business has a number. */
  chat: string | null;
  /** tel: link, when the business has a phone or WhatsApp number. */
  call: string | null;
  /** Anchor target for outbound links. */
  target?: "_blank";
  rel?: string;
}

export function buildCtx(site: SiteContent, mode: RenderMode): RenderCtx {
  const category = getCategory(site.business.category);
  const preset = PRESETS[site.theme.preset];
  const number = callNumber(site);
  const isWhatsapp = site.cta.kind === "whatsapp";
  const green = isWhatsapp && (category.ctaIcon === "chat" || /whatsapp/i.test(site.cta.label));
  return {
    site,
    category,
    preset,
    strings: siteStrings(site.language),
    mode,
    primary: { href: ctaHref(site), label: site.cta.label, icon: category.ctaIcon, green },
    chat: chatUrl(site),
    call: number ? telUrl(number) : null,
    target: mode === "preview" ? "_blank" : undefined,
    rel: mode === "preview" ? "noreferrer" : undefined,
  };
}

/** Heading treatment per preset (Marcellus has no bold; Barlow wants shouting). */
export function headingClass(preset: Preset): string {
  switch (preset.id) {
    case "elegant":
      return "font-site font-normal";
    case "bold":
      return "font-site font-extrabold uppercase";
    default:
      return "font-site font-bold";
  }
}

export function findSection<T extends SectionType>(site: SiteContent, type: T): SectionOf<T> | undefined {
  return site.sections.find((s): s is SectionOf<T> => s.type === type && s.enabled);
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
