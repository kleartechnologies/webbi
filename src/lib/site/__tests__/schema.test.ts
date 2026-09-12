import { describe, expect, it } from "vitest";
import { siteContentSchema, whatsappSchema } from "../schema";
import { DEMO_SITES, DEMO_SLUGS } from "../demo";
import { isReservedSlug, isValidSlug } from "../slug";
import { mapsUrl, safeUrl, telUrl, whatsappUrl } from "../links";

describe("demo sites", () => {
  it("every built-in demo validates against the site content schema", () => {
    for (const slug of DEMO_SLUGS) {
      const parsed = siteContentSchema.safeParse(DEMO_SITES[slug]);
      expect(parsed.success, `${slug}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
    }
  });

  it("demo slugs are valid, reserved (so customers can't claim them), and not all restaurants", () => {
    const categories = new Set<string>();
    for (const slug of DEMO_SLUGS) {
      expect(isValidSlug(slug)).toBe(true);
      expect(isReservedSlug(slug)).toBe(true);
      categories.add(DEMO_SITES[slug].business.category);
    }
    expect(categories.size).toBeGreaterThan(1);
  });
});

describe("siteContentSchema", () => {
  const valid = DEMO_SITES[DEMO_SLUGS[0]];

  it("rejects unknown categories, presets and section types", () => {
    expect(siteContentSchema.safeParse({ ...valid, business: { ...valid.business, category: "spaceship" } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...valid, theme: { preset: "neon" } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...valid, sections: [{ id: "x", type: "iframe", html: "<script>" }] }).success).toBe(false);
  });

  it("requires at least one section and caps at twelve", () => {
    expect(siteContentSchema.safeParse({ ...valid, sections: [] }).success).toBe(false);
    const thirteen = Array.from({ length: 13 }, (_, i) => ({ ...valid.sections[0], id: `s${i}` }));
    expect(siteContentSchema.safeParse({ ...valid, sections: thirteen }).success).toBe(false);
  });

  it("only accepts http(s) or root-relative image URLs", () => {
    const withPhoto = (url: string) => ({ ...valid, gallery: undefined, sections: [...valid.sections, { id: "g1", type: "gallery", images: [{ url }] }] });
    expect(siteContentSchema.safeParse(withPhoto("https://firebasestorage.googleapis.com/v0/b/x/o/y.jpg?alt=media")).success).toBe(true);
    expect(siteContentSchema.safeParse(withPhoto("http://127.0.0.1:9199/v0/b/x/o/y.jpg")).success).toBe(true);
    expect(siteContentSchema.safeParse(withPhoto("/demo/rasa-kampung/hero.jpg")).success).toBe(true);
    expect(siteContentSchema.safeParse(withPhoto("javascript:alert(1)")).success).toBe(false);
    expect(siteContentSchema.safeParse(withPhoto("data:image/svg+xml;base64,AAAA")).success).toBe(false);
    expect(siteContentSchema.safeParse(withPhoto("//evil.example/x.jpg")).success).toBe(false);
  });

  it("accepts an optional profile photo on the business and rejects unsafe photo URLs", () => {
    const photo = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/me.webp?alt=media", path: "users/u1/sites/s1/me.webp", alt: "Amir" };
    expect(siteContentSchema.safeParse({ ...valid, business: { ...valid.business, profilePhoto: photo } }).success).toBe(true);
    expect(siteContentSchema.safeParse({ ...valid, business: { ...valid.business, profilePhoto: undefined } }).success).toBe(true);
    expect(siteContentSchema.safeParse({ ...valid, business: { ...valid.business, profilePhoto: { url: "javascript:alert(1)" } } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...valid, business: { ...valid.business, profilePhoto: { url: "//evil.example/x.jpg" } } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...valid, business: { ...valid.business, profilePhoto: "https://x/y.jpg" } }).success).toBe(false);
  });

  it("existing sites without a profile photo keep validating unchanged", () => {
    for (const slug of DEMO_SLUGS) expect(DEMO_SITES[slug].business.profilePhoto).toBeUndefined();
    expect(siteContentSchema.safeParse(valid).success).toBe(true);
  });

  it("only accepts a hex accent colour", () => {
    expect(siteContentSchema.safeParse({ ...valid, theme: { ...valid.theme, accent: "#C8102E" } }).success).toBe(true);
    expect(siteContentSchema.safeParse({ ...valid, theme: { ...valid.theme, accent: "red" } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...valid, theme: { ...valid.theme, accent: "url(x)" } }).success).toBe(false);
  });
});

describe("whatsappSchema", () => {
  it("accepts international digits only", () => {
    expect(whatsappSchema.safeParse("60123456789").success).toBe(true);
    expect(whatsappSchema.safeParse("012-345 6789").success).toBe(false);
    expect(whatsappSchema.safeParse("call me").success).toBe(false);
    expect(whatsappSchema.safeParse("12").success).toBe(false);
  });
});

describe("links", () => {
  it("builds wa.me and tel links from any formatting", () => {
    expect(whatsappUrl("+60 12-345 6789")).toBe("https://wa.me/60123456789");
    expect(whatsappUrl("60123456789", "Hi, I'd like a test drive")).toBe(
      "https://wa.me/60123456789?text=Hi%2C%20I'd%20like%20a%20test%20drive",
    );
    expect(telUrl("012-345 6789")).toBe("tel:+0123456789");
  });

  it("builds a Google Maps search from any address text, encoded", () => {
    expect(mapsUrl("No. 9257C, Jalan Balakong, 43300 Balakong, Selangor")).toBe(
      "https://www.google.com/maps/search/?api=1&query=No.%209257C%2C%20Jalan%20Balakong%2C%2043300%20Balakong%2C%20Selangor",
    );
    expect(mapsUrl("Kajang")).toBe("https://www.google.com/maps/search/?api=1&query=Kajang");
    expect(mapsUrl("a&b=c#d")).toBe("https://www.google.com/maps/search/?api=1&query=a%26b%3Dc%23d");
  });

  it("only renders http(s) URLs as links", () => {
    expect(safeUrl("https://instagram.com/hafizproton")).toBe("https://instagram.com/hafizproton");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});
