import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { LANDING_DESCRIPTION, LANDING_METADATA, LANDING_STRUCTURED_DATA, LANDING_TITLE, legalMetadata, OFFICIAL_ORIGIN } from "@/lib/seo";

const ORIGIN = "https://webbi.online";

describe("official site SEO", () => {
  it("indexes the landing under its agreed title, canonical and description", () => {
    expect(OFFICIAL_ORIGIN).toBe(ORIGIN);
    expect(LANDING_METADATA.title).toEqual({ absolute: "Webbi — Websites for Malaysian Businesses" });
    expect(LANDING_METADATA.alternates?.canonical).toBe(ORIGIN);
    expect(LANDING_METADATA.robots).toEqual({ index: true, follow: true });
    expect(LANDING_DESCRIPTION).toContain("website builder for Malaysian businesses");
    expect(LANDING_DESCRIPTION.length).toBeGreaterThanOrEqual(70);
    expect(LANDING_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("shares with webbi.online URLs only", () => {
    const og = LANDING_METADATA.openGraph as { url: string; images: { url: string }[] };
    const twitter = LANDING_METADATA.twitter as { card: string; images: string[] };
    expect(og.url).toBe(ORIGIN);
    expect(og.images[0].url).toBe(`${ORIGIN}/og-image.png`);
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.images).toEqual([`${ORIGIN}/og-image.png`]);
    expect(JSON.stringify([LANDING_METADATA, LANDING_STRUCTURED_DATA, robots(), sitemap()])).not.toMatch(/netlify|localhost/);
  });

  it("gives the Malay tab its own title, without changing what is indexed", () => {
    expect(LANDING_TITLE.ms).not.toBe(LANDING_TITLE.en);
    expect(LANDING_TITLE.ms.startsWith("Webbi")).toBe(true);
    expect(LANDING_TITLE.ms).not.toContain("—");
  });

  it("lets crawlers in and points them at the sitemap", () => {
    const { rules, sitemap: map } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(rule.disallow).not.toContain("/");
    expect(rule.disallow).toContain("/admin");
    expect(JSON.stringify(sitemap())).not.toContain("admin");
    expect(JSON.stringify(rule.disallow)).not.toContain("/w/");
    expect(map).toBe(`${ORIGIN}/sitemap.xml`);
  });

  it("lists exactly the official public pages", () => {
    expect(sitemap().map((e) => e.url)).toEqual([ORIGIN, `${ORIGIN}/privacy`, `${ORIGIN}/terms`]);
  });

  it("canonicalises the legal pages on webbi.online", () => {
    expect(legalMetadata("Terms of Service", "/terms").alternates?.canonical).toBe(`${ORIGIN}/terms`);
  });

  it("describes only the Webbi organisation and website, on the real domain", () => {
    const graph = LANDING_STRUCTURED_DATA["@graph"];
    expect(graph.map((n) => n["@type"])).toEqual(["Organization", "WebSite"]);
    expect(Object.keys(graph[0]).sort()).toEqual(["@id", "@type", "logo", "name", "url"]);
    for (const url of JSON.stringify(LANDING_STRUCTURED_DATA).match(/https?:\/\/[^"]+/g) ?? []) {
      if (url !== "https://schema.org") expect(url.startsWith(ORIGIN), url).toBe(true);
    }
  });
});
