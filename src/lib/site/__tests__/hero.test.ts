import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_IDS } from "../categories";
import { DEMO_SITES } from "../demo";
import { HERO_POSITION_CLASS, heroImageOf, heroModeOf, resolveHero } from "../hero";
import { generationInputSchema, siteContentSchema, type SectionOf, type SiteContent } from "../schema";

const COVER = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/cover.webp?alt=media", path: "users/u1/sites/s1/cover.webp", width: 1600, height: 900 };
const LOGO = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp?alt=media", path: "users/u1/sites/s1/logo.webp", width: 1000, height: 1000 };
const car = (): SiteContent => structuredClone(DEMO_SITES["hafiz-rahman"]);
const heroOf = (site: SiteContent) => site.sections.find((s): s is SectionOf<"hero"> => s.type === "hero")!;

describe("hero resolver", () => {
  it("the uploaded cover wins over the legacy first photo; neither the logo nor the profile photo is ever the hero", () => {
    // The restaurant demo was built before Phase 12 and carries its cover as hero.image.
    const site = structuredClone(DEMO_SITES["rasa-kampung"]);
    const hero = heroOf(site);
    const legacy = hero.image;
    expect(legacy).toBeDefined();
    site.business.logo = LOGO;
    site.business.profilePhoto = LOGO;
    expect(heroImageOf(site, hero)).toEqual(legacy);
    site.business.heroImage = COVER;
    expect(heroImageOf(site, hero)).toEqual(COVER);
    hero.image = undefined;
    site.business.heroImage = undefined;
    expect(heroImageOf(site, hero)).toBeUndefined();
  });

  it("every category has a presentation mode and the section can override it", () => {
    for (const id of CATEGORY_IDS) expect(["visual", "person", "service", "property"]).toContain(CATEGORIES[id].heroMode);
    const site = car();
    expect(heroModeOf(site, heroOf(site))).toBe("person");
    heroOf(site).presentationMode = "service";
    expect(heroModeOf(site, heroOf(site))).toBe("service");
    site.business.category = "restaurant";
    expect(heroModeOf(site)).toBe("visual");
  });

  it("resolves the crop focus with centre as the default and a class for each position", () => {
    const site = car();
    expect(resolveHero(site, heroOf(site)).position).toBe("center");
    site.business.heroImagePosition = "top";
    expect(resolveHero(site, heroOf(site)).position).toBe("top");
    expect(HERO_POSITION_CLASS).toEqual({ center: "object-center", top: "object-top", bottom: "object-bottom" });
  });
});

describe("schema: hero image, logo, crop focus and socials", () => {
  it("existing Firestore documents without heroImage, logo or socials keep parsing unchanged", () => {
    for (const site of Object.values(DEMO_SITES)) {
      const parsed = siteContentSchema.parse(site);
      expect(parsed.business.heroImage).toBeUndefined();
      expect(parsed.business.logo).toBeUndefined();
      expect(parsed.business.heroImagePosition).toBeUndefined();
    }
  });

  it("accepts an optional cover, logo and crop focus, and rejects unsafe URLs or unknown positions", () => {
    const site = car();
    site.business.heroImage = COVER;
    site.business.logo = LOGO;
    site.business.heroImagePosition = "bottom";
    const parsed = siteContentSchema.parse(site);
    expect(parsed.business.heroImage).toEqual(COVER);
    expect(parsed.business.logo).toEqual(LOGO);
    expect(parsed.business.heroImagePosition).toBe("bottom");
    expect(siteContentSchema.safeParse({ ...site, business: { ...site.business, heroImage: { ...COVER, url: "javascript:alert(1)" } } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...site, business: { ...site.business, logo: { ...LOGO, url: "data:image/png;base64,AAAA" } } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...site, business: { ...site.business, heroImagePosition: "left" } }).success).toBe(false);
    heroOf(site).presentationMode = "property";
    expect(siteContentSchema.parse(site).sections[0]).toMatchObject({ type: "hero", presentationMode: "property" });
  });

  it("generation input carries the cover, logo and focus alongside the profile photo", () => {
    const input = generationInputSchema.parse({ category: "restaurant", name: "Warung Mak Nah", whatsapp: "60123456789", offerings: [], photos: [], logo: LOGO, heroImage: COVER, heroImagePosition: "top" });
    expect(input).toMatchObject({ logo: LOGO, heroImage: COVER, heroImagePosition: "top" });
    expect(generationInputSchema.safeParse({ category: "restaurant", name: "X", whatsapp: "60123456789", offerings: [], photos: [], heroImage: { url: "//evil.com/x.png" } }).success).toBe(false);
  });
});
