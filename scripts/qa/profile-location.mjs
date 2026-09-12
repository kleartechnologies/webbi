// Phase 11 + 12 QA: profile photo / logo, cover photo, social links and the location
// experience. Runs against a dev server on the Firebase emulators with AI_PROVIDER=mock
// and PAYMENT_PROVIDER=mock (same setup as qa:publish):
//
//   QA_BASE_URL=http://localhost:3000 npm run qa:profile-location
//
// Scenarios: (A) car sales advisor with a full address, a profile photo, a cover photo
// and social handles, through ready → publish → public page (map embed, Google Maps
// link, hero + social icons at 390 / 768 / 1280) → editor remove/restore of both images;
// (B) restaurant with an address, a logo and a cover photo but no profile-photo field,
// published and checked on mobile + desktop; (C) a business with no location at all.
// Screenshots land in scripts/qa/shots/ (git-ignored).
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageInput, profilePhotoInput, writeAvatarPng, writeCoverPng, writeLogoPng } from "./lib.mjs";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });
const avatar = writeAvatarPng(path.join(shots, "qa-avatar.png"));
const cover = writeCoverPng(path.join(shots, "qa-cover.png"));
const logoPng = writeLogoPng(path.join(shots, "qa-logo.png"));

const ADDRESS = "No. 9257C, Jalan Balakong, 43300 Balakong, Selangor (berdekatan kawasan Amerin Mall)";
const MAPS_QUERY = "No.%209257C%2C%20Jalan%20Balakong%2C%2043300%20Balakong%2C%20Selangor";
const MAPS_HREF = `https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`;
const CAR = `Saya Amir, seorang Sales Advisor Perodua di Balakong.

Saya bantu customer cari kereta Perodua baru yang sesuai dengan bajet mereka. Saya boleh bantu urus loan, trade-in dan pendaftaran kereta.

Model yang saya jual termasuk Axia, Bezza, Myvi, Ativa, Alza dan Aruz.

Customer boleh WhatsApp saya untuk semak promo terkini, monthly payment atau book test drive.

Saya cover kawasan Balakong, Cheras, Kajang dan Seri Kembangan.`;
const RESTAURANT =
  "Saya buka kedai makan Warung Mak Nah di Kajang. Jual nasi lemak, mee goreng dan lauk kampung, semua halal dan masak sendiri. Buka 7 pagi sampai 3 petang. Customer biasa order ikut WhatsApp 012-345 6789.";
const NO_LOCATION = "Saya jual kuih raya homemade, tempahan online sahaja. Kuih semperit, tart nenas dan biskut cornflakes. WhatsApp untuk tempah.";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"],
});
const mobile = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const tablet = { width: 768, height: 1024, deviceScaleFactor: 1 };
const desktop = { width: 1280, height: 900, deviceScaleFactor: 1 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
let failed = 0;
const results = [];
const step = async (page, name, fn) => {
  try { await fn(); results.push({ ok: true, name }); console.log(`ok   ${name}`); } catch (e) {
    failed++;
    results.push({ ok: false, name, error: String(e.message).split("\n")[0] });
    console.log(`FAIL ${name} at ${page.url()}: ${String(e.message).split("\n")[0]}`);
    await page.screenshot({ path: path.join(shots, `p12-fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), fullPage: true }).catch(() => {});
  }
};
const clickText = async (page, sel, label, exact = false) => {
  for (const el of await page.$$(sel)) {
    const t = (await el.evaluate((e) => e.textContent)).trim();
    if (exact ? t === label : t.includes(label)) { await el.evaluate((e) => e.click()); return true; }
  }
  throw new Error(`No ${sel} with text "${label}"`);
};
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const retype = async (page, sel, value) => { await page.$eval(sel, (e) => { e.focus(); e.select(); }); await page.keyboard.type(value); };

/** /start → confirm (fills WhatsApp + optional address / social handles) → content. Returns the generate API body once built. */
async function onboard(page, description, { address, name, socials } = {}) {
  const api = {};
  const onResponse = async (res) => {
    if (res.url().includes("/api/ai/generate") && res.request().method() === "POST") {
      try { api.generate = await res.json(); } catch { /* ignore */ }
    }
  };
  page.on("response", onResponse);
  await page.goto(`${base}/start`, { waitUntil: "load" });
  await page.waitForSelector("textarea", { timeout: 20000 });
  await page.type("textarea", description);
  await clickText(page, "button", "Continue", true);
  await page.waitForFunction(() => location.pathname.includes("/confirm"), { timeout: 60000 });
  await page.waitForSelector("#name", { timeout: 20000 });
  if (name) await retype(page, "#name", name);
  if (!(await page.$eval("#whatsapp", (e) => e.value))) await page.type("#whatsapp", "0123456789");
  if (address || socials) {
    if (!(await page.$("#address"))) await clickText(page, "button", "Address & social media");
    await page.waitForSelector("#address", { timeout: 5000 });
    if (address) await page.type("#address", address);
    for (const [kind, value] of Object.entries(socials ?? {})) await retype(page, `#${kind}`, value);
  }
  await clickText(page, "button", "Looks right");
  await page.waitForFunction(() => location.pathname.includes("/content"), { timeout: 20000 });
  await page.waitForSelector("h1", { timeout: 20000 });
  await wait(300);
  return {
    api,
    build: async () => {
      await clickText(page, "button", "Build my website");
      await page.waitForFunction(() => location.pathname.includes("/ready"), { timeout: 120000 });
      await wait(500);
      return { siteId: page.url().match(/\/s\/([^/]+)\//)?.[1], site: api.generate?.site };
    },
    done: () => page.off("response", onResponse),
  };
}

/** Mobile preview on the Ready screen (and the editor) is a scaled frame; expand it for full-page shots. */
const expandPreview = (page) =>
  page.evaluate(() => {
    const frame = [...document.querySelectorAll("div")].find((d) => d.className.includes("h-[540px]"));
    if (frame) { frame.style.height = "auto"; frame.style.overflow = "visible"; }
  });

/** Uploads `file` through one of the image cards and waits for its preview + Replace button. */
const uploadTo = async (page, id, file) => {
  await (await imageInput(page, id)).uploadFile(file);
  await page.waitForSelector(`#${id} img`, { timeout: 30000 });
  await page.waitForFunction(
    (sel) => [...document.querySelector(sel).closest("[data-image-field]").querySelectorAll("button")].some((b) => b.textContent.trim() === "Replace"),
    { timeout: 30000 },
    `#${id}`,
  );
};
/** Clicks Replace/Remove inside one image card (there are two or three cards on the page). */
const cardButton = async (page, kind, label) => {
  const ok = await page.evaluate((k, l) => {
    const b = [...document.querySelector(`[data-image-field=${k}]`)?.querySelectorAll("button") ?? []].find((x) => x.textContent.trim() === l);
    if (b) b.click();
    return Boolean(b);
  }, kind, label);
  expect(ok, `no "${label}" button in the ${kind} card`);
};
const waitHeroLoaded = (page) =>
  page.waitForFunction(() => { const i = document.querySelector("[data-hero-mode] img[data-image=cover]"); return Boolean(i && i.complete && i.naturalWidth > 0); }, { timeout: 30000 });

const heroFacts = (page) =>
  page.evaluate(() => {
    const hero = document.querySelector("[data-hero-mode]");
    // The cover photo only — a person-led hero also shows the (round) profile photo.
    const img = hero?.querySelector("img[data-image=cover]");
    const r = img?.getBoundingClientRect();
    const box = hero?.getBoundingClientRect();
    return {
      mode: hero?.getAttribute("data-hero-mode") ?? null,
      img: img ? { loaded: img.complete && img.naturalWidth > 0, w: Math.round(r.width), h: Math.round(r.height), fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition, alt: img.getAttribute("alt") } : null,
      heroHeight: Math.round(box?.height ?? 0),
      cta: Boolean(document.querySelector("[data-hero-cta] a")),
      background: hero ? getComputedStyle(hero).backgroundColor : null,
      headerLogo: Boolean(document.querySelector("header [data-logo] img")),
      headerImgAlt: document.querySelector("header img")?.getAttribute("alt") ?? null,
      socials: [...document.querySelectorAll("[data-social] a")].map((a) => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel"), label: a.getAttribute("aria-label"), section: a.closest("section")?.id ?? a.closest("footer")?.tagName.toLowerCase() ?? null })),
      socialBlocks: document.querySelectorAll("[data-social]").length,
      broken: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.getAttribute("src")?.startsWith("data:")).length,
      emptySrc: document.querySelectorAll("img[src='']").length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      width: window.innerWidth,
    };
  });

/** Waits for the editor's autosave: the indicator leaves "Saved" (debounce ~1s) and comes back to it. */
const savedOn = async (page) => {
  await page
    .waitForFunction(() => ![...document.querySelectorAll("[role=status]")].some((e) => /^\s*Saved\s*$/.test(e.textContent)), { timeout: 3000 })
    .catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some((e) => /^\s*Saved\s*$/.test(e.textContent)), { timeout: 20000 });
  await wait(300);
};

/** Publish (mock payment) from the Ready screen with a unique slug; returns the slug. */
async function publish(page, { name, slug, tag }) {
  await clickText(page, "a", "Publish");
  await page.waitForFunction(() => location.pathname.endsWith("/account"), { timeout: 15000 });
  await page.waitForSelector("#auth-email", { timeout: 15000 });
  const nameField = await page.$("#auth-name");
  if (nameField) await nameField.type(name);
  await page.type("#auth-email", `qa-${slug}-${tag}@example.com`);
  await page.type("#auth-password", "password123");
  await page.click("button[type=submit]");
  await page.waitForFunction(() => location.pathname.endsWith("/publish"), { timeout: 30000 });
  await page.waitForSelector("#slug", { timeout: 15000 });
  // A unique slug so repeated runs against the same emulator don't collide ("Taken. Use amir-2").
  const full = `${slug}-${tag}`;
  await retype(page, "#slug", full);
  await page.waitForFunction(() => /Available/.test(document.body.innerText), { timeout: 15000 });
  expect((await page.$eval("#slug", (e) => e.value)) === full, "slug not accepted");
  await clickText(page, "button", "Pay RM149.90");
  await page.waitForFunction(() => location.pathname.endsWith("/live"), { timeout: 30000 });
  return full;
}

const CAR_SOCIALS = { instagram: "@amir.perodua", tiktok: "https://www.tiktok.com/@amir.perodua" };
const CAR_SOCIAL_URLS = { instagram: "https://www.instagram.com/amir.perodua/", tiktok: "https://www.tiktok.com/@amir.perodua" };
const REST_SOCIALS = { instagram: "https://instagram.com/warungmaknah", facebook: "warungmaknah" };
const REST_SOCIAL_URLS = { instagram: "https://www.instagram.com/warungmaknah/", facebook: "https://www.facebook.com/warungmaknah" };

const expectSocials = (facts, urls, where) => {
  const want = Object.values(urls);
  expect(facts.socials.length === want.length && want.every((u) => facts.socials.some((s) => s.href === u)), `social icons ${JSON.stringify(facts.socials.map((s) => s.href))} ≠ ${JSON.stringify(want)}`);
  expect(facts.socialBlocks === 1, `${facts.socialBlocks} social blocks (want exactly 1)`);
  expect(facts.socials.every((s) => s.target === "_blank" && /noopener/.test(s.rel ?? "") && s.label), "social links must open a new tab with rel=noopener and an aria-label");
  if (where) expect(facts.socials.every((s) => s.section === where), `social icons live in ${JSON.stringify([...new Set(facts.socials.map((s) => s.section))])}, expected ${where}`);
};

const locationFacts = (page) =>
  page.evaluate(() => {
    const link = [...document.querySelectorAll("a")].find((a) => /Open in Google Maps|Buka di Google Maps/.test(a.textContent));
    const iframe = document.querySelector("iframe");
    return {
      href: link?.getAttribute("href") ?? null,
      linkHeight: link?.getBoundingClientRect().height ?? 0,
      iframeSrc: iframe?.getAttribute("src") ?? null,
      placeholder: [...document.querySelectorAll("span")].some((s) => s.textContent.trim() === "Google Maps"),
      addressShown: document.body.innerText.includes("9257C"),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });

const profileFacts = (page) =>
  page.evaluate(() => {
    const imgs = [...document.querySelectorAll("header img, h1 ~ *, main img")].filter((i) => /amir|profile|img_/i.test(i.getAttribute("src") ?? ""));
    const header = document.querySelector("header");
    const headerImg = header?.querySelector("img");
    const initial = header ? [...header.querySelectorAll("span")].find((s) => s.textContent.trim().length === 1 && s.className.includes("bg-site-accent")) : null;
    const heroImgs = [...document.querySelectorAll("img")].filter((i) => i.closest("header") === null && i.getBoundingClientRect().width > 0 && i.getBoundingClientRect().width <= 100 && i.getAttribute("alt"));
    return {
      headerImgAlt: headerImg?.getAttribute("alt") ?? null,
      headerImgWidth: headerImg?.getBoundingClientRect().width ?? 0,
      initial: initial?.textContent.trim() ?? null,
      heroPhoto: heroImgs.map((i) => ({ alt: i.getAttribute("alt"), width: Math.round(i.getBoundingClientRect().width) })),
      brokenImages: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.getAttribute("src")?.startsWith("data:")).length,
      count: imgs.length,
    };
  });

// ---------------------------------------------------------------------------
// Scenario A: car sales advisor, full address, profile photo
// ---------------------------------------------------------------------------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(mobile);
  page.on("pageerror", (e) => console.log("     pageerror:", e.message));
  let flow, siteId, site, slug;
  const tag = Date.now().toString(36).slice(-5);
  /** Generated sections get random ids; the icons must sit in the about section (person-led). */
  const aboutId = () => `s-${site.sections.find((s) => s.type === "about")?.id}`;

  await step(page, "A1 car advisor: understand → confirm with address + socials → content shows profile + cover cards", async () => {
    flow = await onboard(page, CAR, { address: ADDRESS, name: "Amir", socials: CAR_SOCIALS });
    await page.waitForSelector("#profile-photo", { timeout: 15000 }).catch(() => { throw new Error("profile photo field missing for a car sales advisor"); });
    const label = await page.evaluate(() => document.querySelector("label[for=profile-photo]")?.textContent?.trim());
    expect(label === "Your profile photo", `label "${label}"`);
    const text = await bodyText(page);
    expect(text.includes("Add a professional photo so customers know who they"), "profile helper text missing");
    expect(text.includes("Recommended: square portrait, 1000 × 1000 px or larger"), "profile size guidance missing");
    expect(await page.$("#hero-image"), "cover photo card missing");
    const heroLabel = await page.evaluate(() => document.querySelector("label[for=hero-image]")?.textContent?.trim());
    expect(heroLabel === "Hero / cover photo", `cover label "${heroLabel}"`);
    expect(text.includes("Make your website instantly feel like your business."), "cover helper text missing");
    expect(text.includes("Recommended: 1600 × 900 px (16:9)") && text.includes("Landscape works best"), "cover size guidance missing");
    expect(text.includes("Upload cover photo"), "Upload cover photo button missing");
    expect(!(await page.$("#business-logo")), "person-led business must not get a logo card");
  });

  await step(page, "A2 upload profile photo + cover photo (owner's own Storage folder), previews with Replace / Remove", async () => {
    await uploadTo(page, "profile-photo", avatar);
    await uploadTo(page, "hero-image", cover);
    const buttons = await page.evaluate(() => Object.fromEntries(["profile", "hero"].map((k) => [k, [...document.querySelector(`[data-image-field=${k}]`).querySelectorAll("button")].map((b) => b.textContent.trim())])));
    expect(buttons.profile.includes("Replace") && buttons.profile.includes("Remove"), `profile buttons ${buttons.profile}`);
    expect(buttons.hero.includes("Replace") && buttons.hero.includes("Remove"), `hero buttons ${buttons.hero}`);
    expect(buttons.hero.join(",").includes("Centre,Top,Bottom"), `crop focus chips ${buttons.hero}`);
    await cardButton(page, "hero", "Top");
    await wait(800);
    await page.screenshot({ path: path.join(shots, "p12-content-uploads.png"), fullPage: true });
  });

  await step(page, "A3 build → generate keeps photo, cover, position, socials + address (mock provider)", async () => {
    ({ siteId, site } = await flow.build());
    flow.done();
    expect(site, "no site in generate response");
    expect(site.business.category === "car", `category ${site.business.category}`);
    expect(site.business.profilePhoto?.path?.startsWith("users/"), "profilePhoto missing from generated site");
    expect(site.business.heroImage?.path?.startsWith("users/"), "heroImage missing from generated site");
    expect(site.business.heroImagePosition === "top", `heroImagePosition ${site.business.heroImagePosition}`);
    expect(!site.business.logo, "person-led site must not carry a logo");
    const hero = site.sections.find((s) => s.type === "hero");
    expect(hero?.presentationMode === "person", `hero presentationMode ${hero?.presentationMode}`);
    expect(hero.image === undefined, "hero section still carries a legacy image");
    expect(site.business.instagram === CAR_SOCIAL_URLS.instagram, `instagram ${site.business.instagram}`);
    expect(site.business.tiktok === CAR_SOCIAL_URLS.tiktok, `tiktok ${site.business.tiktok}`);
    expect(!site.business.facebook, `facebook invented: ${site.business.facebook}`);
    expect(site.business.address === ADDRESS, `business.address = ${site.business.address}`);
    const loc = site.sections.find((s) => s.type === "location");
    expect(loc && loc.address === ADDRESS, "location section lost the address");
  });

  await step(page, "A4 ready preview: person hero with cover + photo, social icons once, address card, Maps link", async () => {
    await page.screenshot({ path: path.join(shots, "p12-ready-mobile.png") });
    await expandPreview(page);
    await waitHeroLoaded(page);
    await wait(300);
    const loc = await locationFacts(page);
    expect(!loc.placeholder, "preview still shows the 'Google Maps' placeholder box");
    expect(!loc.iframeSrc, "preview should not embed the map");
    expect(loc.href === MAPS_HREF, `maps link ${loc.href}`);
    expect(loc.addressShown, "address not shown in preview");
    const prof = await profileFacts(page);
    expect(prof.headerImgAlt === "Amir", `header photo alt ${prof.headerImgAlt}`);
    expect(prof.initial === null, "initial avatar still shown next to the photo");
    expect(prof.heroPhoto.length >= 1, "hero photo missing");
    expect(prof.brokenImages === 0, `${prof.brokenImages} broken image(s)`);
    const h = await heroFacts(page);
    expect(h.mode === "person", `hero mode ${h.mode}`);
    expect(h.img?.loaded && h.img.fit === "cover" && /top|0%/.test(h.img.pos), `cover ${JSON.stringify(h.img)}`);
    expect(h.cta, "hero CTA missing");
    expectSocials(h, CAR_SOCIAL_URLS, aboutId());
    expect(h.emptySrc === 0, "empty img src in preview");
    await page.screenshot({ path: path.join(shots, "p12-ready-site.png"), fullPage: true });
  });

  await step(page, "A5 publish (mock payment) → live", async () => {
    slug = await publish(page, { name: "Amir", slug: "amir-p12", tag });
  });

  const visitorCtx = await browser.createBrowserContext();
  const visitor = await visitorCtx.newPage();
  let publicLoc, publicHero;

  await step(visitor, "A6 public page (mobile): keyless Google Maps embed loads, link + address + photo", async () => {
    await visitor.setViewport(mobile);
    const res = await visitor.goto(`${base}/w/${slug}`, { waitUntil: "networkidle2", timeout: 60000 });
    expect(res.status() === 200, `status ${res.status()}`);
    publicLoc = await locationFacts(visitor);
    expect(publicLoc.iframeSrc === `https://www.google.com/maps?q=${MAPS_QUERY}&output=embed`, `embed src ${publicLoc.iframeSrc}`);
    expect(publicLoc.href === MAPS_HREF, `maps link ${publicLoc.href}`);
    expect(publicLoc.addressShown, "address missing on public page");
    expect(!publicLoc.placeholder, "placeholder on public page");
    expect(publicLoc.scrollWidth <= publicLoc.innerWidth, `horizontal overflow: ${publicLoc.scrollWidth} > ${publicLoc.innerWidth}`);
    expect(publicLoc.linkHeight >= 44, `maps CTA only ${publicLoc.linkHeight}px tall`);
    // Scroll the map into view (lazy iframe) and wait for Google's embed page to load inside it.
    await visitor.$eval("iframe", (f) => f.scrollIntoView({ block: "center" }));
    const deadline = Date.now() + 30000;
    let frame;
    while (Date.now() < deadline) {
      frame = visitor.frames().find((f) => f.url().includes("google.com/maps"));
      if (frame && frame.url().includes("/maps/embed")) break;
      await wait(500);
    }
    expect(frame, "map iframe never navigated to google.com/maps");
    expect(frame.url().includes("/maps/embed"), `map frame stuck at ${frame.url()}`);
    await wait(4000);
    const inner = await frame.evaluate(() => ({
      title: document.title,
      text: document.body?.innerText?.slice(0, 200) ?? "",
      tiles: document.querySelectorAll("img, canvas").length,
    })).catch((e) => ({ error: e.message }));
    console.log(`     map frame: ${frame.url().slice(0, 80)}… ${JSON.stringify(inner).slice(0, 220)}`);
    expect(!inner.error && inner.tiles > 0, `map frame has no tiles: ${JSON.stringify(inner)}`);
    const prof = await profileFacts(visitor);
    expect(prof.headerImgAlt === "Amir" && prof.headerImgWidth === 32, `header photo ${JSON.stringify(prof)}`);
    expect(prof.heroPhoto.some((p) => p.alt === "Amir" && p.width === 88), `hero photo ${JSON.stringify(prof.heroPhoto)}`);
    expect(prof.brokenImages === 0, `${prof.brokenImages} broken image(s)`);
    await visitor.evaluate(() => window.scrollTo(0, 0));
    await waitHeroLoaded(visitor);
    const h = await heroFacts(visitor);
    publicHero = h;
    expect(h.mode === "person", `public hero mode ${h.mode}`);
    expect(h.img?.loaded && h.img.fit === "cover" && /top|0%/.test(h.img.pos), `public cover ${JSON.stringify(h.img)}`);
    // 16:10 crop at 390px wide: roughly 350×219 (page gutters), never the full 640×360 image height.
    expect(h.img.w >= 300 && h.img.w <= 390 && Math.abs(h.img.h - h.img.w * 0.625) < 4, `mobile cover crop ${h.img.w}×${h.img.h}`);
    expect(h.cta, "public hero CTA missing");
    expectSocials(h, CAR_SOCIAL_URLS, aboutId());
    expect(h.emptySrc === 0 && !h.overflow, "empty img or overflow on public mobile");
    await visitor.screenshot({ path: path.join(shots, "p12-public-mobile.png"), fullPage: true });
    await (await visitor.evaluateHandle(() => document.querySelector("[data-hero-mode]"))).asElement().screenshot({ path: path.join(shots, "p12-public-mobile-hero.png") });
    const section = await visitor.$("iframe");
    await (await section.evaluateHandle((f) => f.closest("section"))).asElement().screenshot({ path: path.join(shots, "p12-public-mobile-location.png") });
  });

  await step(visitor, "A7 public page (768 tablet + 1280 desktop): same hero image + socials, split layout, no overflow", async () => {
    for (const [name, vp] of [["tablet", tablet], ["desktop", desktop]]) {
      await visitor.setViewport(vp);
      await visitor.goto(`${base}/w/${slug}`, { waitUntil: "networkidle2", timeout: 60000 });
      await waitHeroLoaded(visitor);
      const h = await heroFacts(visitor);
      expect(h.mode === "person" && h.img?.loaded && h.img.fit === "cover", `${name} hero ${JSON.stringify(h.img)}`);
      expect(h.img.alt === publicHero.img.alt, `${name} hero image differs from mobile`);
      expectSocials(h, CAR_SOCIAL_URLS, aboutId());
      expect(!h.overflow && h.broken === 0, `${name}: overflow ${h.overflow}, broken ${h.broken}`);
      if (name === "desktop") {
        // Side-by-side at @3xl: the cover sits beside the copy, 4:3, not full width.
        expect(h.img.w < 700 && h.img.w > 380 && Math.abs(h.img.h - h.img.w * 0.75) < 4, `desktop cover crop ${h.img.w}×${h.img.h}`);
      }
      const loc = await locationFacts(visitor);
      expect(loc.href === MAPS_HREF && loc.iframeSrc, `${name} location mismatch`);
      await visitor.screenshot({ path: path.join(shots, `p12-public-${name}.png`), fullPage: true });
    }
    await visitor.$eval("iframe", (f) => f.scrollIntoView({ block: "center" }));
    await wait(3000);
  });

  await step(visitor, "A8 'Buka di Google Maps' opens Google Maps at the supplied address", async () => {
    const maps = await visitorCtx.newPage();
    await maps.setViewport(mobile);
    const res = await maps.goto(MAPS_HREF, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);
    await wait(2000);
    const info = { status: res?.status(), url: maps.url(), title: await maps.title() };
    console.log(`     google maps: ${info.status} ${info.title} — ${info.url.slice(0, 120)}`);
    await maps.screenshot({ path: path.join(shots, "p12-google-maps-destination.png") });
    expect(info.url.includes("google.com/maps"), `unexpected destination ${info.url}`);
    expect(/balakong/i.test(info.title) || /balakong/i.test(decodeURIComponent(info.url)), `Google Maps did not resolve Balakong: ${info.title}`);
    await maps.close();
  });


  const saved = () => savedOn(page);

  await step(page, "A9 editor: Remove cover → category fallback instantly (no box, CTA kept); re-upload restores it", async () => {
    await page.setViewport(desktop);
    await page.goto(`${base}/s/${siteId}/edit`, { waitUntil: "load" });
    await page.waitForSelector("#biz-tagline", { timeout: 15000 });
    await page.waitForSelector("#profile-photo img", { timeout: 15000 });
    await page.waitForSelector("#hero-image img", { timeout: 15000 });
    expect(await page.$("[data-social] a"), "social icons missing from the editor preview");
    const socialInputs = await page.evaluate(() => ({ ig: document.querySelector("#biz-instagram")?.value, fb: document.querySelector("#biz-facebook")?.value, tt: document.querySelector("#biz-tiktok")?.value }));
    expect(socialInputs.ig === CAR_SOCIAL_URLS.instagram && socialInputs.tt === CAR_SOCIAL_URLS.tiktok && !socialInputs.fb, `editor social fields ${JSON.stringify(socialInputs)}`);
    await cardButton(page, "hero", "Remove");
    await page.waitForFunction(() => !document.querySelector("#hero-image img"), { timeout: 5000 });
    await saved();
    const h = await heroFacts(page);
    expect(h.mode === "person" && !h.img, `after cover removal: ${JSON.stringify({ mode: h.mode, img: h.img })}`);
    expect(h.cta && h.broken === 0 && h.emptySrc === 0, "fallback hero lost its CTA or shows a broken image");
    expect(h.headerImgAlt === "Amir", "profile photo must survive removing the cover");
    await page.screenshot({ path: path.join(shots, "p12-editor-cover-removed.png") });
    await uploadTo(page, "hero-image", cover);
    await saved();
    await waitHeroLoaded(page);
    const back = await heroFacts(page);
    expect(back.img?.loaded, "cover not back in the preview hero");
    await page.screenshot({ path: path.join(shots, "p12-editor-cover-restored.png") });
  });

  await step(page, "A10 editor: Remove profile photo → initial avatar; cover stays; re-add photo", async () => {
    await cardButton(page, "profile", "Remove");
    await page.waitForFunction(() => !document.querySelector("#profile-photo img"), { timeout: 5000 });
    await saved();
    const prof = await page.evaluate(() => {
      const header = document.querySelector("header");
      const initial = header ? [...header.querySelectorAll("span")].find((s) => s.className.includes("bg-site-accent")) : null;
      return { initial: initial?.textContent.trim() ?? null, headerImg: Boolean(header?.querySelector("img")) };
    });
    expect(prof.initial === "A" && !prof.headerImg, `fallback wrong: ${JSON.stringify(prof)}`);
    const h = await heroFacts(page);
    expect(h.img?.loaded, "cover photo lost when the profile photo was removed");
    await page.screenshot({ path: path.join(shots, "p12-editor-profile-removed.png") });
    const input = await profilePhotoInput(page);
    await input.uploadFile(avatar);
    await page.waitForSelector("#profile-photo img", { timeout: 30000 });
    await saved();
    expect(await page.evaluate(() => Boolean(document.querySelector("header img"))), "photo not back in the preview header");
    await page.screenshot({ path: path.join(shots, "p12-editor-profile-restored.png") });
  });

  await step(page, "A11 editor: invalid social input is rejected, valid one normalises live", async () => {
    await retype(page, "#biz-facebook", "javascript:alert(1)");
    await page.$eval("#biz-facebook", (e) => e.blur());
    await wait(600);
    const bad = await page.evaluate(() => ({
      error: document.querySelector("#biz-facebook")?.getAttribute("aria-invalid"),
      links: [...document.querySelectorAll("[data-social] a")].map((a) => a.getAttribute("href")),
    }));
    expect(bad.error === "true", "javascript: URL not flagged invalid");
    expect(!bad.links.some((l) => /javascript/i.test(l)), "javascript: link rendered in the preview");
    await retype(page, "#biz-facebook", "ABC Kitchen");
    await page.$eval("#biz-facebook", (e) => e.blur());
    await wait(600);
    expect(!(await page.$$eval("[data-social] a", (as) => as.some((a) => /ABC/i.test(a.getAttribute("href"))))), "free text became a Facebook link");
    expect((await page.$eval("#biz-facebook", (e) => e.value)) === "ABC Kitchen", "typed text was mangled");
    await retype(page, "#biz-facebook", "@amir.perodua");
    await page.$eval("#biz-facebook", (e) => e.blur());
    await saved();
    expect((await page.$eval("#biz-facebook", (e) => e.value)) === "https://www.facebook.com/amir.perodua", "handle not shown as its canonical URL after leaving the field");
    const links = await page.$$eval("[data-social] a", (as) => as.map((a) => a.getAttribute("href")));
    expect(links.includes("https://www.facebook.com/amir.perodua"), `facebook handle not normalised: ${links}`);
    await page.screenshot({ path: path.join(shots, "p12-editor-socials.png") });
  });

  await visitorCtx.close();
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario B: restaurant (business-led) with an address, no photo field
// ---------------------------------------------------------------------------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(mobile);
  let flow, site, siteId, slug;
  const tag = Date.now().toString(36).slice(-5);
  const contactId = () => `s-${site.sections.find((s) => s.type === "contact")?.id}`;
  await step(page, "B1 restaurant: logo + cover cards, no profile photo field on the Content step", async () => {
    flow = await onboard(page, RESTAURANT, { address: "12, Jalan Reko, 43000 Kajang, Selangor", socials: REST_SOCIALS });
    await page.waitForSelector("#business-logo", { timeout: 15000 }).catch(() => { throw new Error("business logo card missing for a restaurant"); });
    expect(!(await page.$("#profile-photo")), "restaurant got a profile photo field");
    const text = await bodyText(page);
    expect(!text.toLowerCase().includes("profile photo"), "restaurant mentions a profile photo");
    const label = await page.evaluate(() => document.querySelector("label[for=business-logo]")?.textContent?.trim());
    expect(label === "Business logo", `logo label "${label}"`);
    expect(text.includes("Recommended: square image, 1000 × 1000 px or larger") && text.includes("Square works best"), "logo guidance missing");
    expect(await page.$("#hero-image"), "cover photo card missing");
  });

  await step(page, "B2 restaurant: upload logo + cover → generated site keeps both, no profilePhoto, socials normalised", async () => {
    await uploadTo(page, "business-logo", logoPng);
    await uploadTo(page, "hero-image", cover);
    await page.screenshot({ path: path.join(shots, "p12-restaurant-content.png"), fullPage: true });
    ({ site, siteId } = await flow.build());
    flow.done();
    expect(site.business.category === "restaurant", `category ${site.business.category}`);
    expect(!site.business.profilePhoto, "restaurant carries a profilePhoto");
    expect(site.business.logo?.path?.startsWith("users/"), "logo missing from generated site");
    expect(site.business.heroImage?.path?.startsWith("users/"), "heroImage missing from generated site");
    expect(site.sections.find((s) => s.type === "hero")?.presentationMode === "visual", "restaurant hero should use the visual layout");
    expect(site.business.instagram === REST_SOCIAL_URLS.instagram && site.business.facebook === REST_SOCIAL_URLS.facebook && !site.business.tiktok, `socials ${JSON.stringify([site.business.instagram, site.business.facebook, site.business.tiktok])}`);
  });

  await step(page, "B3 restaurant preview: visual hero with cover, logo in header, socials in contact, address card", async () => {
    await expandPreview(page);
    await waitHeroLoaded(page);
    await wait(300);
    const loc = await locationFacts(page);
    expect(!loc.placeholder && !loc.iframeSrc, "restaurant preview shows a map box");
    expect(loc.href === "https://www.google.com/maps/search/?api=1&query=12%2C%20Jalan%20Reko%2C%2043000%20Kajang%2C%20Selangor", `maps link ${loc.href}`);
    const h = await heroFacts(page);
    expect(h.mode === "visual" && h.img?.loaded && h.img.fit === "cover", `hero ${JSON.stringify({ mode: h.mode, img: h.img })}`);
    expect(h.headerLogo, "logo not shown in the header");
    expect(h.cta, "hero CTA missing");
    expectSocials(h, REST_SOCIAL_URLS, contactId());
    expect(h.broken === 0 && h.emptySrc === 0, "broken/empty images in the restaurant preview");
    await page.screenshot({ path: path.join(shots, "p12-restaurant-site.png"), fullPage: true });
  });

  await step(page, "B4 restaurant publish → public page on mobile + desktop matches the preview", async () => {
    slug = await publish(page, { name: "Mak Nah", slug: "maknah-p12", tag });
    // A separate context: the owner's tab keeps its Firestore channels, the visitor must not share Chrome's per-host connection cap.
    const visitorCtx = await browser.createBrowserContext();
    const visitor = await visitorCtx.newPage();
    for (const [name, vp] of [["mobile", mobile], ["desktop", desktop]]) {
      await visitor.setViewport(vp);
      const res = await visitor.goto(`${base}/w/${slug}`, { waitUntil: "networkidle2", timeout: 60000 });
      expect(res.status() === 200, `${name} status ${res.status()}`);
      await waitHeroLoaded(visitor);
      const h = await heroFacts(visitor);
      expect(h.mode === "visual" && h.img?.loaded && h.img.fit === "cover", `${name} hero ${JSON.stringify(h.img)}`);
      expect(h.headerLogo && h.cta, `${name}: logo ${h.headerLogo}, cta ${h.cta}`);
      expectSocials(h, REST_SOCIAL_URLS, contactId());
      expect(!h.overflow && h.broken === 0 && h.emptySrc === 0, `${name}: overflow ${h.overflow}, broken ${h.broken}`);
      await visitor.screenshot({ path: path.join(shots, `p12-restaurant-public-${name}.png`), fullPage: true });
    }
    await visitorCtx.close();
  });

  await step(page, "B5 restaurant editor: Remove logo → initial avatar in header; cover unaffected", async () => {
    await page.setViewport(desktop);
    await page.goto(`${base}/s/${siteId}/edit`, { waitUntil: "load" });
    await page.waitForSelector("#business-logo img", { timeout: 15000 });
    expect(!(await page.$("#profile-photo")), "restaurant editor shows a profile photo card");
    await cardButton(page, "logo", "Remove");
    await page.waitForFunction(() => !document.querySelector("#business-logo img"), { timeout: 5000 });
    await savedOn(page);
    const h = await heroFacts(page);
    const initial = await page.evaluate(() => [...document.querySelectorAll("header span")].find((s) => s.className.includes("bg-site-accent"))?.textContent.trim() ?? null);
    expect(!h.headerLogo && initial && initial.length === 1, `logo fallback: logo ${h.headerLogo}, initial ${initial}`);
    expect(h.img?.loaded, "cover lost when the logo was removed");
    await page.screenshot({ path: path.join(shots, "p12-restaurant-editor-logo-removed.png") });
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C: no location at all → no map, no maps link
// ---------------------------------------------------------------------------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(mobile);
  await step(page, "C1 no address/area: no location section, no Maps link, nothing empty", async () => {
    const flow = await onboard(page, NO_LOCATION);
    const areaValue = await page.evaluate(() => document.querySelector("#area")?.value ?? "");
    expect(!areaValue, `mock found an area in a location-less description: ${areaValue}`);
    const { site } = await flow.build();
    flow.done();
    expect(!site.sections.some((s) => s.type === "location"), "location section generated without a location");
    await expandPreview(page);
    await wait(300);
    const loc = await locationFacts(page);
    expect(!loc.href && !loc.iframeSrc && !loc.placeholder, `location UI present: ${JSON.stringify(loc)}`);
    expect(!(await bodyText(page)).includes("Google Maps"), "Google Maps text on a site without a location");
    const h = await heroFacts(page);
    expect(h.mode && !h.img && h.cta && h.socialBlocks === 0, `no-extras site: ${JSON.stringify({ mode: h.mode, img: h.img, cta: h.cta, socialBlocks: h.socialBlocks })}`);
    await page.screenshot({ path: path.join(shots, "p12-no-location-site.png"), fullPage: true });
  });
  await ctx.close();
}

await browser.close();
console.log(`\n${failed ? `${failed} step(s) failed` : "all steps passed"} — screenshots in scripts/qa/shots/p12-*.png`);
process.exit(failed ? 1 : 0);
