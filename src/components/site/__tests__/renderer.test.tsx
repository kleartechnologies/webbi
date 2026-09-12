import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_SITES } from "@/lib/site/demo";
import type { SectionOf, SiteContent } from "@/lib/site/schema";
import { headlineNames } from "../Hero";
import { SiteRenderer } from "../SiteRenderer";

const PHOTO = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/amir.webp?alt=media", path: "users/u1/sites/s1/amir.webp", width: 800, height: 800 };
const AMIR = "No. 9257C, Jalan Balakong, 43300 Balakong, Selangor (berdekatan kawasan Amerin Mall)";
const EMBED = "https://www.google.com/maps?q=";
const SEARCH = "https://www.google.com/maps/search/?api=1&amp;query=";

const car = (): SiteContent => structuredClone(DEMO_SITES["hafiz-rahman"]);
const restaurant = (): SiteContent => structuredClone(DEMO_SITES["rasa-kampung"]);
const html = (site: SiteContent, mode: "public" | "preview" = "public") => renderToStaticMarkup(<SiteRenderer site={site} mode={mode} />);
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
