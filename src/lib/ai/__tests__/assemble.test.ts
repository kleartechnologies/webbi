import { describe, expect, it } from "vitest";
import type { GenerationInput } from "@/lib/site/schema";
import { assembleSite, normalizeMyPhone } from "../assemble";
import { mockProvider } from "../mock";

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
});
