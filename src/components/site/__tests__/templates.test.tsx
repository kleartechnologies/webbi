import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getCategory } from "@/lib/site/categories";
import { DEMO_SITES, DEMO_SLUGS } from "@/lib/site/demo";
import { PRESETS } from "@/lib/site/presets";
import type { SectionOf, SiteContent } from "@/lib/site/schema";
import { DEFAULT_TEMPLATE_ID, isTemplateId, resolveTemplateId, switchTemplate, TEMPLATE_IDS, type TemplateId } from "@/lib/site/templates";
import { SiteRenderer } from "../SiteRenderer";

/**
 * Five templates, one renderer. A template is presentation only: every one of
 * them renders every site, with the same content, links and safety rules, and
 * switching between them changes nothing but `theme.preset`.
 */

const COVER = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/cover.webp?alt=media", path: "users/u1/sites/s1/cover.webp", width: 1600, height: 900 };
const TALL = { ...COVER, width: 1080, height: 1920 };
const SQUARE = { ...COVER, width: 1080, height: 1080 };
const HOSTILE = `<script>alert(1)</script><img src=x onerror=alert(1)>`;
const ALLOWED = /^(https:\/\/|http:\/\/|tel:\+\d*$|mailto:|\/(?!\/)|#)/;
const LONG_WORD = "Supercalifragilisticexpialidociouslyextraordinarybusinessname";

const demo = (slug: string) => structuredClone(DEMO_SITES[slug]);
const as = (site: SiteContent, template: TemplateId): SiteContent => ({ ...site, theme: { ...site.theme, preset: template } });
const html = (site: SiteContent, mode: "public" | "preview" = "public") => renderToStaticMarkup(<SiteRenderer site={site} mode={mode} />);
const heroOf = (site: SiteContent) => site.sections.find((s): s is SectionOf<"hero"> => s.type === "hero")!;
const urls = (markup: string) => [...markup.matchAll(/\s(href|src|action|formaction|srcset)="([^"]*)"/gi)].map((m) => m[2].replace(/&amp;/g, "&"));
const heroHtml = (out: string) => {
  const attr = out.indexOf("data-hero-mode=");
  return attr === -1 ? "" : out.slice(out.lastIndexOf("<div", attr), out.indexOf("<section", attr));
};
const matrix = TEMPLATE_IDS.flatMap((template) => DEMO_SLUGS.map((slug) => [template, slug] as const));

describe("template ids", () => {
  it("are the five approved templates, each with its own tokens and font", () => {
    expect([...TEMPLATE_IDS].sort()).toEqual(["bold", "bright", "elegant", "trust", "warm"]);
    expect(new Set(TEMPLATE_IDS.map((id) => PRESETS[id].font)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(TEMPLATE_IDS.map((id) => PRESETS[id].accent)).size).toBe(5);
    expect(new Set(TEMPLATE_IDS.map((id) => PRESETS[id].ground)).size).toBe(5);
  });

  it("resolve a missing or unknown template to the category's, then to the default", () => {
    for (const id of TEMPLATE_IDS) expect(resolveTemplateId({ theme: { preset: id }, business: { category: "restaurant" } })).toBe(id);
    expect(resolveTemplateId({ theme: { preset: "neon" }, business: { category: "restaurant" } })).toBe("warm");
    expect(resolveTemplateId({ business: { category: "car" } })).toBe("bold");
    expect(resolveTemplateId({ theme: null, business: { category: "beauty" } })).toBe("elegant");
    expect(resolveTemplateId({ theme: { preset: "__proto__" }, business: { category: "homeServices" } })).toBe("trust");
    expect(resolveTemplateId({ theme: { preset: 3 } })).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplateId(null)).toBe(DEFAULT_TEMPLATE_ID);
    expect(isTemplateId("Warm")).toBe(false);
    expect(isTemplateId("toString")).toBe(false);
  });

  it("every category suggests a real template", () => {
    for (const category of ["restaurant", "car", "beauty", "homeServices", "photographer", "property", "tutor", "retail", "fitness", "professional", "creative", "health", "other"]) {
      expect(isTemplateId(getCategory(category).preset), category).toBe(true);
    }
  });
});

describe("section headings", () => {
  it("an untitled highlights section never repeats the About heading, in any template", () => {
    for (const template of TEMPLATE_IDS) {
      const site = as(demo("sejuktech"), template);
      const highlights = site.sections.find((s): s is SectionOf<"highlights"> => s.type === "highlights");
      expect(highlights, "sejuktech has a highlights section").toBeDefined();
      delete highlights!.title;
      const out = html(site);
      const start = out.indexOf(`id="s-${highlights!.id}"`);
      const block = out.slice(start, out.indexOf("</section>", start));
      // Trust's layout always carries a section label; the others simply show the items.
      if (template === "trust") expect(block, template).toContain("Why choose us");
      expect(block, template).not.toContain(">About<");
    }
  });
});

describe("switching template", () => {
  it("changes only theme.preset: content, sections, accent, CTA and images are the same objects", () => {
    const site = demo("rasa-kampung");
    site.theme.accent = "#0E6B63";
    site.theme.showCredit = false;
    const before = structuredClone(site);
    for (const id of TEMPLATE_IDS) {
      const next = switchTemplate(site, id);
      expect(next.theme.preset).toBe(id);
      expect({ ...next, theme: { ...next.theme, preset: "x" } }).toEqual({ ...before, theme: { ...before.theme, preset: "x" } });
      expect(next.business).toBe(site.business);
      expect(next.sections).toBe(site.sections);
      expect(next.cta).toBe(site.cta);
    }
    expect(site).toEqual(before); // the draft passed in is never mutated
  });

  it("ignores an unknown id and a no-op switch", () => {
    const site = demo("sereni");
    expect(switchTemplate(site, "neon")).toBe(site);
    expect(switchTemplate(site, undefined)).toBe(site);
    expect(switchTemplate(site, site.theme.preset)).toBe(site);
  });

  it("the editor's template picker only calls switchTemplate: no AI, payment, publish or site-creation code", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/(app)/s/[siteId]/edit/StyleTab.tsx"), "utf8");
    expect(source).toContain("update((d) => switchTemplate(d, id))");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) expect(spec).not.toMatch(/ai|payment|billing|publish|store|firebase|api|drafts|fetch/i);
    expect(source).not.toMatch(/fetch\(|\/api\/|regenerate|createSite|publish/i);
  });

  it("the switch module itself reaches nothing but categories and presets", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/site/templates.ts"), "utf8");
    expect([...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["./categories", "./presets"]);
  });
});

describe("every template renders every site", () => {
  it.each(matrix)("%s × %s: full page with the chosen template, one hero CTA, nothing unsafe", (template, slug) => {
    const site = as(demo(slug), template);
    const out = html(site);
    expect(out).toContain(`data-preset="${template}"`);
    expect(out).toContain("isolate");
    expect(out).toContain("<header");
    expect(out).toContain("<footer");
    expect(out).toContain("sticky bottom-0 z-20");
    expect(out.split("data-hero-cta").length - 1).toBe(1);
    for (const section of site.sections) {
      if (section.type === "hero") continue;
      if (section.type === "cta" || section.type === "contact" || section.type === "location") continue; // may render nothing without a destination
      expect(out, `${section.type} section`).toContain(`id="s-${section.id}"`);
    }
    expect(out).toContain(site.business.name.replace(/&/g, "&amp;"));
    expect(out).not.toMatch(/<script|dangerouslySetInnerHTML|javascript:/i);
    expect(out.replace(/="[^"]*"/g, '=""')).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i);
    for (const url of urls(out)) expect(url, url).toMatch(ALLOWED);
    for (const style of out.matchAll(/style="([^"]*)"/g)) expect(style[1]).not.toMatch(/url\(|expression|javascript/i);
  });

  it("the five templates produce five different pages from the same content", () => {
    for (const slug of DEMO_SLUGS) {
      const pages = TEMPLATE_IDS.map((id) => html(as(demo(slug), id)).replace(/data-preset="[a-z]+"/, "").replace(/--site-[a-z-]+:[^;"]+;?/g, ""));
      expect(new Set(pages).size, slug).toBe(5);
    }
  });

  it("is deterministic: rendering the same site twice gives identical markup in every template", () => {
    for (const id of TEMPLATE_IDS) expect(html(as(demo("hafiz-rahman"), id))).toBe(html(as(demo("hafiz-rahman"), id)));
  });

  it("falls back to the category's template when the stored one is missing or unknown", () => {
    const site = demo("sejuktech");
    expect(html({ ...site, theme: { preset: "neon" as TemplateId } })).toContain('data-preset="trust"');
    expect(html({ ...site, theme: undefined as unknown as SiteContent["theme"] })).toContain('data-preset="trust"');
    expect(html({ ...demo("rasa-kampung"), theme: { preset: "" as TemplateId } })).toContain('data-preset="warm"');
  });
});

describe("links and text are safe in every template", () => {
  it.each(TEMPLATE_IDS)("%s: hostile text is escaped and unsafe link schemes render as nothing clickable", (template) => {
    for (const unsafe of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)"]) {
      const site = as(demo("hafiz-rahman"), template);
      site.business.name = HOSTILE;
      site.business.tagline = HOSTILE;
      site.business.address = HOSTILE;
      site.business.phone = unsafe;
      site.business.instagram = unsafe;
      site.business.facebook = unsafe;
      site.cta = { ...site.cta, kind: "link", label: "Go", href: unsafe };
      const out = html(site);
      // The hostile string survives only as escaped text: no real tag, and no attribute named on*.
      expect(out).not.toMatch(/<script|<img src=x/i);
      expect(out.replace(/="[^"]*"/g, '=""')).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i);
      expect(out).toContain("&lt;script&gt;");
      for (const url of urls(out)) expect(url, url).toMatch(ALLOWED);
      // A rejected value may still show as escaped text; it never becomes an attribute a browser would follow.
      expect(out).not.toMatch(/="\s*(javascript|vbscript|data):/i);
    }
  });

  it.each(TEMPLATE_IDS)("%s: WhatsApp, call, email and Maps links keep their safe shapes and new-tab rel", (template) => {
    const site = as(demo("sejuktech"), template);
    site.business.email = "hello@example.com";
    const out = html(site);
    expect(out).toMatch(/href="https:\/\/wa\.me\/\d+/);
    expect(out).toMatch(/href="tel:\+\d+"/);
    expect(out).toContain('href="mailto:hello@example.com"');
    for (const a of out.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) expect(a[0]).toContain('rel="noreferrer noopener"');
    if (out.includes("<iframe")) expect(out).toMatch(/<iframe[^>]*src="https:\/\/www\.google\.com\/maps\?/);
    expect(html(site, "preview")).not.toContain("<iframe");
  });
});

describe("hero images across templates", () => {
  it.each(TEMPLATE_IDS)("%s: the cover shows once, keeps object-cover and its focus, and frames wide / square / tall photos", (template) => {
    for (const [image, layout] of [[COVER, "overlay"], [SQUARE, "split"], [TALL, "split"]] as const) {
      const site = as(demo("rasa-kampung"), template);
      site.business.heroImage = image;
      site.business.heroImagePosition = "top";
      heroOf(site).image = undefined;
      const hero = heroHtml(html(site));
      expect(hero.match(/<img[^>]*cover\.webp/g)?.length).toBe(1);
      expect(hero).toMatch(/<img[^>]*object-cover[^>]*object-top|<img[^>]*object-top[^>]*object-cover/);
      expect(hero).toMatch(new RegExp(`data-hero-layout="[a-z]+/${layout}"`));
      expect(hero).not.toContain("<section");
    }
  });

  it.each(TEMPLATE_IDS)("%s: the legacy hero.image still shows when there's no dedicated cover", (template) => {
    const site = as(demo("rasa-kampung"), template);
    site.business.heroImage = undefined;
    heroOf(site).image = COVER;
    expect(heroHtml(html(site))).toMatch(/<img[^>]*cover\.webp/);
  });

  it.each(TEMPLATE_IDS)("%s: presentationMode picks the hero mode; no photo renders no image and no empty src", (template) => {
    const site = as(demo("hafiz-rahman"), template);
    site.business.heroImage = COVER;
    heroOf(site).presentationMode = "service";
    expect(html(site)).toContain('data-hero-mode="service"');
    const bare = as(demo("hafiz-rahman"), template);
    bare.business.heroImage = undefined;
    bare.business.profilePhoto = undefined;
    heroOf(bare).image = undefined;
    const hero = heroHtml(html(bare));
    expect(hero).not.toContain("<img");
    expect(html(bare)).not.toContain('src=""');
  });
});

describe("mobile / desktop composition and long content", () => {
  it.each(TEMPLATE_IDS)("%s: phones get the sticky contact bar, desktop gets the section nav; both from one markup", (template) => {
    const out = html(as(demo("sereni"), template));
    expect(out).toMatch(/sticky bottom-0 z-20[^"]*@3xl:hidden/);
    expect(out).toMatch(/<nav[^>]*aria-label="Sections"/);
    expect(out).toContain("@container");
    expect(out).toContain("overflow-x-clip");
  });

  it.each(TEMPLATE_IDS)("%s: very long names, headlines and item names render in full and may wrap anywhere", (template) => {
    const site = as(demo("rasa-kampung"), template);
    site.business.name = `Restoran ${LONG_WORD} dan Katering Sejahtera Berhad`;
    heroOf(site).headline = `${LONG_WORD} ${LONG_WORD}`;
    for (const s of site.sections) if (s.type === "offerings") s.items = s.items.map((item) => ({ ...item, name: `${item.name} ${LONG_WORD}`, price: "RM 12,345.00 – RM 99,999.00" }));
    const out = html(site);
    expect(out).toContain(site.business.name);
    expect(out.split(LONG_WORD).length - 1).toBeGreaterThanOrEqual(4);
    expect(out).toContain("[overflow-wrap:anywhere]");
    expect(out).toContain('data-preset="' + template + '"');
  });

  it.each(TEMPLATE_IDS)("%s: a minimal site (one section, no contact details) still renders without empty shells", (template) => {
    const site = as(demo("sereni"), template);
    site.sections = site.sections.filter((s) => s.type === "hero");
    site.business = { ...site.business, whatsapp: undefined, phone: undefined, email: undefined, instagram: undefined, facebook: undefined, tiktok: undefined, address: undefined, area: undefined };
    site.cta = { ...site.cta, kind: "link", href: undefined };
    const out = html(site);
    expect(out).toContain(`data-preset="${template}"`);
    expect(out).not.toContain('href=""');
    expect(out).not.toContain('src=""');
    expect(out).not.toContain("google.com/maps");
  });
});
