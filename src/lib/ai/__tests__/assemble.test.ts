import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/site/categories";
import type { GenerationInput } from "@/lib/site/schema";
import { assembleSite, normalizeMyPhone, resolvePresentationMode, toUnderstanding } from "../assemble";
import { mockProvider } from "../mock";
import { toOpenAiStrictSchema } from "../openaiSchema";
import { aiSiteSchema, aiUnderstandingSchema, type AiUnderstanding } from "../schemas";

describe("normalizeMyPhone", () => {
  it("turns common Malaysian formats into international digits", () => {
    expect(normalizeMyPhone("012-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("+60 12 345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("60123456789")).toBe("60123456789");
    expect(normalizeMyPhone("123456789")).toBe("60123456789");
  });
  it("returns undefined for empty or nonsensical input", () => {
    expect(normalizeMyPhone("")).toBeUndefined();
    expect(normalizeMyPhone(null)).toBeUndefined();
    expect(normalizeMyPhone("call me")).toBeUndefined();
    expect(normalizeMyPhone("12")).toBeUndefined();
  });
});

describe("assembleSite", () => {
  const input: GenerationInput = { category: "car", name: "Amir", whatsapp: "60123456789", offerings: [], photos: [] };
  const req = { description: "Saya jual kereta Perodua dekat Balakong, WhatsApp untuk book test drive.", language: "ms" as const, input };
  const photo = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/amir.webp?alt=media", path: "users/u1/sites/s1/amir.webp", width: 800, height: 800 };

  it("carries the profile photo into a person-led site and leaves it out of a business-led one", async () => {
    process.env.AI_MOCK_DELAY_MS = "0";
    const car = { ...input, profilePhoto: photo };
    expect(assembleSite(await mockProvider.generate({ ...req, input: car }), car, "ms").business.profilePhoto).toEqual(photo);
    expect(assembleSite(await mockProvider.generate(req), input, "ms").business.profilePhoto).toBeUndefined();
    const restaurant: GenerationInput = { ...car, category: "restaurant", name: "Warung Mak Nah" };
    const site = assembleSite(await mockProvider.generate({ ...req, input: restaurant }), restaurant, "ms");
    expect(site.business.profilePhoto).toBeUndefined();
  });

  it("puts the confirmed address on the business and the location section, and falls back to the area for the map", async () => {
    process.env.AI_MOCK_DELAY_MS = "0";
    const address = "No. 9257C, Jalan Balakong, 43300 Balakong, Selangor (berdekatan kawasan Amerin Mall)";
    const withAddress = { ...input, area: "Balakong", address };
    const site = assembleSite(await mockProvider.generate({ ...req, input: withAddress }), withAddress, "ms");
    expect(site.business.address).toBe(address);
    const location = site.sections.find((s) => s.type === "location");
    expect(location && location.type === "location" ? location.address : undefined).toBe(address);
    const areaOnly = { ...input, area: "Balakong" };
    const site2 = assembleSite(await mockProvider.generate({ ...req, input: areaOnly }), areaOnly, "ms");
    const location2 = site2.sections.find((s) => s.type === "location");
    expect(location2 && location2.type === "location" ? location2.mapsQuery : undefined).toBe("Balakong");
    expect(site2.business.address).toBeUndefined();
  });

  it("keeps the CTA label from the understand step instead of the writer's re-translation", async () => {
    process.env.AI_MOCK_DELAY_MS = "0";
    const raw = await mockProvider.generate(req);
    expect(assembleSite(raw, input, "ms", "Tempah Test Drive").cta.label).toBe("Tempah Test Drive");
    expect(assembleSite(raw, input, "ms").cta.label).toBe(raw.cta.label);
    expect(assembleSite(raw, input, "ms", "   ").cta.label).toBe(raw.cta.label);
  });

  const cover = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/cover.webp?alt=media", path: "users/u1/sites/s1/cover.webp", width: 1600, height: 900 };
  const logo = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp?alt=media", path: "users/u1/sites/s1/logo.webp", width: 1000, height: 1000 };
  const p1 = { ...photo, url: "https://firebasestorage.googleapis.com/v0/b/x/o/p1.webp?alt=media", path: "users/u1/sites/s1/p1.webp" };
  const p2 = { ...photo, url: "https://firebasestorage.googleapis.com/v0/b/x/o/p2.webp?alt=media", path: "users/u1/sites/s1/p2.webp" };
  const gen = async (i: GenerationInput) => {
    process.env.AI_MOCK_DELAY_MS = "0";
    return assembleSite(await mockProvider.generate({ ...req, input: i }), i, "ms");
  };
  const heroOf = (site: Awaited<ReturnType<typeof gen>>) => site.sections.find((s) => s.type === "hero")!;
  const galleryOf = (site: Awaited<ReturnType<typeof gen>>) => site.sections.find((s) => s.type === "gallery");

  it("hero image upload: the cover goes on the business with its focus, the hero keeps no legacy image, every photo lands in the gallery", async () => {
    const site = await gen({ ...input, heroImage: cover, heroImagePosition: "top", photos: [p1, p2] });
    expect(site.business.heroImage).toEqual(cover);
    expect(site.business.heroImagePosition).toBe("top");
    const hero = heroOf(site);
    expect(hero.type === "hero" ? hero.image : "wrong").toBeUndefined();
    expect(galleryOf(site)?.type === "gallery" ? galleryOf(site)!.images : []).toEqual([p1, p2]);
    // A focus without a cover is meaningless and is dropped.
    expect((await gen({ ...input, heroImagePosition: "bottom" })).business.heroImagePosition).toBeUndefined();
  });

  it("without a cover the first photo still stands in as the hero (sites built before Phase 12 keep working)", async () => {
    const site = await gen({ ...input, photos: [p1, p2] });
    expect(site.business.heroImage).toBeUndefined();
    const hero = heroOf(site);
    expect(hero.type === "hero" ? hero.image : undefined).toEqual(p1);
    expect(galleryOf(site)?.type === "gallery" ? galleryOf(site)!.images : []).toEqual([p2]);
    expect(galleryOf(await gen(input))).toBeUndefined();
  });

  it("business logo only for business-led categories, profile photo only for person-led ones", async () => {
    const restaurant: GenerationInput = { ...input, category: "restaurant", name: "Warung Mak Nah", logo, profilePhoto: photo };
    const r = await gen(restaurant);
    expect(r.business.logo).toEqual(logo);
    expect(r.business.profilePhoto).toBeUndefined();
    const c = await gen({ ...input, logo, profilePhoto: photo });
    expect(c.business.logo).toBeUndefined();
    expect(c.business.profilePhoto).toEqual(photo);
  });

  it("hero presentation mode: the category default unless the model picks one that fits", async () => {
    expect(resolvePresentationMode(null, CATEGORIES.car)).toBe("person");
    expect(resolvePresentationMode(undefined, CATEGORIES.restaurant)).toBe("visual");
    expect(resolvePresentationMode("service", CATEGORIES.car)).toBe("service");
    expect(resolvePresentationMode("visual", CATEGORIES.homeServices)).toBe("visual");
    expect(resolvePresentationMode("person", CATEGORIES.restaurant)).toBe("visual");
    expect(resolvePresentationMode("property", CATEGORIES.car)).toBe("person");
    expect(resolvePresentationMode("property", CATEGORIES.property)).toBe("property");
    const hero = heroOf(await gen(input));
    expect(hero.type === "hero" ? hero.presentationMode : undefined).toBe("person");
    const contractor = heroOf(await gen({ ...input, category: "homeServices", name: "Zul Renovation" }));
    expect(contractor.type === "hero" ? contractor.presentationMode : undefined).toBe("service");
  });

  it("AI output cannot overwrite the owner's uploaded image URLs", async () => {
    // The strict schema the model is asked for has no image or URL fields at all.
    const asked = JSON.stringify(toOpenAiStrictSchema(aiSiteSchema));
    expect(asked).not.toMatch(/"(url|image|images|photos|heroImage|logo|profilePhoto)"/);
    // Anything image-shaped the model returns anyway is stripped before assembly.
    const raw = await mockProvider.generate({ ...req, input: { ...input, heroImage: cover } });
    const hero = raw.sections[0];
    const tampered = { ...raw, sections: [{ ...hero, image: { url: "https://evil.example/x.jpg" } }, ...raw.sections.slice(1)] };
    const parsed = aiSiteSchema.parse(tampered);
    expect("image" in parsed.sections[0]).toBe(false);
    const site = assembleSite(parsed, { ...input, heroImage: cover, profilePhoto: photo }, "ms");
    expect(site.business.heroImage).toEqual(cover);
    expect(site.business.profilePhoto).toEqual(photo);
    expect(JSON.stringify(site)).not.toContain("evil.example");
  });

  const rawUnderstanding = (patch: Partial<AiUnderstanding>): AiUnderstanding => ({
    language: "ms",
    category: "car",
    categoryConfidence: "high",
    name: "Amir",
    tagline: null,
    area: "Balakong",
    whatsapp: null,
    offerings: [],
    highlights: [],
    ctaLabel: "WhatsApp saya",
    tone: "friendly",
    summary: "Sales advisor Perodua di Balakong.",
    instagram: null,
    facebook: null,
    tiktok: null,
    ...patch,
  });

  it("AI cannot invent social accounts: a handle is kept only when it normalises to a safe profile URL, stored as that URL", () => {
    const u = toUnderstanding(rawUnderstanding({ instagram: "@amir.perodua", facebook: "ABC Kitchen", tiktok: "javascript:alert(1)" }));
    expect(u.instagram).toBe("https://www.instagram.com/amir.perodua/");
    expect(u.facebook).toBeUndefined();
    expect(u.tiktok).toBeUndefined();
    const none = toUnderstanding(rawUnderstanding({}));
    expect(none.instagram).toBeUndefined();
    expect(none.facebook).toBeUndefined();
    expect(none.tiktok).toBeUndefined();
    // Both provider schemas carry the fields as nullable strings, never URLs the model composes.
    expect(aiUnderstandingSchema.parse(rawUnderstanding({ facebook: "facebook.com/abckitchen" })).facebook).toBe("facebook.com/abckitchen");
  });

  it("mock understand extracts handles only where the owner wrote them, never from the business name", async () => {
    process.env.AI_MOCK_DELAY_MS = "0";
    const written = await mockProvider.understand({ description: "Saya Amir, sales advisor Perodua di Balakong. Instagram saya @amir.perodua, TikTok: @amir.perodua. Facebook: facebook.com/amirperodua" });
    expect(written.instagram).toBe("@amir.perodua");
    expect(written.tiktok).toBe("@amir.perodua");
    expect(written.facebook).toBe("facebook.com/amirperodua");
    const notWritten = await mockProvider.understand({ description: "Kedai ABC Kitchen di Kajang jual nasi lemak. Email kami abc@kitchen.com. Facebook: ABC Kitchen" });
    expect(notWritten.instagram).toBeNull();
    expect(notWritten.facebook).toBeNull();
    expect(notWritten.tiktok).toBeNull();
  });
});
