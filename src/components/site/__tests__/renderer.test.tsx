import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_SITES } from "@/lib/site/demo";
import type { SectionOf, SiteContent } from "@/lib/site/schema";
import { headlineNames } from "../Hero";
import { SiteRenderer } from "../SiteRenderer";

const PHOTO = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/amir.webp?alt=media", path: "users/u1/sites/s1/amir.webp", width: 800, height: 800 };
const COVER = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/cover.webp?alt=media", path: "users/u1/sites/s1/cover.webp", width: 1600, height: 900 };
const LOGO = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp?alt=media", path: "users/u1/sites/s1/logo.webp", width: 1000, height: 1000 };
const AMIR = "No. 9257C, Jalan Balakong, 43300 Balakong, Selangor (berdekatan kawasan Amerin Mall)";
const EMBED = "https://www.google.com/maps?q=";
const SEARCH = "https://www.google.com/maps/search/?api=1&amp;query=";

const car = (): SiteContent => structuredClone(DEMO_SITES["hafiz-rahman"]);
const restaurant = (): SiteContent => structuredClone(DEMO_SITES["rasa-kampung"]);
const html = (site: SiteContent, mode: "public" | "preview" = "public") => renderToStaticMarkup(<SiteRenderer site={site} mode={mode} />);
const heroOf = (site: SiteContent) => site.sections.find((s): s is SectionOf<"hero"> => s.type === "hero")!;
/** Markup of the hero block only (from its mode attribute to the first section). */
const heroHtml = (out: string) => {
  const attr = out.indexOf("data-hero-mode=");
  if (attr === -1) return "";
  const start = out.lastIndexOf("<div", attr);
  const end = out.indexOf("<section", attr);
  return out.slice(start, end === -1 ? undefined : end);
};
const modeOf = (out: string) => out.match(/data-hero-mode="([a-z]+)"/)?.[1];
/** Markup of one section by its id, up to the next section or the footer. */
const sectionHtml = (out: string, id: string) => {
  const start = out.indexOf(`id="s-${id}"`);
  if (start === -1) return "";
  const rest = out.slice(start + 1);
  const end = rest.search(/<section|<footer/);
  return rest.slice(0, end === -1 ? undefined : end);
};
const footerHtml = (out: string) => out.slice(out.indexOf("<footer"));
/** next/image rewrites remote URLs into /_next/image?url=… (and a srcset), so count <img> tags by file name. */
const count = (out: string, needle: string) =>
  needle.endsWith(".webp") ? (out.match(new RegExp(`<img[^>]*${needle.replace(".", "[.]")}`, "g"))?.length ?? 0) : out.split(needle).length - 1;
const COVER_KEY = "cover.webp";
const SQUARE = { ...COVER, width: 1080, height: 1080 };
const TALL = { ...COVER, width: 1080, height: 1920 };
const BANNER = { ...COVER, width: 3000, height: 1000 };
const shapeOf = (h: string) => h.match(/data-hero-shape="([a-z]+)"/)?.[1];
const layoutOf = (h: string) => h.match(/data-hero-layout="([a-z/]+)"/)?.[1];
/** The frame's aspect ratios on phones and on desktop, as the CSS variables the markup carries. */
const ratiosOf = (h: string) => ({ mobile: Number(h.match(/--hero-ratio-m:([\d.]+)/)?.[1]), desktop: Number(h.match(/--hero-ratio-d:([\d.]+)/)?.[1]) });
const coverImg = (h: string) => h.match(/<img[^>]*cover\.webp[^>]*>/)?.[0] ?? "";
/** Class lists of the readability fades over the photo (each says on which breakpoint it shows). */
const fadesOf = (h: string) => [...h.matchAll(/<div aria-hidden="true" class="absolute inset-0 ?([^"]*)"/g)].map((m) => m[1]);
const frameClassOf = (h: string) => h.match(/<div class="([^"]*aspect-\(--hero-ratio-m\)[^"]*)"/)?.[1] ?? "";

const LOGO_KEY = "logo.webp";
const PHOTO_KEY = "amir.webp";
/** Sites without any uploaded imagery at all, as a brand-new customer's would be. */
const bare = (site: SiteContent): SiteContent => {
  heroOf(site).image = undefined;
  site.business.heroImage = undefined;
  site.business.profilePhoto = undefined;
  site.business.logo = undefined;
  return site;
};
const withoutLocation = (site: SiteContent): SiteContent => ({
  ...site,
  business: { ...site.business, address: undefined, area: undefined },
  sections: site.sections.filter((s) => s.type !== "location"),
});

describe("profile photo", () => {
  it("person-led site with a photo: header and hero show the person, the initial avatar goes away", () => {
    const site = car();
    site.business.profilePhoto = PHOTO;
    const out = html(site);
    expect(out.match(/<img[^>]*amir\.webp/g)?.length).toBe(2);
    expect(out).toContain(`alt="${site.business.name}"`);
    expect(out).not.toContain(`>${site.business.name.charAt(0)}</span>`);
  });

  it("person-led site without a photo keeps the initial avatar and renders no empty image", () => {
    const site = car();
    expect(site.business.profilePhoto).toBeUndefined();
    const out = html(site);
    expect(out).toContain(`>${site.business.name.charAt(0)}</span>`);
    expect(out).not.toContain("rounded-full bg-site-line");
    expect(out).not.toContain('src=""');
  });

  it("hero repeats the name and tagline only when the headline doesn't already say who this is", () => {
    const site = car();
    site.business.profilePhoto = PHOTO;
    site.business.name = "Amir (Sales Advisor Perodua)";
    site.business.tagline = "Bantu cari Perodua ikut bajet anda";
    const hero = site.sections.find((s): s is SectionOf<"hero"> => s.type === "hero")!;
    hero.headline = "Amir — Sales Advisor Perodua";
    let out = html(site);
    expect(out.match(/<img[^>]*amir\.webp/g)?.length).toBe(2);
    expect(out).not.toContain(">Bantu cari Perodua ikut bajet anda</span>");
    hero.headline = "Kereta Perodua baru ikut bajet anda";
    out = html(site);
    expect(out).toContain(">Amir (Sales Advisor Perodua)</span>");
    expect(out).toContain(">Bantu cari Perodua ikut bajet anda</span>");
  });

  it("headlineNames matches the full name or the first name as a whole word", () => {
    expect(headlineNames("Amir — Sales Advisor Perodua", "Amir (Sales Advisor Perodua)")).toBe(true);
    expect(headlineNames("AMIR", "Amir")).toBe(true);
    expect(headlineNames("Dr Lim Dental Care", "Dr. Lim Wei Ling")).toBe(true);
    expect(headlineNames("Kereta Perodua untuk bajet anda", "Amir")).toBe(false);
    expect(headlineNames("Amirah Motors Balakong", "Amir")).toBe(false);
  });

  it("business-led site ignores a stray profile photo and keeps its logo initial", () => {
    const site = restaurant();
    site.business.profilePhoto = PHOTO;
    const out = html(site);
    expect(out).not.toContain("amir.webp");
    expect(out).toContain(`>${site.business.name.charAt(0)}</span>`);
  });
});

describe("location", () => {
  it("public site with an address: real map embed plus an Open in Google Maps link for that address", () => {
    const site = car();
    site.business.address = AMIR;
    const out = html(site);
    const query = "No.%209257C%2C%20Jalan%20Balakong%2C%2043300%20Balakong%2C%20Selangor";
    expect(out).toContain(`<iframe src="${EMBED}${query}&amp;output=embed"`);
    expect(out).toContain(`href="${SEARCH}${query}"`);
    expect(out).toContain("berdekatan kawasan Amerin Mall");
    expect(out).not.toContain(">Google Maps</span>");
  });

  it("preview never shows a fake map box, only the address card with the same Maps link", () => {
    const site = car();
    site.business.address = AMIR;
    const out = html(site, "preview");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain(">Google Maps</span>");
    expect(out).toContain(`href="${SEARCH}No.%209257C`);
    expect(out).toContain("Open in Google Maps");
  });

  it("area only (no street address) links a Maps search for the area and says it is an area", () => {
    const site = car();
    const out = html(site);
    expect(out).toContain(`href="${SEARCH}Proton%20Shah%20Alam"`);
    expect(out).toContain(">Area</span>");
    expect(out).toContain(`<iframe src="${EMBED}Proton%20Shah%20Alam&amp;output=embed"`);
  });

  it("no location at all: no map, no maps link, no location nav item", () => {
    const out = html(withoutLocation(restaurant()));
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("google.com/maps");
    expect(out).not.toContain(">Lokasi<");
  });

  it("a location section with only hours still renders the hours without a map", () => {
    const site = withoutLocation(restaurant());
    site.sections.splice(site.sections.length - 1, 0, {
      id: "loc",
      type: "location",
      enabled: true,
      hours: [{ id: "h1", days: "Isnin – Jumaat", hours: "9 pagi – 6 petang" }],
    });
    const out = html(site);
    expect(out).toContain("Isnin – Jumaat");
    expect(out).not.toContain("google.com/maps");
  });

  it("owner-typed text can never become a script or a non-Google destination", () => {
    const site = car();
    site.business.address = '"><script>alert(1)</script> javascript:alert(1)';
    const out = html(site);
    expect(out).not.toContain("<script>");
    expect(out.match(/href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=[^"]*"/)).not.toBeNull();
    expect(out).not.toMatch(/href="javascript:/);
  });
});

describe("existing demo sites", () => {
  it("still render in both modes", () => {
    for (const site of Object.values(DEMO_SITES)) {
      expect(html(site)).toContain(site.business.name);
      expect(html(site, "preview")).toContain(site.business.name);
    }
  });
});

describe("renderer box", () => {
  it("the site's own sticky layers stay inside the renderer, so a preview can never paint over the app around it", () => {
    // The sticky CTA is z-20 and the site header z-30. Without `isolate` on the root they
    // join the host page's stacking context, and on a short phone the preview's CTA covers
    // the Ready screen's Edit / Publish bar.
    for (const mode of ["public", "preview"] as const) {
      // A hero photo marked priority hoists its preload <link> ahead of the root.
      const root = html(car(), mode).match(/^(?:<link [^>]*>)*<div [^>]*class="([^"]*)"/)?.[1] ?? "";
      expect(root).toContain("isolate");
    }
    // The preview still shows the site's real sticky CTA; it is layered, not removed.
    expect(html(car(), "preview")).toContain("sticky bottom-0 z-20");
  });
});

describe("hero image system", () => {
  it("hero image upload: the cover renders in the hero for a person-led site, never the profile photo as background", () => {
    const site = bare(car());
    site.business.heroImage = COVER;
    site.business.profilePhoto = PHOTO;
    const out = html(site);
    expect(modeOf(out)).toBe("person");
    expect(heroHtml(out)).toContain(COVER_KEY);
    expect(count(out, COVER_KEY)).toBe(1);
    // The person is shown beside/over the cover as a small round photo, not as the cover.
    expect(count(out, PHOTO_KEY)).toBe(2);
    expect(heroHtml(out)).toContain("rounded-full");
    expect(heroHtml(out)).toContain("data-hero-cta");
  });

  it("hero image upload: a business-led site gets the visual layout with the cover, and the logo stays in the header", () => {
    const site = bare(restaurant());
    site.business.heroImage = COVER;
    site.business.logo = LOGO;
    const out = html(site);
    expect(modeOf(out)).toBe("visual");
    expect(heroHtml(out)).toContain(COVER_KEY);
    expect(heroHtml(out)).not.toContain(LOGO_KEY);
    expect(count(out, LOGO_KEY)).toBe(1);
    expect(out).toContain("data-logo");
    expect(out.slice(0, out.indexOf("data-hero-mode"))).toContain(LOGO_KEY);
  });

  it("existing site without a hero image: tasteful category fallback, no broken image, no empty box, CTA still there", () => {
    for (const site of [bare(car()), bare(restaurant()), bare(structuredClone(DEMO_SITES.sejuktech)), bare(structuredClone(DEMO_SITES.sereni))]) {
      const out = html(site);
      const hero = heroHtml(out);
      expect(hero).not.toContain("<img");
      expect(out).not.toContain('src=""');
      expect(hero).toContain("data-hero-cta");
      // Accent tint (or the preset's dark ink), never an empty grey box.
      expect(hero).toMatch(/background:|bg-site-ink/);
    }
    expect(modeOf(html(bare(car())))).toBe("person");
    expect(modeOf(html(bare(restaurant())))).toBe("visual");
    expect(modeOf(html(bare(structuredClone(DEMO_SITES.sejuktech))))).toBe("service");
  });

  it("hero removal restores the category fallback immediately, identical to a site that never had one", () => {
    const site = bare(car());
    site.business.heroImage = COVER;
    site.business.heroImagePosition = "top";
    expect(heroHtml(html(site))).toContain(COVER_KEY);
    site.business.heroImage = undefined;
    site.business.heroImagePosition = undefined;
    const removed = html(site);
    expect(heroHtml(removed)).not.toContain("<img");
    expect(removed).toBe(html(bare(car())));
  });

  it("profile removal restores the initial fallback while the cover stays", () => {
    const site = bare(car());
    site.business.heroImage = COVER;
    site.business.profilePhoto = PHOTO;
    expect(html(site)).not.toContain(`>${site.business.name.charAt(0)}</span>`);
    site.business.profilePhoto = undefined;
    const out = html(site);
    expect(out).toContain(`>${site.business.name.charAt(0)}</span>`);
    expect(out).not.toContain(PHOTO_KEY);
    expect(heroHtml(out)).toContain(COVER_KEY);
  });

  it("business-led site never exposes a person profile photo, even a stray one; person-led never shows a logo", () => {
    const restaurantSite = bare(restaurant());
    restaurantSite.business.profilePhoto = PHOTO;
    restaurantSite.business.logo = LOGO;
    const r = html(restaurantSite);
    expect(r).not.toContain(PHOTO_KEY);
    expect(r).toContain("data-logo");
    const carSite = bare(car());
    carSite.business.profilePhoto = PHOTO;
    carSite.business.logo = LOGO;
    const c = html(carSite);
    expect(c).not.toContain(LOGO_KEY);
    expect(c).not.toContain("data-logo");
    expect(count(c, PHOTO_KEY)).toBe(2);
  });

  it("hero presentation mode: category default, overridable per site, each with its own composition", () => {
    const site = bare(car());
    site.business.heroImage = COVER;
    site.business.profilePhoto = PHOTO;
    expect(modeOf(html(site))).toBe("person");
    heroOf(site).presentationMode = "service";
    const service = html(site);
    expect(modeOf(service)).toBe("service");
    // Service layout: proposition + trust points, no person photo in the hero (header only).
    expect(count(service, PHOTO_KEY)).toBe(1);
    expect(heroHtml(service)).toContain("<ul");
    heroOf(site).presentationMode = "property";
    site.business.category = "property";
    site.business.area = "Petaling Jaya";
    const property = html(site);
    expect(modeOf(property)).toBe("property");
    expect(heroHtml(property)).toContain("Petaling Jaya");
    expect(count(property, PHOTO_KEY)).toBe(2);
    const contractor = structuredClone(DEMO_SITES.sejuktech);
    contractor.business.heroImage = COVER;
    expect(modeOf(html(contractor))).toBe("service");
  });

  it("the owner's focus edge stays on the cover image itself, centre by default", () => {
    const site = bare(car());
    site.business.heroImage = COVER;
    expect(coverImg(heroHtml(html(site)))).toContain("object-center");
    site.business.heroImagePosition = "top";
    let img = coverImg(heroHtml(html(site)));
    expect(img).toContain("object-top");
    expect(img).not.toContain("object-center");
    site.business.heroImagePosition = "bottom";
    img = coverImg(heroHtml(html(site)));
    expect(img).toContain("object-bottom");
    expect(img).toContain("object-cover");
  });

  it("wide 16:9 cover: the whole photo full-bleed above the copy on phones, the full-width backdrop behind it on desktop", () => {
    for (const site of [bare(car()), bare(restaurant())]) {
      site.business.heroImage = COVER;
      const hero = heroHtml(html(site));
      expect(shapeOf(hero)).toBe("wide");
      expect(layoutOf(hero)).toBe("stack/overlay");
      expect(ratiosOf(hero).mobile).toBeCloseTo(16 / 9);
      expect(ratiosOf(hero).desktop).toBeCloseTo(16 / 9);
      expect(hero).toContain('sizes="100vw"');
      // The readability fade exists only behind the desktop overlay copy; the phone photo is never dimmed.
      expect(fadesOf(hero)).toEqual(["hidden @3xl:block"]);
      expect(hero).not.toContain("@3xl:grid-cols-[1fr_1fr]");
    }
  });

  it("square cover: shown whole; a visual hero sets its copy over it on phones, other modes stack under it; beside the copy on desktop", () => {
    const visual = bare(restaurant());
    visual.business.heroImage = SQUARE;
    const v = heroHtml(html(visual));
    expect(shapeOf(v)).toBe("square");
    expect(layoutOf(v)).toBe("overlay/split");
    expect(ratiosOf(v)).toEqual({ mobile: 1, desktop: 1 });
    expect(fadesOf(v)).toEqual(["@3xl:hidden"]);
    expect(v).toContain("@3xl:grid-cols-[1fr_1fr]");
    expect(v).toContain("@3xl:max-w-[calc(min(72svh,640px)*var(--hero-ratio-d))]");
    expect(v).toContain('sizes="(max-width: 768px) 100vw, 640px"');
    const person = bare(car());
    person.business.heroImage = SQUARE;
    person.business.profilePhoto = PHOTO;
    const p = heroHtml(html(person));
    expect(layoutOf(p)).toBe("stack/split");
    expect(fadesOf(p)).toEqual([]);
    expect(p).toContain("rounded-full");
  });

  it("tall 9:16 cover: never a screen-long hero on phones (2:3 under the copy, 3:4 stacked), the focus edge decides the crop; whole beside the copy on desktop", () => {
    const visual = bare(restaurant());
    visual.business.heroImage = TALL;
    visual.business.heroImagePosition = "top";
    const v = heroHtml(html(visual));
    expect(shapeOf(v)).toBe("tall");
    expect(layoutOf(v)).toBe("overlay/split");
    expect(ratiosOf(v).mobile).toBeCloseTo(2 / 3);
    expect(ratiosOf(v).desktop).toBeCloseTo(9 / 16);
    expect(coverImg(v)).toContain("object-top");
    const person = bare(car());
    person.business.heroImage = TALL;
    const p = heroHtml(html(person));
    expect(layoutOf(p)).toBe("stack/split");
    expect(ratiosOf(p).mobile).toBeCloseTo(3 / 4);
    expect(ratiosOf(p).desktop).toBeCloseTo(9 / 16);
  });

  it("banner 3:1 cover: a full-width strip on desktop, trimmed to 2:1 on phones", () => {
    const site = bare(structuredClone(DEMO_SITES.sejuktech));
    site.business.heroImage = BANNER;
    const hero = heroHtml(html(site));
    expect(modeOf(hero)).toBe("service");
    expect(shapeOf(hero)).toBe("banner");
    expect(layoutOf(hero)).toBe("stack/overlay");
    expect(ratiosOf(hero)).toEqual({ mobile: 2, desktop: 3 });
  });

  it("a cover whose size was never recorded is laid out as the recommended 16:9, never as a broken frame", () => {
    const site = bare(car());
    site.business.heroImage = { url: COVER.url, path: COVER.path };
    const hero = heroHtml(html(site));
    expect(shapeOf(hero)).toBe("wide");
    expect(layoutOf(hero)).toBe("stack/overlay");
    expect(ratiosOf(hero).mobile).toBeCloseTo(16 / 9);
    expect(hero).not.toContain("NaN");
    expect(hero).not.toContain("undefined");
  });

  it("every category × shape: the cover once, one CTA in the hero and none repeated under it, the height caps that keep the hero on the first screen", () => {
    const categories = ["restaurant", "car", "property", "beauty", "homeServices", "photographer"] as const;
    for (const category of categories) {
      for (const image of [COVER, SQUARE, TALL, BANNER]) {
        const site = bare(car());
        site.business.category = category;
        site.business.heroImage = image;
        const out = html(site);
        expect(count(out, "data-hero-cta")).toBe(1);
        const hero = heroHtml(out);
        expect(count(hero, COVER_KEY)).toBe(1);
        expect(hero).toContain("max-h-[min(88svh,760px)]");
        expect(hero).toContain("@3xl:max-h-[min(72svh,640px)]");
        expect(hero).toContain("aspect-(--hero-ratio-m)");
        expect(hero).toContain("@3xl:aspect-(--hero-ratio-d)");
        // The photo starts in the first grid row on both breakpoints. `row-span-*`
        // is the grid-row shorthand and resets the start, so without these the
        // desktop backdrop falls under the copy instead of sitting behind it.
        const frameClass = frameClassOf(hero);
        expect(frameClass).toContain("row-start-1");
        expect(frameClass).toContain("@3xl:row-start-1");
      }
    }
  });

  it("public and preview renderers receive the same hero image, focus, frame and mode for every shape", () => {
    for (const image of [COVER, SQUARE, TALL, BANNER]) {
      const site = bare(car());
      site.business.heroImage = image;
      site.business.heroImagePosition = "top";
      site.business.profilePhoto = PHOTO;
      const pub = heroHtml(html(site, "public"));
      const pre = heroHtml(html(site, "preview"));
      expect(coverImg(pub)).not.toBe("");
      expect(coverImg(pre)).toBe(coverImg(pub));
      expect(modeOf(pre)).toBe(modeOf(pub));
      expect(layoutOf(pre)).toBe(layoutOf(pub));
      expect(ratiosOf(pre)).toEqual(ratiosOf(pub));
    }
  });
});

describe("social media", () => {
  it("person-led site: icons near the profile (about section), canonical URLs, new tab, labelled", () => {
    const site = car();
    site.business.facebook = "hafizproton";
    site.business.tiktok = "@hafiz.proton";
    site.business.instagram = "instagram.com/hafiz.proton";
    const out = html(site);
    expect(count(out, "data-social")).toBe(1);
    const about = sectionHtml(out, "about");
    expect(about).toContain("data-social");
    expect(about).toContain('href="https://www.facebook.com/hafizproton"');
    expect(about).toContain('href="https://www.tiktok.com/@hafiz.proton"');
    expect(about).toContain('href="https://www.instagram.com/hafiz.proton/"');
    expect(about).toMatch(/<a[^>]*target="_blank"[^>]*rel="noreferrer noopener"[^>]*aria-label="Facebook"/);
    expect(about).toMatch(/aria-label="TikTok"/);
    expect(about).toMatch(/aria-label="Instagram"/);
    expect(about).toContain("<svg");
    expect(sectionHtml(out, "contact")).not.toContain("data-social");
  });

  it("business-led site: icons in the contact section, or the footer when there is no contact section", () => {
    const site = restaurant();
    site.business.instagram = "@rasakampung.kajang";
    const out = html(site);
    expect(count(out, "data-social")).toBe(1);
    expect(sectionHtml(out, "contact")).toContain('href="https://www.instagram.com/rasakampung.kajang/"');
    expect(sectionHtml(out, "about")).not.toContain("data-social");
    site.sections = site.sections.filter((s) => s.type !== "contact");
    const noContact = html(site);
    expect(count(noContact, "data-social")).toBe(1);
    expect(footerHtml(noContact)).toContain('href="https://www.instagram.com/rasakampung.kajang/"');
  });

  it("no social links → no social section at all, and invalid values never become links", () => {
    const site = car();
    site.business.instagram = undefined;
    site.business.facebook = undefined;
    site.business.tiktok = undefined;
    let out = html(site);
    expect(out).not.toContain("data-social");
    expect(out).not.toMatch(/aria-label="(Social media|Media sosial)"/);
    site.business.instagram = "javascript:alert(1)";
    site.business.facebook = "ABC Kitchen";
    site.business.tiktok = "https://evil.com/@hafiz";
    out = html(site);
    expect(out).not.toContain("data-social");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("evil.com");
  });
});
