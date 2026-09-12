/**
 * Turns raw AI output into canonical Site JSON: converts nulls, assigns ids,
 * merges the owner's confirmed facts (which always win), places uploaded
 * photos, and validates against siteContentSchema.
 */
import { CATEGORIES, type Category, type HeroMode } from "@/lib/site/categories";
import { socialUrl, type SocialKind } from "@/lib/site/links";
import {
  SITE_VERSION,
  siteContentSchema,
  understandingSchema,
  newId,
  type GenerationInput,
  type Language,
  type Section,
  type SiteContent,
  type Understanding,
} from "@/lib/site/schema";
import type { AiSite, AiUnderstanding } from "./schemas";

/** null → undefined, trimmed strings, so `.optional()` fields validate. */
function opt<T>(value: T | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return (trimmed ? trimmed : undefined) as T | undefined;
  }
  return value;
}

/** "012-345 6789" / "+60 12 345 6789" / "60123456789" → "60123456789" */
export function normalizeMyPhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  else if (!digits.startsWith("60") && digits.length <= 10) digits = `60${digits}`;
  return /^\d{9,15}$/.test(digits) ? digits : undefined;
}

/** A social handle the model extracted is kept only when it normalises to a safe profile URL — and is stored as that URL. */
function extractedSocial(kind: SocialKind, value: string | null | undefined): string | undefined {
  const text = opt(value);
  return (text && socialUrl(kind, text)) || undefined;
}

/**
 * The model may suggest a hero layout, but only one that makes sense for the
 * category: "person" needs a person-led business and "property" a property
 * agent. Anything else falls back to the category default.
 */
export function resolvePresentationMode(choice: HeroMode | null | undefined, category: Category): HeroMode {
  if (!choice) return category.heroMode;
  if (choice === "person" && !category.personLed) return category.heroMode;
  if (choice === "property" && category.id !== "property") return category.heroMode;
  return choice;
}

export function toUnderstanding(raw: AiUnderstanding): Understanding {
  const category = raw.category;
  const candidate = {
    language: raw.language,
    name: raw.name.trim() || CATEGORIES[category].label,
    category,
    categoryConfidence: raw.categoryConfidence,
    tagline: opt(raw.tagline),
    area: opt(raw.area),
    whatsapp: normalizeMyPhone(raw.whatsapp),
    offerings: raw.offerings
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), price: opt(o.price) })),
    highlights: raw.highlights.map((h) => h.trim()).filter(Boolean),
    ctaLabel: raw.ctaLabel.trim() || CATEGORIES[category].cta,
    tone: raw.tone,
    summary: raw.summary.trim(),
    instagram: extractedSocial("instagram", raw.instagram),
    facebook: extractedSocial("facebook", raw.facebook),
    tiktok: extractedSocial("tiktok", raw.tiktok),
  };
  return understandingSchema.parse(candidate);
}

function convertSection(section: AiSite["sections"][number], input: GenerationInput): Section {
  const base = { id: newId("sec"), enabled: true as const };
  switch (section.type) {
    case "hero":
      return {
        ...base,
        type: "hero",
        headline: section.headline,
        subheadline: opt(section.subheadline),
        badge: opt(section.badge),
        presentationMode: resolvePresentationMode(section.presentationMode, CATEGORIES[input.category]),
      };
    case "about":
      return {
        ...base,
        type: "about",
        title: opt(section.title),
        body: section.body.map((p) => p.trim()).filter(Boolean),
        highlights: section.highlights?.map((h) => h.trim()).filter(Boolean),
      };
    case "offerings": {
      // Owner's list is the source of truth for names/prices/images; the AI may only add descriptions.
      const byName = new Map(section.items.map((i) => [i.name.trim().toLowerCase(), i]));
      const items = input.offerings.map((o) => {
        const match = byName.get(o.name.trim().toLowerCase());
        return { id: o.id, name: o.name, price: o.price, image: o.image, description: opt(match?.description), tag: opt(match?.tag) };
      });
      return { ...base, type: "offerings", kind: section.kind, title: section.title, note: opt(section.note), items };
    }
    case "highlights":
      return {
        ...base,
        type: "highlights",
        title: opt(section.title),
        items: section.items.map((i) => ({ id: newId("hl"), icon: opt(i.icon), title: i.title, text: opt(i.text) })),
      };
    case "faq":
      return {
        ...base,
        type: "faq",
        title: opt(section.title),
        items: section.items.map((i) => ({ id: newId("faq"), question: i.question, answer: i.answer })),
      };
    case "location":
      return {
        ...base,
        type: "location",
        title: opt(section.title),
        address: input.address ?? opt(section.address),
        mapsQuery: opt(section.mapsQuery) ?? input.address ?? input.area,
        hours: section.hours?.map((h) => ({ id: newId("hr"), days: h.days, hours: h.hours })),
        note: opt(section.note),
      };
    case "contact":
      return { ...base, type: "contact", title: opt(section.title), body: opt(section.body) };
    case "cta":
      return { ...base, type: "cta", headline: section.headline, body: opt(section.body) };
  }
}

export function assembleSite(raw: AiSite, input: GenerationInput, language: Language, ctaLabel?: string): SiteContent {
  const category = CATEGORIES[input.category];
  const sections: Section[] = raw.sections.map((s) => convertSection(s, input));

  // Structural guarantees the renderer relies on.
  const heroIndex = sections.findIndex((s) => s.type === "hero");
  if (heroIndex === -1) {
    sections.unshift({ id: newId("sec"), enabled: true, type: "hero", headline: input.name, subheadline: input.tagline });
  } else if (heroIndex > 0) {
    const [hero] = sections.splice(heroIndex, 1);
    sections.unshift(hero);
  }
  if (input.offerings.length && !sections.some((s) => s.type === "offerings")) {
    const kind = input.category === "restaurant" ? "menu" : input.category === "car" ? "models" : "services";
    sections.splice(Math.min(2, sections.length), 0, {
      id: newId("sec"),
      enabled: true,
      type: "offerings",
      kind,
      title: category.offeringsLabel,
      items: input.offerings.map((o) => ({ id: o.id, name: o.name, price: o.price, image: o.image })),
    });
  }
  // Photos: the uploaded cover (business.heroImage) is the hero; without one the
  // first photo stands in, as before. Everything else forms the gallery.
  const hero = sections[0];
  if (hero.type === "hero") {
    hero.presentationMode ??= category.heroMode;
    if (!input.heroImage && input.photos[0]) hero.image = input.photos[0];
  }
  const gallery = input.heroImage ? input.photos : input.photos.slice(1);
  if (gallery.length) {
    const afterOfferings = sections.findIndex((s) => s.type === "offerings");
    const at = afterOfferings === -1 ? Math.min(2, sections.length) : afterOfferings + 1;
    sections.splice(at, 0, { id: newId("sec"), enabled: true, type: "gallery", images: gallery });
  }
  if (!sections.some((s) => s.type === "contact")) {
    sections.push({ id: newId("sec"), enabled: true, type: "contact" });
  }
  const ctaIndex = sections.findIndex((s) => s.type === "cta");
  if (ctaIndex === -1) {
    sections.push({ id: newId("sec"), enabled: true, type: "cta", headline: category.cta });
  } else if (ctaIndex !== sections.length - 1) {
    const [cta] = sections.splice(ctaIndex, 1);
    sections.push(cta);
  }
  // Reviews are never generated; cap total sections.
  const finalSections = sections.filter((s) => s.type !== "reviews").slice(0, 12);

  const content = {
    version: SITE_VERSION,
    language,
    business: {
      name: input.name,
      category: input.category,
      tagline: input.tagline ?? opt(raw.business.tagline),
      area: input.area ?? opt(raw.business.area),
      whatsapp: input.whatsapp,
      address: input.address,
      instagram: socialUrl("instagram", input.instagram) ?? undefined,
      facebook: socialUrl("facebook", input.facebook) ?? undefined,
      tiktok: socialUrl("tiktok", input.tiktok) ?? undefined,
      // The owner's uploads are authoritative; the model never sees or sets image URLs.
      profilePhoto: category.personLed ? input.profilePhoto : undefined,
      logo: category.personLed ? undefined : input.logo,
      heroImage: input.heroImage,
      heroImagePosition: input.heroImage ? input.heroImagePosition : undefined,
    },
    theme: { preset: raw.theme.preset ?? category.preset },
    cta: {
      // The understand step already produced the category CTA in the owner's language;
      // keep it rather than letting the writer re-translate it (e.g. "ujian pemanduan").
      label: opt(ctaLabel) ?? opt(raw.cta.label) ?? category.cta,
      kind: "whatsapp" as const,
      message: opt(raw.cta.message),
    },
    sections: finalSections,
  };
  return siteContentSchema.parse(content);
}
