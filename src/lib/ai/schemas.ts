/**
 * Output schemas for the AI provider. These are deliberately *looser* than the
 * canonical Site JSON (nullable instead of optional, no ids, no image URLs):
 * the model never sees or invents URLs or ids — assemble.ts adds those.
 */
import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/site/categories";
import { PRESET_IDS } from "@/lib/site/presets";
import { LANGUAGES, OFFERING_KINDS } from "@/lib/site/schema";

const s = (max: number) => z.string().max(max);

export const HIGHLIGHT_ICONS = [
  "verified",
  "schedule",
  "restaurant",
  "directions_car",
  "payments",
  "handyman",
  "star",
  "favorite",
  "bolt",
  "workspace_premium",
  "group",
  "near_me",
  "event_available",
  "spa",
  "school",
  "photo_camera",
  "fitness_center",
  "home",
  "public",
  "cleaning_services",
  "translate",
  "thumb_up",
  "task_alt",
  "celebration",
  "medical_services",
  "sell",
  "shopping_bag",
  "storefront",
  "receipt_long",
  "key",
  "map",
  "location_on",
  "call",
  "chat",
  "request_quote",
  "emoji_events",
  "design_services",
  "construction",
  "brush",
  "pets",
  "child_care",
  "laptop_mac",
  "palette",
  "local_florist",
] as const;

export const aiUnderstandingSchema = z.object({
  language: z.enum(LANGUAGES),
  name: s(80),
  category: z.enum(CATEGORY_IDS),
  categoryConfidence: z.enum(["high", "medium", "low"]),
  tagline: s(120).nullable(),
  area: s(80).nullable(),
  whatsapp: s(24).nullable(),
  offerings: z.array(z.object({ name: s(80), price: s(40).nullable() })).max(16),
  highlights: z.array(s(80)).max(6),
  ctaLabel: s(40),
  tone: z.enum(["friendly", "premium", "professional", "playful"]),
  summary: s(300),
});
export type AiUnderstanding = z.infer<typeof aiUnderstandingSchema>;

const aiOfferingItem = z.object({
  name: s(80),
  description: s(300).nullable(),
  price: s(40).nullable(),
  tag: s(24).nullable(),
});

export const aiSectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    headline: s(90),
    subheadline: s(220).nullable(),
    badge: s(40).nullable(),
  }),
  z.object({
    type: z.literal("about"),
    title: s(60).nullable(),
    body: z.array(s(700)).min(1).max(3),
    highlights: z.array(s(60)).max(6).nullable(),
  }),
  z.object({
    type: z.literal("offerings"),
    kind: z.enum(OFFERING_KINDS),
    title: s(60),
    note: s(160).nullable(),
    items: z.array(aiOfferingItem).max(40),
  }),
  z.object({
    type: z.literal("highlights"),
    title: s(60).nullable(),
    items: z
      .array(z.object({ icon: z.enum(HIGHLIGHT_ICONS).nullable(), title: s(50), text: s(160).nullable() }))
      .max(6),
  }),
  z.object({
    type: z.literal("faq"),
    title: s(60).nullable(),
    items: z.array(z.object({ question: s(160), answer: s(600) })).max(8),
  }),
  z.object({
    type: z.literal("location"),
    title: s(60).nullable(),
    address: s(240).nullable(),
    mapsQuery: s(240).nullable(),
    hours: z.array(z.object({ days: s(40), hours: s(40) })).max(7).nullable(),
    note: s(160).nullable(),
  }),
  z.object({
    type: z.literal("contact"),
    title: s(60).nullable(),
    body: s(200).nullable(),
  }),
  z.object({
    type: z.literal("cta"),
    headline: s(90),
    body: s(200).nullable(),
  }),
]);
export type AiSection = z.infer<typeof aiSectionSchema>;

export const aiSiteSchema = z.object({
  language: z.enum(LANGUAGES),
  business: z.object({
    name: s(80),
    tagline: s(120).nullable(),
    area: s(80).nullable(),
  }),
  theme: z.object({ preset: z.enum(PRESET_IDS) }),
  cta: z.object({
    label: s(40),
    /** Pre-filled WhatsApp message in the owner's language. */
    message: s(300).nullable(),
  }),
  sections: z.array(aiSectionSchema).min(3).max(10),
});
export type AiSite = z.infer<typeof aiSiteSchema>;
