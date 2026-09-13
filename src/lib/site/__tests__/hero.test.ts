import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_IDS } from "../categories";
import { DEMO_SITES } from "../demo";
import { HERO_BOUNDS, HERO_POSITION_CLASS, heroFrameOf, heroImageOf, heroModeOf, heroShapeOf, imageRatio, resolveHero } from "../hero";
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

describe("hero frame", () => {
  const frame = (width: number, height: number, mode: "visual" | "person" | "service" | "property") => heroFrameOf({ width, height }, mode);

  it("classifies a cover by its natural width ÷ height", () => {
    expect(heroShapeOf(3)).toBe("banner");
    expect(heroShapeOf(2.5)).toBe("banner");
    expect(heroShapeOf(21 / 9)).toBe("wide");
    expect(heroShapeOf(16 / 9)).toBe("wide");
    expect(heroShapeOf(1.6)).toBe("wide");
    expect(heroShapeOf(3 / 2)).toBe("landscape");
    expect(heroShapeOf(4 / 3)).toBe("landscape");
    expect(heroShapeOf(1.1)).toBe("square");
    expect(heroShapeOf(1)).toBe("square");
    expect(heroShapeOf(0.9)).toBe("square");
    expect(heroShapeOf(4 / 5)).toBe("portrait");
    expect(heroShapeOf(3 / 4)).toBe("portrait");
    expect(heroShapeOf(2 / 3)).toBe("portrait");
    expect(heroShapeOf(9 / 16)).toBe("tall");
    expect(heroShapeOf(0.4)).toBe("tall");
  });

  it("reads the ratio only from a recorded, sane size", () => {
    expect(imageRatio({})).toBeUndefined();
    expect(imageRatio({ width: 0, height: 100 })).toBeUndefined();
    expect(imageRatio({ width: 1600 })).toBeUndefined();
    expect(imageRatio({ width: 1600, height: 900 })).toBeCloseTo(16 / 9);
  });

  it("inside the bounds the frame takes the photo's own ratio, so nothing is cropped", () => {
    expect(frame(1600, 900, "person")).toMatchObject({ shape: "wide", mobile: "stack", desktop: "overlay", mobileRatio: 16 / 9, desktopRatio: 16 / 9 });
    // Too wide to carry the copy on a phone, even for a visual hero.
    expect(frame(1600, 900, "visual").mobile).toBe("stack");
    expect(frame(1400, 1054, "visual")).toMatchObject({ shape: "landscape", mobile: "stack", desktop: "split", mobileRatio: 1400 / 1054, desktopRatio: 1400 / 1054 });
    expect(frame(1080, 1080, "visual")).toMatchObject({ shape: "square", mobile: "overlay", desktop: "split", mobileRatio: 1, desktopRatio: 1 });
    expect(frame(1080, 1080, "person")).toMatchObject({ mobile: "stack", desktop: "split", mobileRatio: 1, desktopRatio: 1 });
    expect(frame(1080, 1350, "visual")).toMatchObject({ shape: "portrait", mobile: "overlay", desktop: "split", mobileRatio: 0.8, desktopRatio: 0.8 });
    expect(frame(1080, 1350, "service")).toMatchObject({ mobile: "stack", mobileRatio: 0.8 });
  });

  it("outside the bounds the crop is the smallest that keeps the hero usable; the desktop split never crops", () => {
    const tall = frame(1080, 1920, "visual");
    expect(tall).toMatchObject({ shape: "tall", mobile: "overlay", desktop: "split" });
    expect(tall.mobileRatio).toBeCloseTo(HERO_BOUNDS.mobileOverlay.min);
    expect(tall.desktopRatio).toBeCloseTo(9 / 16);
    expect(frame(1080, 1920, "property").mobileRatio).toBeCloseTo(HERO_BOUNDS.mobileStack.min);
    expect(frame(3000, 1000, "service")).toMatchObject({ shape: "banner", mobile: "stack", desktop: "overlay", mobileRatio: HERO_BOUNDS.mobileStack.max, desktopRatio: 3 });
    expect(frame(4000, 1000, "visual").desktopRatio).toBe(HERO_BOUNDS.desktopOverlay.max);
    // 16:10 is exactly the floor of the full-width backdrop; anything squarer sits beside the copy.
    expect(frame(1600, 1000, "visual").desktop).toBe("overlay");
    expect(frame(1500, 1000, "visual").desktop).toBe("split");
  });

  it("a photo without a recorded size is framed as the recommended 16:9, and resolveHero carries a frame exactly when it has an image", () => {
    expect(heroFrameOf({}, "visual")).toMatchObject({ ratio: undefined, shape: "wide", mobile: "stack", desktop: "overlay", mobileRatio: 16 / 9, desktopRatio: 16 / 9 });
    const site = car();
    heroOf(site).image = undefined;
    site.business.heroImage = undefined;
    expect(resolveHero(site, heroOf(site)).frame).toBeUndefined();
    site.business.heroImage = COVER;
    expect(resolveHero(site, heroOf(site)).frame).toMatchObject({ shape: "wide", ratio: 16 / 9, mobile: "stack", desktop: "overlay" });
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
