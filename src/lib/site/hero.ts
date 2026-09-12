import { getCategory, type HeroMode } from "./categories";
import type { HeroImagePosition, SectionOf, SiteContent, SiteImage } from "./schema";

/**
 * What the hero shows, resolved the same way for the public site, the
 * previews and the editor so they can never disagree.
 */
export interface ResolvedHero {
  /** Cover photo, or undefined when the category fallback should render. */
  image?: SiteImage;
  position: HeroImagePosition;
  mode: HeroMode;
}

/**
 * The owner's dedicated cover photo wins. Sites built before it existed keep
 * their first uploaded photo as the cover. Never the logo or profile photo.
 */
export function heroImageOf(site: SiteContent, section?: SectionOf<"hero">): SiteImage | undefined {
  return site.business.heroImage ?? section?.image;
}

/** The AI's choice for this site, else the category default. */
export function heroModeOf(site: SiteContent, section?: SectionOf<"hero">): HeroMode {
  return section?.presentationMode ?? getCategory(site.business.category).heroMode;
}

export function resolveHero(site: SiteContent, section?: SectionOf<"hero">): ResolvedHero {
  return {
    image: heroImageOf(site, section),
    position: site.business.heroImagePosition ?? "center",
    mode: heroModeOf(site, section),
  };
}

/** object-position class for a cover photo cropped on small screens. */
export const HERO_POSITION_CLASS: Record<HeroImagePosition, string> = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
};
