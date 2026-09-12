import type { CategoryId } from "@/lib/site/categories";
import { CATEGORIES } from "@/lib/site/categories";
import {
  newId,
  type OfferingKind,
  type Section,
  type SectionOf,
  type SectionType,
  type SiteContent,
  type SiteImage,
} from "@/lib/site/schema";

/**
 * Pure helpers the editor uses to read and rewrite one section of a site's
 * structured content. Every function returns a new SiteContent; nothing here
 * touches Firestore.
 */

export function findSection<T extends SectionType>(site: SiteContent, type: T): SectionOf<T> | undefined {
  return site.sections.find((s): s is SectionOf<T> => s.type === type);
}

export function sectionIndex(site: SiteContent, type: SectionType): number {
  return site.sections.findIndex((s) => s.type === type);
}

/** Patch the first section of a type. No-op when the site has none. */
export function patchSection<T extends SectionType>(
  site: SiteContent,
  type: T,
  patch: Partial<Omit<SectionOf<T>, "type" | "id">>,
): SiteContent {
  const index = sectionIndex(site, type);
  if (index < 0) return site;
  const sections = site.sections.slice();
  sections[index] = { ...(sections[index] as SectionOf<T>), ...patch } as Section;
  return { ...site, sections };
}

/** Sections that always sit at the bottom of a site, in order. */
const TAIL: SectionType[] = ["location", "contact", "cta"];

/**
 * Return the site with a section of `type` present, creating it with `create`
 * when missing. New sections go before the tail (location/contact/cta) so the
 * page keeps its shape.
 */
export function ensureSection<T extends SectionType>(
  site: SiteContent,
  type: T,
  create: () => Omit<SectionOf<T>, "id" | "enabled">,
): SiteContent {
  if (sectionIndex(site, type) >= 0) return site;
  const section = { id: newId(type), enabled: true, ...create() } as Section;
  const sections = site.sections.slice();
  const tailRank = (t: SectionType) => TAIL.indexOf(t);
  const rank = tailRank(type);
  let at = sections.length;
  if (rank >= 0) {
    // Keep the tail order: insert before the first tail section ranked after this one.
    const later = sections.findIndex((s) => tailRank(s.type) > rank);
    at = later >= 0 ? later : sections.length;
  } else {
    const firstTail = sections.findIndex((s) => tailRank(s.type) >= 0);
    at = firstTail >= 0 ? firstTail : sections.length;
  }
  sections.splice(at, 0, section);
  return { ...site, sections };
}

export function removeSection(site: SiteContent, type: SectionType): SiteContent {
  return { ...site, sections: site.sections.filter((s) => s.type !== type) };
}

/** The default offerings kind for a category, mirroring the AI's own choice. */
export function defaultOfferingKind(category: CategoryId): OfferingKind {
  const byCategory: Partial<Record<CategoryId, OfferingKind>> = {
    restaurant: "menu",
    car: "models",
    beauty: "treatments",
    photographer: "packages",
    property: "listings",
    tutor: "subjects",
    retail: "products",
    fitness: "classes",
  };
  return byCategory[category] ?? "services";
}

export function offeringsLabel(site: SiteContent): string {
  return findSection(site, "offerings")?.title || CATEGORIES[site.business.category].offeringsLabel;
}

/** All photos in display order: the hero image first, then the gallery. */
export function sitePhotos(site: SiteContent): SiteImage[] {
  const hero = findSection(site, "hero")?.image;
  const gallery = findSection(site, "gallery")?.images ?? [];
  return hero ? [hero, ...gallery] : gallery;
}

/** Write photos back: first becomes the hero image, the rest the gallery. */
export function setSitePhotos(site: SiteContent, photos: SiteImage[]): SiteContent {
  const [hero, ...rest] = photos;
  let next = patchSection(site, "hero", { image: hero });
  if (rest.length) {
    next = ensureSection(next, "gallery", () => ({ type: "gallery", images: [] }));
    next = patchSection(next, "gallery", { images: rest });
  } else if (findSection(next, "gallery")) {
    next = patchSection(next, "gallery", { images: [] });
  }
  return next;
}

/** Every uploaded image referenced by the site (for cleanup on delete). */
export function allImages(site: SiteContent): SiteImage[] {
  const images: SiteImage[] = [];
  for (const section of site.sections) {
    if (section.type === "hero" && section.image) images.push(section.image);
    if (section.type === "gallery") images.push(...section.images);
    if (section.type === "offerings") for (const item of section.items) if (item.image) images.push(item.image);
  }
  return images;
}

/** Move an array element up or down by one, returning a new array. */
export function moveItem<T>(list: T[], from: number, delta: -1 | 1): T[] {
  const to = from + delta;
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
