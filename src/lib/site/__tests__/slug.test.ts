import { describe, expect, it } from "vitest";
import { isReservedSlug, isValidSlug, slugify } from "../slug";

describe("slugify", () => {
  it("turns a business name into a readable URL-safe slug", () => {
    expect(slugify("Rasa Kampung Café")).toBe("rasa-kampung-cafe");
    expect(slugify("Hafiz Proton — Shah Alam")).toBe("hafiz-proton-shah-alam");
    expect(slugify("Ali & Sons Aircond")).toBe("ali-and-sons-aircond");
  });

  it("never leaves leading or trailing dashes, even after truncation", () => {
    expect(slugify("  --hello world--  ")).toBe("hello-world");
    const long = slugify("a".repeat(39) + " bcd");
    expect(long).toBe("a".repeat(39));
    expect(long.endsWith("-")).toBe(false);
  });

  it("produces slugs that pass validation", () => {
    for (const name of ["Kedai Runcit Mak Cik", "SejukTech 24/7", "Dr. Lim's Klinik"]) {
      expect(isValidSlug(slugify(name))).toBe(true);
    }
  });
});

describe("isValidSlug", () => {
  it("accepts 3–40 char lowercase slugs with inner dashes", () => {
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("hafiz-proton-2")).toBe(true);
    expect(isValidSlug("a".repeat(40))).toBe(true);
  });

  it("rejects short, capitalised, spaced or dash-edged slugs", () => {
    for (const bad of ["ab", "Hafiz", "hafiz proton", "-hafiz", "hafiz-", "a".repeat(41), "héllo"]) {
      expect(isValidSlug(bad)).toBe(false);
    }
  });
});

describe("isReservedSlug", () => {
  it("blocks app routes and the example sites", () => {
    for (const slug of ["dashboard", "api", "signin", "demo", "rasa-kampung"]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
    expect(isReservedSlug("hafiz-proton")).toBe(false);
  });
});
