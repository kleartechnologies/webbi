// Runs six realistic Malaysian business descriptions through the real onboarding flow
// (/start → confirm → content → generating → ready) and reports what the AI understood
// and generated for each. Works with AI_PROVIDER=mock (structure check) or a real key.
// Phase 12: four of them also upload a cover photo plus a logo (business-led) or a
// profile photo (person-led), type social handles on the confirm step, and check the
// hero layout, header logo and social icons in the ready preview (mobile + desktop).
//
//   npm run qa:industries
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME (Chrome binary path),
// QA_ONLY (comma-separated industry keys, e.g. QA_ONLY=car) to run a subset.
// Each industry runs in a fresh browser context, signing up its own account (building is
// account-first) so the per-user
// AI rate limits are not hit. Screenshots + industries-report.json land in scripts/qa/shots/.
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageInput, signUp, writeAvatarPng, writeCoverPng, writeLogoPng } from "./lib.mjs";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
/** Unique per run so each QA account is its own; the emulator keeps users between runs. */
const runTag = Date.now().toString(36).slice(-5);

const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });
const avatar = writeAvatarPng(path.join(shots, "qa-avatar.png"));
/**
 * One cover per shape the hero system tells apart; each industry with a cover uploads a
 * different one, so the ready preview is checked for wide, square, tall and banner photos.
 * Expectations (frame ratios, layouts) follow src/lib/site/hero.ts: inside the frame bounds
 * the frame takes the photo's own ratio (no crop); tall photos are trimmed on phones and
 * banners on phones, never on desktop where the split layout shows the whole photo.
 */
const COVERS = {
  wide: { w: 1600, h: 900, shape: "wide", desktopRatio: 16 / 9 },
  square: { w: 1080, h: 1080, shape: "square", desktopRatio: 1 },
  tall: { w: 1080, h: 1920, shape: "tall", desktopRatio: 9 / 16 },
  banner: { w: 2400, h: 800, shape: "banner", desktopRatio: 3 },
};
for (const [key, c] of Object.entries(COVERS)) c.file = writeCoverPng(path.join(shots, `qa-cover-${key}.png`), c.w, c.h);
const logoPng = writeLogoPng(path.join(shots, "qa-logo.png"));

const INDUSTRIES = [
  {
    key: "restaurant",
    expectCategory: "restaurant",
    ctaFamily: /order|pesan|tempah/i,
    heroMode: "visual",
    logo: true,
    hero: true,
    cover: { ...COVERS.wide, layout: "stack/overlay", mobileRatio: 16 / 9, mobileCrop: "shown whole" },
    desktop: true,
    socials: { instagram: "@warungmaknah", facebook: "https://www.facebook.com/warungmaknah" },
    expectSocials: { instagram: "https://www.instagram.com/warungmaknah/", facebook: "https://www.facebook.com/warungmaknah" },
    description:
      "Saya buka kedai makan Warung Mak Nah di Kajang. Jual nasi lemak, mee goreng dan lauk kampung, semua halal dan masak sendiri. Buka 7 pagi sampai 3 petang. Customer biasa order ikut WhatsApp 012-345 6789.",
  },
  {
    // The Phase 11 end-to-end scenario: person-led, with a real address and a profile photo.
    key: "car",
    expectCategory: "car",
    personLed: true,
    ctaFamily: /test drive|pandu uji|promo|whatsapp/i,
    mustKeep: ["Axia", "Bezza", "Myvi", "Ativa", "Alza", "Aruz"],
    address: "No. 9257C, Jalan Balakong, 43300 Balakong, Selangor (berdekatan kawasan Amerin Mall)",
    profilePhoto: true,
    heroMode: "person",
    hero: true,
    cover: { ...COVERS.square, layout: "stack/split", mobileRatio: 1, mobileCrop: "shown whole" },
    desktop: true,
    socials: { instagram: "@amir.perodua", tiktok: "@amir.perodua" },
    expectSocials: { instagram: "https://www.instagram.com/amir.perodua/", tiktok: "https://www.tiktok.com/@amir.perodua" },
    description: `Saya Amir, seorang Sales Advisor Perodua di Balakong.

Saya bantu customer cari kereta Perodua baru yang sesuai dengan bajet mereka. Saya boleh bantu urus loan, trade-in dan pendaftaran kereta.

Model yang saya jual termasuk Axia, Bezza, Myvi, Ativa, Alza dan Aruz.

Customer boleh WhatsApp saya untuk semak promo terkini, monthly payment atau book test drive.

Saya cover kawasan Balakong, Cheras, Kajang dan Seri Kembangan.`,
  },
  {
    key: "property",
    expectCategory: "property",
    personLed: true,
    ctaFamily: /enquir|tanya|property|hartanah/i,
    heroMode: "property",
    profilePhoto: true,
    hero: true,
    cover: { ...COVERS.tall, layout: "stack/split", mobileRatio: 3 / 4, mobileCrop: "trimmed to 3:4 so the copy stays on the first screen" },
    desktop: true,
    socials: { instagram: "https://instagram.com/sarahlim.homes", facebook: "sarahlimhomes", tiktok: "https://www.tiktok.com/@sarahlim.homes" },
    expectSocials: { instagram: "https://www.instagram.com/sarahlim.homes/", facebook: "https://www.facebook.com/sarahlimhomes", tiktok: "https://www.tiktok.com/@sarahlim.homes" },
    description:
      "I'm Sarah Lim, a registered real estate negotiator with IQI in Petaling Jaya. I help families buy, sell and rent condos and landed homes around PJ, Damansara and Subang Jaya. Free valuation, WhatsApp me to enquire.",
  },
  {
    key: "homeServices",
    expectCategory: "homeServices",
    ctaFamily: /quot|sebut harga|harga/i,
    heroMode: "service",
    logo: true,
    hero: true,
    cover: { ...COVERS.banner, layout: "stack/overlay", mobileRatio: 2, mobileCrop: "trimmed to 2:1 so it is not a sliver" },
    desktop: true,
    socials: { facebook: "ZulRenovation", tiktok: "zul.renovation" },
    expectSocials: { facebook: "https://www.facebook.com/ZulRenovation", tiktok: "https://www.tiktok.com/@zul.renovation" },
    description:
      "Kami buat renovation, plumbing dan wiring untuk rumah area Shah Alam dan Klang. 12 tahun experience, harga berpatutan, free quotation. Kitchen cabinet dari RM3,500. Contact Zul untuk quote.",
  },
  {
    key: "beauty",
    expectCategory: "beauty",
    ctaFamily: /book|appointment|tempah|janji/i,
    heroMode: "visual",
    description:
      "Salon Ayu Beauty kat Bangi. Kami buat haircut, hair colour, rebonding, facial dan bridal makeup. Ladies only, ada ruang solat. Booking through WhatsApp je 011-2345 6789.",
  },
  {
    key: "photographer",
    expectCategory: "photographer",
    personLed: true,
    ctaFamily: /availab|kekosongan|tarikh|book/i,
    heroMode: "person",
    description:
      "Hi, I'm Danial, a freelance wedding and event photographer based in Johor Bahru. I shoot weddings, engagements and corporate events across Johor and Singapore. Packages from RM1,200. Check my availability on WhatsApp.",
  },
];

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Rendered frame ratio within rounding of the expected one (frames are measured in whole pixels). */
const ratioNear = (img, ratio) => Boolean(img) && Math.abs(img.frameW / img.frameH - ratio) < 0.03;
/** `@3xl:min-h-[420px]` on the desktop overlay frame: the room the copy needs on the photo. */
const HERO_MIN_H = 420;
const clickText = async (page, sel, label, exact = false) => {
  for (const el of await page.$$(sel)) {
    const t = (await el.evaluate((e) => e.textContent)).trim();
    if (exact ? t === label : t.includes(label)) { await el.evaluate((e) => e.click()); return true; }
  }
  throw new Error(`No ${sel} with text "${label}"`);
};

/** Numbers/claims in the generated copy that the owner never wrote. */
function groundingIssues(description, site) {
  const norm = (s) => s.replace(/[\s,]/g, "").toLowerCase();
  const src = norm(description);
  const text = JSON.stringify(site);
  const issues = [];
  for (const m of text.match(/RM\s?[\d,]+(?:\.\d+)?/gi) ?? []) {
    if (!src.includes(norm(m))) issues.push(`price not in input: ${m}`);
  }
  for (const m of text.match(/\b(?:since|sejak|est\.?)\s+(?:19|20)\d{2}\b/gi) ?? []) issues.push(`invented founding year: ${m}`);
  for (const m of text.match(/\b(?:\d+(?:\.\d+)?\s*(?:stars?|bintang)|\d+\+?\s*(?:reviews?|ulasan|customers?|pelanggan)|award|anugerah)\b/gi) ?? []) {
    if (!src.includes(norm(m))) issues.push(`unsupported claim: ${m}`);
  }
  for (const m of text.match(/\b0?1\d[-\s]?\d{3,4}[-\s]?\d{4}\b/g) ?? []) {
    if (!src.includes(norm(m))) issues.push(`phone not in input: ${m}`);
  }
  return [...new Set(issues)];
}

const report = [];
let failed = 0;
const only = process.env.QA_ONLY?.split(",").map((k) => k.trim()).filter(Boolean);
const selected = only?.length ? INDUSTRIES.filter((i) => only.includes(i.key)) : INDUSTRIES;
if (!selected.length) throw new Error(`QA_ONLY matched nothing (known: ${INDUSTRIES.map((i) => i.key).join(", ")})`);

for (const industry of selected) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const entry = { key: industry.key, description: industry.description, checks: [], errors: [] };
  const api = {};
  page.on("response", async (res) => {
    const url = res.url();
    for (const name of ["understand", "generate"]) {
      if (url.includes(`/api/ai/${name}`) && res.request().method() === "POST") {
        const ms = Date.now() - api[`${name}Start`];
        try { api[name] = { status: res.status(), ms, body: await res.json() }; } catch { api[name] = { status: res.status(), ms }; }
      }
    }
  });
  page.on("request", (req) => {
    const url = req.url();
    for (const name of ["understand", "generate"]) if (url.includes(`/api/ai/${name}`) && req.method() === "POST") api[`${name}Start`] = Date.now();
  });
  page.on("pageerror", (e) => entry.errors.push("pageerror: " + e.message));

  const check = (ok, label) => { entry.checks.push({ ok, label }); if (!ok) failed++; };
  try {
    await signUp(page, base, { name: "QA", email: `qa-${industry.key}-${runTag}@example.com` });
    await page.type("textarea", industry.description);
    await clickText(page, "button", "Continue", true);
    await page.waitForFunction(() => location.pathname.includes("/confirm") || document.querySelector("[role=alert]"), { timeout: 90000 });
    if (!page.url().includes("/confirm")) {
      const alert = await page.$eval("[role=alert]", (e) => e.textContent).catch(() => "");
      throw new Error(`understand failed: ${alert || api.understand?.status}`);
    }
    const u = api.understand?.body?.understanding;
    entry.understand = { status: api.understand?.status, ms: api.understand?.ms, ...u };
    check(Boolean(u), "understand returned an understanding");
    check(u?.category === industry.expectCategory, `detected category ${u?.category} (expected ${industry.expectCategory}, confidence ${u?.categoryConfidence})`);
    check(industry.ctaFamily.test(u?.ctaLabel ?? ""), `understand ctaLabel "${u?.ctaLabel}" matches ${industry.ctaFamily}`);

    await page.waitForSelector("#name", { timeout: 20000 });
    const form = await page.evaluate(() => ({
      name: document.querySelector("#name")?.value, category: document.querySelector("#category")?.value,
      tagline: document.querySelector("#tagline")?.value, whatsapp: document.querySelector("#whatsapp")?.value, area: document.querySelector("#area")?.value,
    }));
    entry.confirmForm = form;
    check(form.category === industry.expectCategory, `confirm form pre-selected category ${form.category}`);
    check(Boolean(form.name), `confirm form has a name: ${form.name}`);
    if (!form.whatsapp) { await page.type("#whatsapp", "0123456789"); entry.confirmForm.whatsappTyped = "0123456789"; }
    if (industry.address || industry.socials) {
      // The optional details fold open with one button; it is already open when the AI found something.
      if (!(await page.$("#address"))) await clickText(page, "button", "Address & social media");
      await page.waitForSelector("#address", { timeout: 5000 });
      if (industry.address) {
        await page.$eval("#address", (e) => { e.focus(); e.select(); });
        await page.keyboard.type(industry.address);
        entry.confirmForm.address = industry.address;
      }
      for (const [kind, value] of Object.entries(industry.socials ?? {})) {
        await page.$eval(`#${kind}`, (e) => { e.focus(); e.select(); });
        await page.keyboard.type(value);
      }
      entry.confirmForm.socials = industry.socials;
    }
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-confirm.png`), fullPage: true });
    await clickText(page, "button", "Looks right");
    await page.waitForFunction(() => location.pathname.includes("/content"), { timeout: 20000 });
    await page.waitForSelector("h1", { timeout: 20000 });
    await wait(300);
    const offerings = await page.$$eval("input", (els) => els.map((e) => e.value).filter(Boolean));
    entry.contentInputs = offerings;
    // Image fields (Phase 11 + 12): every category gets the cover photo card; person-led
    // categories get "Your profile photo", business-led ones get "Business logo", never both.
    await page.waitForSelector("#hero-image", { timeout: 15000 }).catch(() => {});
    const fields = await page.evaluate(() => ({
      hero: Boolean(document.querySelector("#hero-image")),
      profile: Boolean(document.querySelector("#profile-photo")),
      logo: Boolean(document.querySelector("#business-logo")),
      heroLabel: document.querySelector("label[for=hero-image]")?.textContent?.trim() ?? null,
      text: document.body.innerText,
    }));
    entry.contentFields = { hero: fields.hero, profile: fields.profile, logo: fields.logo };
    check(fields.hero && fields.heroLabel === "Hero / cover photo", `cover photo card shown (label "${fields.heroLabel}")`);
    check(fields.text.includes("Recommended: 1600 × 900 px (16:9)") && fields.text.includes("Upload cover photo"), "cover photo card has the 16:9 guidance and upload button");
    check(fields.profile === Boolean(industry.personLed), `profile photo field ${fields.profile ? "shown" : "hidden"} (${industry.personLed ? "person-led" : "business-led"} category)`);
    check(fields.logo === !industry.personLed, `business logo field ${fields.logo ? "shown" : "hidden"} (${industry.personLed ? "person-led" : "business-led"} category)`);
    const uploadTo = async (id, file) => {
      await (await imageInput(page, id)).uploadFile(file);
      await page.waitForSelector(`#${id} img`, { timeout: 30000 });
      await page.waitForFunction(
        (sel) => [...document.querySelector(sel).closest("[data-image-field]").querySelectorAll("button")].some((b) => b.textContent.trim() === "Replace"),
        { timeout: 30000 },
        `#${id}`,
      );
    };
    if (industry.profilePhoto && fields.profile) { await uploadTo("profile-photo", avatar); entry.profilePhotoUploaded = true; }
    if (industry.logo && fields.logo) { await uploadTo("business-logo", logoPng); entry.logoUploaded = true; }
    if (industry.hero && fields.hero) {
      await uploadTo("hero-image", industry.cover.file);
      entry.heroUploaded = true;
      const chips = await page.$$eval("[aria-label='Crop focus'] button", (els) => els.map((b) => b.textContent.trim()));
      check(chips.join(",") === "Centre,Top,Bottom", `crop focus chips after cover upload: ${chips.join(",") || "none"}`);
    }
    if (entry.profilePhotoUploaded || entry.logoUploaded || entry.heroUploaded) {
      await wait(500);
      await page.screenshot({ path: path.join(shots, `industry-${industry.key}-content.png`), fullPage: true });
    }
    await clickText(page, "button", "Build my website");
    await page.waitForFunction(() => location.pathname.includes("/ready") || /Something went wrong/.test(document.body.innerText), { timeout: 120000 });
    if (!page.url().includes("/ready")) {
      const msg = await page.evaluate(() => document.body.innerText);
      throw new Error(`generate failed: ${msg.split("\n").find((l) => /Webbi|AI|again|too long/i.test(l)) || api.generate?.status}`);
    }
    const g = api.generate?.body;
    const site = g?.site;
    entry.generate = { status: api.generate?.status, ms: api.generate?.ms, model: g?.model };
    check(Boolean(site), "generate returned a site");
    if (site) {
      entry.site = {
        language: site.language, preset: site.theme?.preset, business: site.business, cta: site.cta,
        sections: site.sections.map((s) => s.type),
        hero: site.sections.find((s) => s.type === "hero"),
        offerings: site.sections.find((s) => s.type === "offerings")?.items?.map((i) => `${i.name}${i.price ? ` (${i.price})` : ""}`),
        highlights: site.sections.find((s) => s.type === "highlights")?.items?.map((i) => i.title),
        faq: site.sections.find((s) => s.type === "faq")?.items?.map((i) => i.question),
        location: site.sections.find((s) => s.type === "location"),
      };
      check(site.sections[0]?.type === "hero", "hero is the first section");
      check(site.sections.at(-1)?.type === "cta", "cta is the last section");
      check(site.sections.some((s) => s.type === "contact"), "has a contact section");
      check(!site.sections.some((s) => s.type === "reviews"), "no reviews section");
      check(industry.ctaFamily.test(site.cta?.label ?? ""), `site CTA "${site.cta?.label}" matches ${industry.ctaFamily}`);
      check(Boolean(site.cta?.whatsapp || form.whatsapp || entry.confirmForm.whatsappTyped), "CTA has a WhatsApp number");
      const grounding = groundingIssues(industry.description, site);
      entry.grounding = grounding;
      check(grounding.length === 0, grounding.length ? `grounding: ${grounding.join("; ")}` : "no invented prices/years/claims/phones");
      check(site.language === entry.understand.language, `site language ${site.language} matches understanding ${entry.understand.language}`);
      if (industry.mustKeep) {
        const text = JSON.stringify(site);
        const lost = industry.mustKeep.filter((word) => !text.includes(word));
        check(lost.length === 0, lost.length ? `lost from the description: ${lost.join(", ")}` : `kept ${industry.mustKeep.join(", ")}`);
      }
      if (industry.address) {
        const loc = site.sections.find((s) => s.type === "location");
        check(site.business.address === industry.address, `business.address kept verbatim: ${site.business.address}`);
        check(loc?.address === industry.address, `location section address kept verbatim: ${loc?.address}`);
      }
      if (industry.profilePhoto) {
        check(site.business.profilePhoto?.path?.startsWith("users/"), `profile photo on the generated site: ${site.business.profilePhoto?.path ?? "missing"}`);
      }
      const hero = site.sections.find((s) => s.type === "hero");
      if (industry.heroMode) check(hero?.presentationMode === industry.heroMode, `hero presentation mode ${hero?.presentationMode} (expected ${industry.heroMode})`);
      if (industry.logo) {
        check(site.business.logo?.path?.startsWith("users/"), `logo on the generated site: ${site.business.logo?.path ?? "missing"}`);
        check(!site.business.profilePhoto, "business-led site carries no profilePhoto");
      }
      if (industry.personLed) check(!site.business.logo, "person-led site carries no logo");
      if (industry.hero) {
        check(site.business.heroImage?.path?.startsWith("users/"), `cover photo on the generated site: ${site.business.heroImage?.path ?? "missing"}`);
        check(hero?.image === undefined, "hero section does not also carry a legacy image when a cover photo is set");
        check((site.business.heroImagePosition ?? "center") === "center", `cover crop focus ${site.business.heroImagePosition ?? "unset (defaults to centre)"}`);
      } else {
        check(!site.business.heroImage, "no cover photo invented for a site without one");
      }
      for (const [kind, url] of Object.entries(industry.expectSocials ?? {})) {
        check(site.business[kind] === url, `${kind} normalised to ${site.business[kind]} (expected ${url})`);
      }
      const socialKeys = ["instagram", "facebook", "tiktok"].filter((k) => site.business[k]);
      check(socialKeys.every((k) => industry.expectSocials?.[k]), socialKeys.length ? `no invented socials (${socialKeys.join(", ")})` : "no invented socials");
    }
    entry.siteId = page.url().match(/\/s\/([^/]+)\//)?.[1];
    if (industry.profilePhoto) {
      const loaded = await page
        .waitForFunction(() => { const i = document.querySelector("header img"); return Boolean(i && i.complete && i.naturalWidth > 0); }, { timeout: 30000 })
        .then(() => true, () => false);
      check(loaded, loaded ? "profile photo loaded in the preview header" : "profile photo did not finish loading within 30s");
    }
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-ready.png`) });
    // Expand the phone preview frame so the whole generated site is captured.
    await page.evaluate(() => {
      const frame = [...document.querySelectorAll("div")].find((d) => d.className.includes("h-[540px]"));
      if (frame) { frame.style.height = "auto"; frame.style.overflow = "visible"; }
    });
    await wait(300);
    if (industry.hero) {
      await page.waitForFunction(() => { const i = document.querySelector("[data-hero-mode] img[data-image=cover]"); return Boolean(i && i.complete && i.naturalWidth > 0); }, { timeout: 30000 }).catch(() => {});
    }
    const previewFacts = () =>
      page.evaluate(() => {
        const link = [...document.querySelectorAll("a")].find((a) => /Open in Google Maps|Buka di Google Maps/.test(a.textContent));
        const header = document.querySelector("header");
        const hero = document.querySelector("[data-hero-mode]");
        const heroImg = hero?.querySelector("img[data-image=cover]");
        const rect = heroImg?.getBoundingClientRect();
        // The frame is the cover's parent: its aspect-ratio comes from the photo's own shape.
        const frame = heroImg?.parentElement?.getBoundingClientRect();
        const heroBox = hero?.getBoundingClientRect();
        // The Desktop tab renders the 1100px site inside a scaled wrapper; a px floor has to be scaled with it.
        const stage = hero?.closest("[style*='scale']");
        const scale = stage?.offsetWidth ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
        return {
          mapsHref: link?.getAttribute("href") ?? null,
          placeholder: [...document.querySelectorAll("span")].some((s) => s.textContent.trim() === "Google Maps"),
          headerPhotoAlt: header?.querySelector("img")?.getAttribute("alt") ?? null,
          headerLogo: Boolean(header?.querySelector("[data-logo] img")),
          heroMode: hero?.getAttribute("data-hero-mode") ?? null,
          heroShape: hero?.getAttribute("data-hero-shape") ?? null,
          heroLayout: hero?.getAttribute("data-hero-layout") ?? null,
          heroW: Math.round(heroBox?.width ?? 0),
          scale,
          heroImg: heroImg ? { loaded: heroImg.complete && heroImg.naturalWidth > 0, natural: [heroImg.naturalWidth, heroImg.naturalHeight], w: Math.round(rect.width), h: Math.round(rect.height), frameW: Math.round(frame.width), frameH: Math.round(frame.height), ratio: Math.round((frame.width / frame.height) * 1000) / 1000, fit: getComputedStyle(heroImg).objectFit } : null,
          heroCta: Boolean(document.querySelector("[data-hero-cta] a")),
          socials: [...document.querySelectorAll("[data-social] a")].map((a) => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel"), label: a.getAttribute("aria-label") })),
          socialBlocks: document.querySelectorAll("[data-social]").length,
          broken: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length,
          emptySrc: document.querySelectorAll("img[src='']").length,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
    const facts = await previewFacts();
    entry.preview = facts;
    if (industry.address) {
      check(Boolean(facts.mapsHref?.startsWith("https://www.google.com/maps/search/?api=1&query=")), `preview has a Google Maps link: ${facts.mapsHref}`);
      check(!facts.placeholder, "no blank 'Google Maps' placeholder box in the preview");
    }
    if (industry.profilePhoto) check(Boolean(facts.headerPhotoAlt), `profile photo rendered in the site header (alt "${facts.headerPhotoAlt}")`);
    if (industry.logo) check(facts.headerLogo, "logo rendered in the site header");
    if (industry.heroMode) check(facts.heroMode === industry.heroMode, `preview hero layout "${facts.heroMode}" (expected ${industry.heroMode})`);
    if (industry.hero) {
      const c = industry.cover;
      check(Boolean(facts.heroImg?.loaded), `cover photo loaded in the preview hero: ${JSON.stringify(facts.heroImg)}`);
      check(facts.heroShape === c.shape && facts.heroLayout === c.layout, `${c.w}×${c.h} cover framed as ${facts.heroShape} ${facts.heroLayout} (expected ${c.shape} ${c.layout})`);
      check(ratioNear(facts.heroImg, c.mobileRatio), `mobile frame ${facts.heroImg?.frameW}×${facts.heroImg?.frameH} keeps ratio ${c.mobileRatio.toFixed(3)} — ${c.mobileCrop}`);
      check(Math.abs((facts.heroImg?.w ?? 0) - facts.heroW) <= 2, `mobile cover is full-bleed (${facts.heroImg?.w} of ${facts.heroW}px)`);
    } else {
      check(!facts.heroImg || facts.heroImg.loaded, "no broken hero image on a site without a cover photo");
    }
    check(facts.heroCta, "hero has a visible CTA button");
    const expectedSocials = Object.values(industry.expectSocials ?? {});
    check(facts.socials.length === expectedSocials.length && expectedSocials.every((u) => facts.socials.some((s) => s.href === u)), `social icons in the preview: ${facts.socials.map((s) => s.href).join(", ") || "none"} (expected ${expectedSocials.join(", ") || "none"})`);
    if (expectedSocials.length) {
      check(facts.socialBlocks === 1, `social icons appear exactly once (${facts.socialBlocks} block(s))`);
      check(facts.socials.every((s) => s.target === "_blank" && /noopener/.test(s.rel ?? "") && s.label), "social links open a new tab with rel=noopener and an accessible label");
    } else {
      check(facts.socialBlocks === 0, "no empty social section");
    }
    check(facts.broken === 0 && facts.emptySrc === 0, `${facts.broken} broken / ${facts.emptySrc} empty image(s) in the preview`);
    check(!facts.overflow, "no horizontal overflow in the mobile preview");
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-site.png`), fullPage: true });
    if (industry.desktop) {
      // The Ready screen's Desktop tab renders the same site in an 1100px frame (container queries switch layouts).
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector("[role=tab]", { timeout: 20000 });
      await clickText(page, "[role=tab]", "Desktop");
      await page.waitForFunction(() => document.querySelector("[data-hero-mode]")?.closest("[style*='scale']") !== null, { timeout: 20000 });
      if (industry.hero) await page.waitForFunction(() => { const i = document.querySelector("[data-hero-mode] img[data-image=cover]"); return Boolean(i && i.complete && i.naturalWidth > 0); }, { timeout: 30000 }).catch(() => {});
      await wait(500);
      const d = await previewFacts();
      entry.previewDesktop = d;
      check(d.heroMode === industry.heroMode, `desktop preview hero layout "${d.heroMode}"`);
      if (industry.hero) {
        const c = industry.cover;
        check(Boolean(d.heroImg?.loaded), `desktop cover photo loaded: ${JSON.stringify(d.heroImg)}`);
        // The full-width backdrop is never shorter than the copy laid over it (min-h-[420px]), so on a
        // narrow desktop a very wide banner loses a little height; every other shape is shown whole.
        const floor = c.layout.endsWith("overlay") ? HERO_MIN_H * d.scale : 0;
        const wantH = Math.max((d.heroImg?.frameW ?? 0) / c.desktopRatio, floor);
        check(d.heroLayout === c.layout && Math.abs((d.heroImg?.frameH ?? 0) - wantH) <= 3, `desktop frame ${d.heroImg?.frameW}×${d.heroImg?.frameH} is ${Math.round(wantH)}px tall: ${c.desktopRatio.toFixed(3)} ${floor && wantH > (d.heroImg?.frameW ?? 0) / c.desktopRatio ? "trimmed to the copy's height" : "whole"} (${d.heroLayout})`);
        if (c.layout.endsWith("overlay")) check(Math.abs((d.heroImg?.w ?? 0) - d.heroW) <= 2, `desktop cover is the full-width backdrop (${d.heroImg?.w} of ${d.heroW}px)`);
        else check((d.heroImg?.w ?? 0) < d.heroW * 0.6 && (d.heroImg?.w ?? 0) > d.heroW * 0.2, `desktop cover sits whole beside the copy (${d.heroImg?.w} of ${d.heroW}px)`);
      }
      check(d.socials.length === expectedSocials.length, `desktop preview has ${d.socials.length} social icon(s)`);
      check(d.broken === 0, `${d.broken} broken image(s) in the desktop preview`);
      await page.screenshot({ path: path.join(shots, `industry-${industry.key}-desktop.png`), fullPage: true });
    }
  } catch (e) {
    entry.errors.push(String(e.message).split("\n")[0]);
    failed++;
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-fail.png`), fullPage: true }).catch(() => {});
  }
  report.push(entry);
  const bad = entry.checks.filter((c) => !c.ok).map((c) => c.label);
  console.log(`${entry.errors.length || bad.length ? "FAIL" : "ok  "} ${industry.key}: ${entry.understand?.category ?? "?"}/${entry.understand?.language ?? "?"} → sections [${entry.site?.sections?.join(", ") ?? "-"}] cta "${entry.site?.cta?.label ?? "-"}" (${entry.generate?.model ?? "-"}, understand ${entry.understand?.ms ?? "-"}ms, generate ${entry.generate?.ms ?? "-"}ms)`);
  for (const b of bad) console.log(`     ✗ ${b}`);
  for (const err of entry.errors) console.log(`     ! ${err}`);
  await context.close();
}

writeFileSync(path.join(shots, "industries-report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(`\n${failed ? `${failed} check(s) failed` : "all checks passed"} — report: scripts/qa/shots/industries-report.json`);
process.exit(failed ? 1 : 0);
