import { describe, expect, it } from "vitest";
import { BUSINESSES } from "@/components/landing/showcase/businesses";
import { CATEGORIES } from "@/lib/site/categories";
import { LANDING_COPY, type LandingCopy } from "../copy";

/** Samples every function in the dictionary so its output is checked like any other string. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") return strings((value as (...a: string[]) => unknown)("RM149.90", "webbi.online"), `${path}()`);
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

/** The key path of every leaf, with array lengths, so the two dictionaries can be compared by shape. */
function shape(copy: LandingCopy): string[] {
  return strings(copy).map(([path]) => path);
}

const BANNED = [
  "ai-powered", "ai website", "ai-generated", "powered by ai", "seamless", "effortless",
  "unlock", "elevate", "next-generation", "revolutionary", "revolutionize", "intelligent",
  "cutting-edge", "supercharge", "game-changing", "magic", "✨",
];

describe("landing copy", () => {
  it("has the same keys, lists and lengths in English and Bahasa Melayu", () => {
    expect(shape(LANDING_COPY.ms)).toEqual(shape(LANDING_COPY.en));
  });

  it.each(["en", "ms"] as const)("has no empty strings, em dashes or banned wording in %s", (lang) => {
    for (const [path, text] of strings(LANDING_COPY[lang])) {
      expect(text.trim(), path).not.toBe("");
      expect(text, path).not.toContain("—");
      for (const word of BANNED) expect(text.toLowerCase(), `${path} says "${word}"`).not.toContain(word);
    }
  });

  it("keeps the brand name and uses the agreed Malay CTA", () => {
    expect(LANDING_COPY.en.cta.create).toBe("Create My Website");
    expect(LANDING_COPY.ms.cta.create).toBe("Bina Website Saya");
    expect(LANDING_COPY.ms.moment.reads).toContain("Webbi");
  });

  it("names every showcase business in both languages", () => {
    for (const b of BUSINESSES) {
      expect(LANDING_COPY.en.showcase.subs[b.slug], b.slug).toBeTruthy();
      expect(LANDING_COPY.ms.showcase.subs[b.slug], b.slug).toBeTruthy();
    }
  });

  it("captions each showcase button, in English exactly as the product labels it", () => {
    for (const b of BUSINESSES) {
      const key = b.category as keyof LandingCopy["showcase"]["buttons"];
      expect(LANDING_COPY.en.showcase.buttons[key], b.category).toBe(CATEGORIES[b.category].cta);
      expect(LANDING_COPY.ms.showcase.buttons[key], b.category).toBeTruthy();
    }
  });

  // The tab titles live in src/lib/seo.ts with the rest of the search metadata; seo.test.ts checks them.
});
