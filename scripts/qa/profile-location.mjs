// Phase 11 QA: profile photo for person-led businesses + the location experience.
// Runs against a dev server on the Firebase emulators with AI_PROVIDER=mock and
// PAYMENT_PROVIDER=mock (same setup as qa:publish):
//
//   QA_BASE_URL=http://localhost:3000 npm run qa:profile-location
//
// Scenarios: (A) car sales advisor with a full address and a profile photo, through
// ready → publish → public page (map embed, Google Maps link, mobile + desktop) → editor
// remove/restore; (B) restaurant with an address and no photo field; (C) a business
// with no location at all. Screenshots land in scripts/qa/shots/ (git-ignored).
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { profilePhotoInput, writeAvatarPng } from "./lib.mjs";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });
const avatar = writeAvatarPng(path.join(shots, "qa-avatar.png"));

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
    await page.screenshot({ path: path.join(shots, `p11-fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), fullPage: true }).catch(() => {});
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

/** /start → confirm (fills WhatsApp + optional address) → content. Returns the generate API body once built. */
async function onboard(page, description, { address, name } = {}) {
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
  if (address) {
    await clickText(page, "button", "Address, Instagram, Facebook");
    await page.waitForSelector("#address", { timeout: 5000 });
    await page.type("#address", address);
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

  await step(page, "A1 car advisor: understand → confirm with address → content", async () => {
    flow = await onboard(page, CAR, { address: ADDRESS, name: "Amir" });
    await page.waitForSelector("#profile-photo", { timeout: 15000 }).catch(() => { throw new Error("profile photo field missing for a car sales advisor"); });
    const label = await page.evaluate(() => document.querySelector("label[for=profile-photo]")?.textContent?.trim());
    expect(label === "Your profile photo", `label "${label}"`);
    expect((await bodyText(page)).includes("Add a professional photo so customers know who they"), "helper text missing");
  });

  await step(page, "A2 upload profile photo (optional, owner's own Storage folder)", async () => {
    const input = await profilePhotoInput(page);
    await input.uploadFile(avatar);
    await page.waitForSelector("#profile-photo img", { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Change"), { timeout: 30000 });
    await wait(800);
    await page.screenshot({ path: path.join(shots, "p11-content-profile.png"), fullPage: true });
  });

  await step(page, "A3 build → generate keeps the photo + address (mock provider)", async () => {
    ({ siteId, site } = await flow.build());
    flow.done();
    expect(site, "no site in generate response");
    expect(site.business.category === "car", `category ${site.business.category}`);
    expect(site.business.profilePhoto?.path?.startsWith("users/"), "profilePhoto missing from generated site");
    expect(site.business.address === ADDRESS, `business.address = ${site.business.address}`);
    const loc = site.sections.find((s) => s.type === "location");
    expect(loc && loc.address === ADDRESS, "location section lost the address");
  });

  await step(page, "A4 ready preview: photo in header + hero, address card, Maps link, no fake map box", async () => {
    await page.screenshot({ path: path.join(shots, "p11-ready-mobile.png") });
    await expandPreview(page);
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
    await page.screenshot({ path: path.join(shots, "p11-ready-site.png"), fullPage: true });
  });

  await step(page, "A5 publish (mock payment) → live", async () => {
    await clickText(page, "a", "Publish");
    await page.waitForFunction(() => location.pathname.endsWith("/account"), { timeout: 15000 });
    await page.waitForSelector("#auth-email", { timeout: 15000 });
    const nameField = await page.$("#auth-name");
    if (nameField) await nameField.type("Amir");
    await page.type("#auth-email", `qa-p11-${tag}@example.com`);
    await page.type("#auth-password", "password123");
    await page.click("button[type=submit]");
    await page.waitForFunction(() => location.pathname.endsWith("/publish"), { timeout: 30000 });
    await page.waitForSelector("#slug", { timeout: 15000 });
    // A unique slug so repeated runs against the same emulator don't collide ("Taken. Use amir-2").
    await retype(page, "#slug", `amir-p11-${tag}`);
    await page.waitForFunction(() => /Available/.test(document.body.innerText), { timeout: 15000 });
    slug = await page.$eval("#slug", (e) => e.value);
    expect(slug === `amir-p11-${tag}`, `slug ${slug}`);
    await clickText(page, "button", "Pay RM149.90");
    await page.waitForFunction(() => location.pathname.endsWith("/live"), { timeout: 30000 });
  });

  const visitorCtx = await browser.createBrowserContext();
  const visitor = await visitorCtx.newPage();
  let publicLoc;

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
    await visitor.screenshot({ path: path.join(shots, "p11-public-mobile.png"), fullPage: true });
    const section = await visitor.$("iframe");
    await (await section.evaluateHandle((f) => f.closest("section"))).asElement().screenshot({ path: path.join(shots, "p11-public-mobile-location.png") });
  });

  await step(visitor, "A7 public page (desktop) renders the same, no overflow", async () => {
    await visitor.setViewport(desktop);
    await visitor.goto(`${base}/w/${slug}`, { waitUntil: "networkidle2", timeout: 60000 });
    const loc = await locationFacts(visitor);
    expect(loc.href === MAPS_HREF && loc.iframeSrc, "desktop location mismatch");
    expect(loc.scrollWidth <= loc.innerWidth, "desktop horizontal overflow");
    await visitor.$eval("iframe", (f) => f.scrollIntoView({ block: "center" }));
    await wait(5000);
    await visitor.screenshot({ path: path.join(shots, "p11-public-desktop.png"), fullPage: true });
  });

  await step(visitor, "A8 'Buka di Google Maps' opens Google Maps at the supplied address", async () => {
    const maps = await visitorCtx.newPage();
    await maps.setViewport(mobile);
    const res = await maps.goto(MAPS_HREF, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);
    await wait(2000);
    const info = { status: res?.status(), url: maps.url(), title: await maps.title() };
    console.log(`     google maps: ${info.status} ${info.title} — ${info.url.slice(0, 120)}`);
    await maps.screenshot({ path: path.join(shots, "p11-google-maps-destination.png") });
    expect(info.url.includes("google.com/maps"), `unexpected destination ${info.url}`);
    expect(/balakong/i.test(info.title) || /balakong/i.test(decodeURIComponent(info.url)), `Google Maps did not resolve Balakong: ${info.title}`);
    await maps.close();
  });

  await step(page, "A9 editor: Business tab shows the photo; Remove falls back to the initial avatar; re-add", async () => {
    await page.setViewport(desktop);
    await page.goto(`${base}/s/${siteId}/edit`, { waitUntil: "load" });
    await page.waitForSelector("#biz-tagline", { timeout: 15000 });
    await page.waitForSelector("#profile-photo img", { timeout: 15000 });
    await clickText(page, "button", "Remove", true);
    await page.waitForFunction(() => !document.querySelector("#profile-photo img"), { timeout: 5000 });
    await page.waitForFunction(() => /Saved/.test(document.querySelector("[role=status]")?.textContent || ""), { timeout: 15000 });
    await wait(300);
    const prof = await page.evaluate(() => {
      const header = document.querySelector("header");
      const initial = header ? [...header.querySelectorAll("span")].find((s) => s.className.includes("bg-site-accent")) : null;
      return { initial: initial?.textContent.trim() ?? null, headerImg: Boolean(header?.querySelector("img")) };
    });
    expect(prof.initial === "A" && !prof.headerImg, `fallback wrong: ${JSON.stringify(prof)}`);
    await page.screenshot({ path: path.join(shots, "p11-editor-removed.png") });
    const input = await profilePhotoInput(page);
    await input.uploadFile(avatar);
    await page.waitForSelector("#profile-photo img", { timeout: 30000 });
    await page.waitForFunction(() => /Saved/.test(document.querySelector("[role=status]")?.textContent || ""), { timeout: 15000 });
    await wait(300);
    expect(await page.evaluate(() => Boolean(document.querySelector("header img"))), "photo not back in the preview header");
    await page.screenshot({ path: path.join(shots, "p11-editor-restored.png") });
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
  await step(page, "B1 restaurant: no profile photo field on the Content step", async () => {
    const flow = await onboard(page, RESTAURANT, { address: "12, Jalan Reko, 43000 Kajang, Selangor" });
    await page.waitForSelector("#profile-photo", { timeout: 2500 }).then(() => { throw new Error("restaurant got a profile photo field"); }, () => {});
    expect(!(await bodyText(page)).toLowerCase().includes("profile photo"), "restaurant mentions a profile photo");
    const { site } = await flow.build();
    flow.done();
    expect(site.business.category === "restaurant", `category ${site.business.category}`);
    expect(!site.business.profilePhoto, "restaurant carries a profilePhoto");
    await expandPreview(page);
    await wait(300);
    const loc = await locationFacts(page);
    expect(!loc.placeholder && !loc.iframeSrc, "restaurant preview shows a map box");
    expect(loc.href === "https://www.google.com/maps/search/?api=1&query=12%2C%20Jalan%20Reko%2C%2043000%20Kajang%2C%20Selangor", `maps link ${loc.href}`);
    const prof = await profileFacts(page);
    expect(prof.initial === "W" || prof.initial === "R", `initial ${prof.initial}`);
    expect(prof.headerImgAlt === null, "restaurant header shows a photo");
    await page.screenshot({ path: path.join(shots, "p11-restaurant-site.png"), fullPage: true });
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
    await page.screenshot({ path: path.join(shots, "p11-no-location-site.png"), fullPage: true });
  });
  await ctx.close();
}

await browser.close();
console.log(`\n${failed ? `${failed} step(s) failed` : "all steps passed"} — screenshots in scripts/qa/shots/p11-*.png`);
process.exit(failed ? 1 : 0);
