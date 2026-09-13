// Seeds published sites (six categories × the cover shapes the hero system tells apart)
// straight into the Firestore emulator and checks the public page's hero at phone, tablet,
// desktop and wide viewports: the cover loads, the frame keeps the photo's own ratio
// wherever the bounds allow (no crop), tall and banner photos are trimmed on phones only by
// the documented amount, the desktop split layout never crops, heights stay within the
// caps, headline and CTA are inside the hero and readable, no horizontal overflow, no
// console errors. Expectations mirror src/lib/site/hero.ts (heroFrameOf) on purpose, so a
// change there that alters what visitors see fails here.
//
//   npm run qa:hero-shapes
//
// Env: QA_BASE_URL (default http://localhost:3000; that dev server must read the same
// emulator), QA_CHROME (Chrome binary), FIRESTORE_EMULATOR_HOST (default 127.0.0.1:8080),
// QA_PROJECT (default webbi-85f26), QA_ONLY (comma-separated category keys and/or
// "category/shape" pairs), QA_KEEP=1 to leave the seeded sites in the emulator.
// Hero screenshots and hero-shapes-report.json land in scripts/qa/shots/.
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCoverPng } from "./lib.mjs";

// Node strips the types itself; demo.ts is plain data with a type-only import.
const { DEMO_SITES } = await import("../../src/lib/site/demo.ts");

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"}/v1/projects/${process.env.QA_PROJECT || "webbi-85f26"}/databases/(default)/documents`;
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });
const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(",").map((s) => s.trim()) : null;
const tag = Date.now().toString(36);

/** Natural sizes of the covers, one per shape (as a phone, a camera or a designer would produce them). */
const SHAPES = {
  banner: { w: 2400, h: 800, position: "bottom" },
  wide: { w: 1600, h: 900 },
  landscape: { w: 1400, h: 1050 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350, position: "top" },
  tall: { w: 1080, h: 1920, position: "top" },
};
const ALL = Object.keys(SHAPES);
const CORE = ["wide", "square", "tall"];
/** Six categories: the four demo sites plus the person-led car demo re-categorised. */
const CATEGORIES = {
  restaurant: { from: "rasa-kampung", mode: "visual", shapes: ALL },
  car: { from: "hafiz-rahman", mode: "person", shapes: ALL },
  property: { from: "hafiz-rahman", category: "property", mode: "property", shapes: CORE },
  beauty: { from: "sereni", mode: "visual", shapes: CORE },
  homeServices: { from: "sejuktech", mode: "service", shapes: CORE },
  photographer: { from: "hafiz-rahman", category: "photographer", mode: "person", shapes: CORE },
};
const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  wide: { width: 1920, height: 1080, deviceScaleFactor: 1 },
};

// ---- the contract (mirrors heroFrameOf) ---------------------------------------------------------
const BOUNDS = { mobileOverlay: [2 / 3, 1.15], mobileStack: [3 / 4, 2], desktopOverlay: [1.6, 3.2] };
const clamp = (v, [min, max]) => Math.min(max, Math.max(min, v));
const shapeOf = (r) => (r >= 2.4 ? "banner" : r >= 1.6 ? "wide" : r >= 1.15 ? "landscape" : r >= 0.87 ? "square" : r >= 0.6 ? "portrait" : "tall");
function expectedFrame({ w, h }, mode) {
  const ratio = w / h;
  const desktop = ratio >= BOUNDS.desktopOverlay[0] ? "overlay" : "split";
  const mobile = mode === "visual" && ratio <= BOUNDS.mobileOverlay[1] ? "overlay" : "stack";
  return {
    ratio,
    shape: shapeOf(ratio),
    layout: `${mobile}/${desktop}`,
    mobile,
    desktop,
    mobileRatio: clamp(ratio, mobile === "overlay" ? BOUNDS.mobileOverlay : BOUNDS.mobileStack),
    desktopRatio: desktop === "overlay" ? clamp(ratio, BOUNDS.desktopOverlay) : ratio,
  };
}
const asRatio = (r) => (Math.abs(r - Math.round(r)) < 0.001 ? `${Math.round(r)}:1` : r > 1 ? `${(r).toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`);

// ---- covers served from a throwaway static server (http://127.0.0.1 URLs pass the schema and render unoptimised) ----
for (const [key, s] of Object.entries(SHAPES)) writeCoverPng(path.join(shots, `qa-cover-${key}.png`), s.w, s.h);
const server = createServer((req, res) => {
  const file = path.join(shots, path.basename(new URL(req.url, "http://x").pathname));
  if (!file.endsWith(".png") || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const imgBase = `http://127.0.0.1:${server.address().port}`;

// ---- seeding through the emulator's REST API ----------------------------------------------------
const enc = (v) =>
  v === null ? { nullValue: null }
  : typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : Array.isArray(v) ? { arrayValue: { values: v.filter((x) => x !== undefined).map(enc) } }
  : { mapValue: { fields: fields(v) } };
const fields = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
const headers = { Authorization: "Bearer owner", "content-type": "application/json" };
async function seed(slug, content) {
  const body = JSON.stringify({ fields: fields({ siteId: `qa-${slug}`, slug, content, publishedAt: new Date().toISOString() }) });
  const res = await fetch(`${FS}/publicSites/${slug}`, { method: "PATCH", headers, body });
  if (!res.ok) throw new Error(`seed ${slug}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}
const unseed = (slug) => fetch(`${FS}/publicSites/${slug}`, { method: "DELETE", headers }).catch(() => {});

const sites = [];
for (const [key, cat] of Object.entries(CATEGORIES)) {
  for (const shapeKey of cat.shapes) {
    if (only && !only.includes(key) && !only.includes(`${key}/${shapeKey}`)) continue;
    const shape = SHAPES[shapeKey];
    const content = structuredClone(DEMO_SITES[cat.from]);
    if (cat.category) content.business.category = cat.category;
    content.business.heroImage = { url: `${imgBase}/qa-cover-${shapeKey}.png`, path: `users/qa/sites/qa/cover-${shapeKey}.png`, width: shape.w, height: shape.h };
    content.business.heroImagePosition = shape.position;
    const hero = content.sections.find((s) => s.type === "hero");
    delete hero.image; // the dedicated cover replaces the legacy first photo
    delete hero.presentationMode; // the category decides the mode
    const slug = `qa-hero-${key.toLowerCase()}-${shapeKey}-${tag}`;
    sites.push({ key, shapeKey, shape, mode: cat.mode, slug, content, expected: expectedFrame(shape, cat.mode), preset: content.theme.preset });
  }
}
for (const site of sites) await seed(site.slug, site.content);
console.log(`seeded ${sites.length} site(s) into ${FS.replace(/\/v1.*/, "")}, covers from ${imgBase}\n`);

// ---- the checks ---------------------------------------------------------------------------------
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"] });
const NOISE = /favicon|webpack-hmr|__nextjs|_next\/static\/chunks.*net::ERR_ABORTED|net::ERR_ABORTED/;
const report = [];
let failed = 0;

const facts = (page) =>
  page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    const hero = document.querySelector("[data-hero-mode]");
    const img = hero?.querySelector("img[data-image=cover]");
    const frame = img?.parentElement;
    const h1 = hero?.querySelector("h1");
    const cta = hero?.querySelector("[data-hero-cta] a");
    const white = (c) => c === "rgb(255, 255, 255)";
    return {
      mode: hero?.getAttribute("data-hero-mode") ?? null,
      shape: hero?.getAttribute("data-hero-shape") ?? null,
      layout: hero?.getAttribute("data-hero-layout") ?? null,
      dark: hero?.classList.contains("bg-site-ink") ?? false,
      img: img ? { loaded: img.complete && img.naturalWidth > 0, natural: [img.naturalWidth, img.naturalHeight], fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition, ...r(img) } : null,
      frame: frame ? { ...r(frame), aspect: getComputedStyle(frame).aspectRatio } : null,
      hero: hero ? r(hero) : null,
      h1: h1 ? { ...r(h1), white: white(getComputedStyle(h1).color), text: h1.textContent.trim().slice(0, 40) } : null,
      cta: cta ? { ...r(cta), label: cta.textContent.trim() } : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      broken: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.getAttribute("src")?.startsWith("data:")).length,
      emptySrc: document.querySelectorAll("img[src='']").length,
    };
  });

for (const site of sites) {
  const entry = { site: `${site.key}/${site.shapeKey}`, slug: site.slug, mode: site.mode, preset: site.preset, cover: `${site.shape.w}×${site.shape.h}`, focus: site.shape.position ?? "center", expected: site.expected, viewports: {}, checks: [] };
  const check = (ok, label) => { entry.checks.push({ ok, label }); if (!ok) failed++; };
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push(String(e.message ?? e).slice(0, 160)));
  page.on("requestfailed", (req) => { if (!NOISE.test(`${req.url()} ${req.failure()?.errorText ?? ""}`)) errors.push(`request failed ${req.url().slice(0, 120)}`); });
  const summary = [];
  try {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const isMobile = vp.width < 768; // @3xl = 48rem container width: the desktop composition starts at 768
      const tagVp = (label) => `${vpName}: ${label}`;
      await page.setViewport(vp);
      const res = await page.goto(`${base}/w/${site.slug}`, { waitUntil: "load", timeout: 60000 });
      check(res.status() === 200, tagVp(`public page status ${res.status()}`));
      await page.waitForFunction(() => { const i = document.querySelector("[data-hero-mode] img[data-image=cover]"); return Boolean(i && i.complete && i.naturalWidth > 0); }, { timeout: 30000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 250));
      const f = await facts(page);
      entry.viewports[vpName] = f;
      const e = site.expected;
      check(Boolean(f.img?.loaded) && f.img.natural[0] === site.shape.w && f.img.natural[1] === site.shape.h, tagVp(`cover loaded at its natural ${f.img?.natural?.join("×")}`));
      check(f.mode === site.mode, tagVp(`hero mode ${f.mode} (expected ${site.mode})`));
      check(f.shape === e.shape && f.layout === e.layout, tagVp(`framed as ${f.shape} ${f.layout} (expected ${e.shape} ${e.layout})`));
      if (!f.frame) { check(false, tagVp("no cover frame")); continue; }
      const layout = isMobile ? e.mobile : e.desktop;
      const want = isMobile ? e.mobileRatio : e.desktopRatio;
      const cap = isMobile ? Math.min(0.88 * f.vh, 760) : Math.min(0.72 * f.vh, 640);
      const rendered = f.frame.w / f.frame.h;
      const whole = Math.abs(want - e.ratio) < 0.001;
      let note;
      if (isMobile || layout === "overlay") {
        check(Math.abs(f.frame.w - f.vw) <= 2, tagVp(`cover is full-bleed (${f.frame.w} of ${f.vw}px)`));
        const natural = f.vw / want;
        const expectH = isMobile ? Math.min(natural, cap) : Math.min(Math.max(natural, 420), cap);
        check(Math.abs(f.frame.h - expectH) <= 3, tagVp(`frame ${f.frame.w}×${f.frame.h} = ${asRatio(want)} within the caps (expected height ${Math.round(expectH)})`));
        const capped = expectH < natural - 1 || expectH > natural + 1;
        note = `${layout} ${f.frame.w}×${f.frame.h} ${asRatio(rendered)}${whole && !capped ? " whole" : ` trimmed from ${asRatio(e.ratio)}${capped ? " by the height cap" : ""}, focus ${site.shape.position ?? "center"}`}`;
      } else {
        check(Math.abs(rendered - e.ratio) < 0.02, tagVp(`split frame ${f.frame.w}×${f.frame.h} keeps the photo's own ${asRatio(e.ratio)}: nothing cropped`));
        check(f.frame.h <= cap + 2, tagVp(`split frame height ${f.frame.h} within the ${Math.round(cap)}px cap`));
        check(f.frame.w < f.hero.w * 0.6 && f.frame.w > 120, tagVp(`photo sits whole beside the copy (${f.frame.w} of ${f.hero.w}px)`));
        note = `split ${f.frame.w}×${f.frame.h} whole`;
      }
      check(Boolean(f.h1) && f.h1.h > 0 && f.h1.y >= f.hero.y - 1 && f.h1.y + f.h1.h <= f.hero.y + f.hero.h + 1, tagVp("headline inside the hero"));
      check(Boolean(f.cta) && f.cta.h >= 44 && f.cta.y + f.cta.h <= f.hero.y + f.hero.h + 1, tagVp(`CTA "${f.cta?.label}" inside the hero, ${f.cta?.h}px tall`));
      if (layout === "overlay") {
        const inside = f.h1.y >= f.frame.y - 1 && f.h1.y + f.h1.h <= f.frame.y + f.frame.h + 1;
        check(f.h1.white && inside, tagVp("copy sits on the photo itself and is white"));
      } else {
        check(f.h1.white === f.dark, tagVp(`copy ${isMobile ? "under" : "beside"} the photo is ${f.dark ? "white on the ink ground" : "ink on the light ground"}`));
      }
      check(!f.overflow, tagVp("no horizontal overflow"));
      check(f.broken === 0 && f.emptySrc === 0, tagVp(`${f.broken} broken / ${f.emptySrc} empty image(s)`));
      check(f.hero.h <= (isMobile ? 1.4 : 1.1) * f.vh, tagVp(`hero ${f.hero.h}px is not absurdly long for a ${f.vh}px screen`));
      await (await page.$("[data-hero-mode]")).screenshot({ path: path.join(shots, `hero-${site.key}-${site.shapeKey}-${vpName}.png`) });
      summary.push(`${vpName} ${note}`);
    }
    check(errors.length === 0, `no console errors (${errors.slice(0, 3).join(" | ") || "none"})`);
  } catch (err) {
    check(false, `crashed: ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: path.join(shots, `hero-${site.key}-${site.shapeKey}-fail.png`), fullPage: true }).catch(() => {});
  }
  const bad = entry.checks.filter((c) => !c.ok).map((c) => c.label);
  console.log(`${bad.length ? "FAIL" : "ok  "} ${entry.site} (${site.mode}, ${entry.cover}) · ${summary.join(" · ")}`);
  for (const b of bad) console.log(`     ✗ ${b}`);
  report.push(entry);
  await context.close();
}

await browser.close();
server.close();
if (!process.env.QA_KEEP) await Promise.all(sites.map((s) => unseed(s.slug)));
writeFileSync(path.join(shots, "hero-shapes-report.json"), JSON.stringify(report, null, 2));
console.log(`\n${failed ? `${failed} check(s) failed` : "all checks passed"} — ${sites.length} site(s) × ${Object.keys(VIEWPORTS).length} viewports; report: scripts/qa/shots/hero-shapes-report.json`);
process.exit(failed ? 1 : 0);
