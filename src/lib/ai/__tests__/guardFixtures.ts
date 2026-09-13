import { PRESET_IDS } from "@/lib/site/presets";
import type { GenerationInput, Understanding } from "@/lib/site/schema";
import type { AiSite, AiUnderstanding } from "../schemas";

/** Shared by guard.test.ts and guard.emulator.test.ts. */

export const DESCRIPTION = "Saya jual kereta Perodua dekat Balakong. Nama saya Amir.";

/** What a provider returns from understand(). */
export const AI_UNDERSTANDING: AiUnderstanding = {
  language: "ms",
  name: "Amir Perodua Balakong",
  category: "car",
  categoryConfidence: "high",
  tagline: "Kereta baru, loan senang",
  area: "Balakong",
  whatsapp: null,
  offerings: [{ name: "Perodua Myvi", price: null }],
  highlights: ["Boleh buat loan"],
  ctaLabel: "Book Test Drive",
  tone: "friendly",
  summary: "Sales advisor Perodua di Balakong yang bantu cari kereta baru dan loan.",
  instagram: null,
  facebook: null,
  tiktok: null,
} as AiUnderstanding;

/** What a provider returns from generate(). */
export const AI_SITE: AiSite = {
  language: "ms",
  business: { name: "Amir Perodua Balakong", tagline: null, area: "Balakong" },
  theme: { preset: PRESET_IDS[0] },
  cta: { label: "Book Test Drive", message: null },
  sections: [
    { type: "hero", headline: "Kereta Perodua baru di Balakong", subheadline: null, badge: null, presentationMode: null },
    { type: "contact", title: null, body: null },
    { type: "cta", headline: "Nak test drive?", body: null },
  ],
} as AiSite;

/** What the site stores after the understand step. */
export const UNDERSTANDING: Understanding = {
  language: "ms",
  name: "Amir Perodua Balakong",
  category: "car",
  categoryConfidence: "high",
  offerings: [],
  highlights: ["Boleh buat loan"],
  ctaLabel: "Book Test Drive",
  tone: "friendly",
  summary: "Sales advisor Perodua di Balakong.",
};

/** What the owner confirmed on the Confirm and Content screens. */
export const INPUT: GenerationInput = {
  category: "car",
  name: "Amir Perodua Balakong",
  whatsapp: "60123456789",
  area: "Balakong",
  offerings: [],
  photos: [],
};

/** A draft whose owner has pressed "Build my website". */
export function draftFields(ownerUid: string) {
  return {
    ownerUid,
    status: "draft",
    paid: false,
    paidAt: null,
    slug: null,
    published: null,
    publishedAt: null,
    draft: null,
    sourceDescription: DESCRIPTION,
    generation: { status: "generating", understanding: UNDERSTANDING, input: INPUT },
    language: "ms",
  };
}

/** A promise the test resolves when it chooses: holds a provider call open. */
export function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}
