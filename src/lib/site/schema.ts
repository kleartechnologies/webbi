/**
 * Site JSON v1 — the structured, editable content of one Webbi.
 *
 * This is the single source of truth for what a website *is*. The AI produces
 * it, the editor edits it, and the public renderer at /w/[slug] renders it.
 * No HTML/CSS is ever stored; sections are typed data.
 */
import { z } from "zod";
import { CATEGORY_IDS } from "./categories";
import { PRESET_IDS } from "./presets";

export const SITE_VERSION = 1 as const;

export const LANGUAGES = ["en", "ms", "mixed"] as const;
export type Language = (typeof LANGUAGES)[number];

const short = (max: number) => z.string().trim().max(max);
const id = z.string().min(1).max(40);

/** Malaysian mobile number as digits with country code, e.g. 60123456789. */
export const whatsappSchema = z
  .string()
  .regex(/^\d{9,15}$/, "Enter a valid mobile number");

export const imageSchema = z.object({
  url: z.url(),
  /** Firebase Storage object path (owner uploads only). */
  path: short(400).optional(),
  alt: short(200).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type SiteImage = z.infer<typeof imageSchema>;

export const OFFERING_KINDS = [
  "products",
  "services",
  "packages",
  "menu",
  "models",
  "listings",
  "subjects",
  "classes",
  "treatments",
] as const;
export type OfferingKind = (typeof OFFERING_KINDS)[number];

export const offeringItemSchema = z.object({
  id,
  name: short(80).min(1),
  description: short(300).optional(),
  /** Free text so "RM12", "from RM89,900" and "Call for price" all work. */
  price: short(40).optional(),
  tag: short(24).optional(),
  image: imageSchema.optional(),
});
export type OfferingItem = z.infer<typeof offeringItemSchema>;

const sectionBase = { id, enabled: z.boolean().default(true) };

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("hero"),
  headline: short(90).min(1),
  subheadline: short(220).optional(),
  badge: short(40).optional(),
  image: imageSchema.optional(),
});

export const aboutSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("about"),
  title: short(60).optional(),
  body: z.array(short(700)).min(1).max(4),
  highlights: z.array(short(60)).max(6).optional(),
});

export const offeringsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("offerings"),
  kind: z.enum(OFFERING_KINDS),
  title: short(60).min(1),
  note: short(160).optional(),
  items: z.array(offeringItemSchema).max(40),
});

export const highlightsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("highlights"),
  title: short(60).optional(),
  items: z
    .array(
      z.object({
        id,
        icon: short(40).optional(),
        title: short(50).min(1),
        text: short(160).optional(),
      }),
    )
    .max(6),
});

export const gallerySectionSchema = z.object({
  ...sectionBase,
  type: z.literal("gallery"),
  title: short(60).optional(),
  images: z.array(imageSchema).max(24),
});

export const reviewsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("reviews"),
  title: short(60).optional(),
  items: z
    .array(
      z.object({
        id,
        name: short(60).min(1),
        text: short(400).min(1),
        rating: z.number().int().min(1).max(5).optional(),
        source: short(40).optional(),
      }),
    )
    .max(12),
});

export const faqSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("faq"),
  title: short(60).optional(),
  items: z
    .array(z.object({ id, question: short(160).min(1), answer: short(600).min(1) }))
    .max(12),
});

export const locationSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("location"),
  title: short(60).optional(),
  address: short(240).optional(),
  /** Text used for the Google Maps link when there is no exact address. */
  mapsQuery: short(240).optional(),
  hours: z.array(z.object({ id, days: short(40).min(1), hours: short(40).min(1) })).max(7).optional(),
  note: short(160).optional(),
});

export const contactSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("contact"),
  title: short(60).optional(),
  body: short(200).optional(),
});

export const ctaSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("cta"),
  headline: short(90).min(1),
  body: short(200).optional(),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  aboutSectionSchema,
  offeringsSectionSchema,
  highlightsSectionSchema,
  gallerySectionSchema,
  reviewsSectionSchema,
  faqSectionSchema,
  locationSectionSchema,
  contactSectionSchema,
  ctaSectionSchema,
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

export const businessSchema = z.object({
  name: short(80).min(1),
  category: z.enum(CATEGORY_IDS),
  tagline: short(120).optional(),
  /** Town / city / area served, e.g. "Kajang" or "Klang Valley". */
  area: short(80).optional(),
  whatsapp: whatsappSchema.optional(),
  phone: short(24).optional(),
  email: z.email().optional(),
  address: short(240).optional(),
  instagram: short(120).optional(),
  facebook: short(120).optional(),
  tiktok: short(120).optional(),
});
export type Business = z.infer<typeof businessSchema>;

export const CTA_KINDS = ["whatsapp", "call", "email", "link"] as const;

export const ctaSchema = z.object({
  label: short(40).min(1),
  kind: z.enum(CTA_KINDS),
  /** Pre-filled WhatsApp message. */
  message: short(300).optional(),
  href: z.url().optional(),
});
export type Cta = z.infer<typeof ctaSchema>;

export const themeSchema = z.object({
  preset: z.enum(PRESET_IDS),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export type Theme = z.infer<typeof themeSchema>;

export const siteContentSchema = z.object({
  version: z.literal(SITE_VERSION),
  language: z.enum(LANGUAGES),
  business: businessSchema,
  theme: themeSchema,
  cta: ctaSchema,
  sections: z.array(sectionSchema).min(1).max(12),
});
export type SiteContent = z.infer<typeof siteContentSchema>;

/** Output of the "AI understands" step, shown on the Confirm screen. */
export const understandingSchema = z.object({
  language: z.enum(LANGUAGES),
  name: short(80),
  category: z.enum(CATEGORY_IDS),
  categoryConfidence: z.enum(["high", "medium", "low"]),
  tagline: short(120).optional(),
  area: short(80).optional(),
  whatsapp: whatsappSchema.optional(),
  /** Things the business sells or offers, exactly as mentioned (prices only if stated). */
  offerings: z.array(z.object({ name: short(80).min(1), price: short(40).optional() })).max(16),
  /** Selling points mentioned by the owner (never invented). */
  highlights: z.array(short(80)).max(6),
  ctaLabel: short(40),
  tone: z.enum(["friendly", "premium", "professional", "playful"]),
  /** One-sentence summary in the owner's language. */
  summary: short(300),
});
export type Understanding = z.infer<typeof understandingSchema>;

/** What the owner confirmed/added on the Confirm and Content screens. */
export const generationInputSchema = z.object({
  category: z.enum(CATEGORY_IDS),
  name: short(80).min(1),
  tagline: short(120).optional(),
  whatsapp: whatsappSchema,
  area: short(80).optional(),
  address: short(240).optional(),
  hours: short(120).optional(),
  instagram: short(120).optional(),
  facebook: short(120).optional(),
  tiktok: short(120).optional(),
  offerings: z
    .array(z.object({ id, name: short(80).min(1), price: short(40).optional(), image: imageSchema.optional() }))
    .max(40),
  photos: z.array(imageSchema).max(24),
});
export type GenerationInput = z.infer<typeof generationInputSchema>;

export function newId(prefix = "s"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${rand}`;
}
