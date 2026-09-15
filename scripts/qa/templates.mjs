// Seeds published sites (the four demo sites × the five templates, with a wide cover, a tall
// cover, no cover, and a long-content variant) straight into the Firestore emulator and checks
// the public page at phone, tablet, desktop and wide viewports: the page renders with the
// template it was given, nothing overflows horizontally, the headline and the one hero CTA are
// visible, the sticky bar shows on phones only, every section and the footer render, images
// load, and there are no console errors.
//
//   npm run qa:templates
//
// Env: QA_BASE_URL (default http://localhost:3000; that dev server must read the same
// emulator), QA_CHROME (Chrome binary), FIRESTORE_EMULATOR_HOST (default 127.0.0.1:8080),
// QA_PROJECT (default webbi-85f26), QA_ONLY (comma-separated template ids, demo slugs and/or
// "template/demo" pairs), QA_KINDS (comma-separated wide,tall,none,long), QA_KEEP=1 to leave the seeded sites in the emulator.
// Full-page screenshots and templates-report.json land in scripts/qa/shots/.
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
const kinds = process.env.QA_KINDS ? process.env.QA_KINDS.split(",").map((s) => s.trim()) : null;
const tag = Date.now().toString(36);

const TEMPLATES = ["bright", "trust", "bold", "elegant", "warm"];
const DEMOS = ["rasa-kampung", "hafiz-rahman", "sereni", "sejuktech"];
const COVERS = { wide: { w: 1600, h: 900 }, tall: { w: 1080, h: 1920, position: "top" } };
/**
 * Every template renders each demo with a wide cover; the car and restaurant demos also get tall, none and long.
 * "noloc" is the restaurant without any address, area or location section (an older site that never had one).
 */
const VARIANTS = { "rasa-kampung": ["wide", "tall", "none", "long", "noloc"], "hafiz-rahman": ["wide", "tall", "none", "long"], sereni: ["wide"], sejuktech: ["wide", "none"] };
const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  wide: { width: 1920, height: 1080, deviceScaleFactor: 1 },
};
const LONG_NAME = "Syarikat Perkhidmatan Penghawa Dingin dan Elektrik Bumiputera Sejahtera Berhad";
const LONG_WORD = "Supercalifragilisticexpialidociouslyextraordinarybusinessname";

// ---- covers from a throwaway static server (http://127.0.0.1 URLs pass the schema and render unoptimised) ----
for (const [key, s] of Object.entries(COVERS)) writeCoverPng(path.join(shots, `qa-template-cover-${key}.png`), s.w, s.h);
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

function variant(demo, template, kind) {
  const content = structuredClone(DEMO_SITES[demo]);
  content.theme = { ...content.theme, preset: template };
  const hero = content.sections.find((s) => s.type === "hero");
  if (kind === "noloc") {
    delete content.business.address;
    delete content.business.area;
    content.sections = content.sections.filter((s) => s.type !== "location");
  }
  if (kind === "none") {
    delete content.business.heroImage;
    delete content.business.heroImagePosition;
    delete hero.image;
  } else if (kind === "wide" || kind === "tall" || kind === "long") {
    const cover = COVERS[kind === "tall" ? "tall" : "wide"];
    content.business.heroImage = { url: `${imgBase}/qa-template-cover-${kind === "tall" ? "tall" : "wide"}.png`, path: "users/qa/sites/qa/cover.png", width: cover.w, height: cover.h };
    content.business.heroImagePosition = cover.position;
    delete hero.image;
  }
  if (kind === "long") {
    // As long as the schema lets a customer save (anything longer is refused at /w/ and would 404).
    const fit = (text, max) => text.slice(0, max);
    content.business.name = LONG_NAME;
    content.business.tagline = fit(`${LONG_WORD} and a tagline that keeps going well past what fits on one line`, 120);
    hero.headline = fit(`${LONG_WORD} ${hero.headline} with a much longer headline than anyone should write`, 90);
    for (const s of content.sections) {
      if ("title" in s && typeof s.title === "string") s.title = fit(`${s.title} ${LONG_WORD}`, 60);
      if (s.type === "offerings") for (const item of s.items) { item.name = fit(`${item.name} ${LONG_WORD}`, 60); if (item.price) item.price = fit(`${item.price} – RM 12,345.00`, 40); }
    }
  }
  return content;
}

const sites = [];
for (const template of TEMPLATES) {
  for (const demo of DEMOS) {
    if (only && !only.includes(template) && !only.includes(demo) && !only.includes(`${template}/${demo}`)) continue;
    for (const kind of VARIANTS[demo].filter((k) => !kinds || kinds.includes(k))) {
      // Slugs are at most 40 characters (SLUG_PATTERN); a longer one is refused and 404s.
      const slug = `qa-t-${template}-${demo}-${kind}-${tag}`.slice(0, 40);
      sites.push({ template, demo, kind, slug, content: variant(demo, template, kind) });
    }
  }
}
for (const site of sites) await seed(site.slug, site.content);
console.log(`seeded ${sites.length} site(s) into ${FS.replace(/\/v1.*/, "")}, covers from ${imgBase}\n`);

// ---- the checks ---------------------------------------------------------------------------------
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"] });
const NOISE = /favicon|webpack-hmr|__nextjs|net::ERR_ABORTED|google\.com\/maps|gstatic|googleapis|maps\.google/;
const report = [];
let failed = 0;

const facts = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("[data-preset]");
    const vw = document.documentElement.clientWidth;
    const visible = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    /** Elements poking past the viewport that aren't inside a deliberate scroller or clipper. */
    const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return p !== root; } return false; };
    const offenders = [...document.querySelectorAll("[data-preset] *")]
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 1 || b.left < -1) && !clipped(el); })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} ${Math.round(el.getBoundingClientRect().left)}→${Math.round(el.getBoundingClientRect().right)}`);
    const hero = document.querySelector("[data-hero-mode]");
    const h1 = document.querySelector("h1");
    const ctas = document.querySelectorAll("[data-hero-cta]");
    const sticky = [...document.querySelectorAll("[data-preset] .sticky")].find((el) => el.className.includes("bottom-0"));
    return {
      preset: root?.getAttribute("data-preset") ?? null,
      overflow: document.documentElement.scrollWidth > vw + 1,
      offenders,
      hero: Boolean(hero),
      h1: visible(h1) ? h1.textContent.trim().slice(0, 50) : null,
      h1Fits: h1 ? h1.scrollWidth <= h1.clientWidth + 2 : false,
      ctas: ctas.length,
      ctaVisible: [...document.querySelectorAll("[data-hero-cta] a")].some(visible),
      sticky: visible(sticky),
      sections: document.querySelectorAll("main section[id^='s-']").length,
      footer: visible(document.querySelector("footer")),
      header: visible(document.querySelector("header")),
      broken: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.getAttribute("src")?.startsWith("data:")).length,
      emptySrc: document.querySelectorAll("img[src='']").length,
      scripts: [...document.querySelectorAll("[data-preset] script")].length,
      fontFamily: getComputedStyle(h1 ?? document.body).fontFamily.split(",")[0],
    };
  });

/** The location section's map as the browser laid it out, next to its Maps button, after scrolling it into view. */
const mapFacts = (page) =>
  page.evaluate(async () => {
    const frames = [...document.querySelectorAll("iframe")];
    const link = [...document.querySelectorAll("a[href^='https://www.google.com/maps/search/']")][0] ?? null;
    const frame = frames[0];
    if (!frame) return { count: 0, link: link?.getAttribute("href") ?? null };
    frame.scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 150));
    const vw = document.documentElement.clientWidth;
    const r = frame.getBoundingClientRect();
    // The frame's inner box: the iframe is inset-0 inside the border, which templates draw 1–2px wide.
    const box = { width: frame.parentElement.clientWidth, height: frame.parentElement.clientHeight };
    const s = getComputedStyle(frame);
    const l = link?.getBoundingClientRect();
    const sticky = [...document.querySelectorAll("[data-preset] .sticky")].find((el) => el.className.includes("bottom-0"));
    const st = sticky && getComputedStyle(sticky).display !== "none" ? sticky.getBoundingClientRect() : null;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const overlaps = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return {
      count: frames.length,
      origins: frames.map((f) => new URL(f.src).origin),
      src: frame.getAttribute("src"),
      link: link?.getAttribute("href") ?? null,
      w: Math.round(r.width),
      h: Math.round(r.height),
      inView: r.left >= -1 && r.right <= vw + 1,
      fillsBox: Math.abs(r.width - box.width) <= 1 && Math.abs(r.height - box.height) <= 1,
      shown: s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0,
      /** The middle of the map is the map itself, not something painted over it. */
      onTop: hit === frame,
      overlapsLink: Boolean(overlaps(r, l)),
      coveredBySticky: Boolean(st && r.top + r.height / 2 > st.top),
      vw,
    };
  });

for (const site of sites) {
  const entry = { site: `${site.template}/${site.demo}/${site.kind}`, slug: site.slug, viewports: {}, checks: [] };
  const check = (ok, label) => { entry.checks.push({ ok, label }); if (!ok) failed++; };
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  const cspErrors = [];
  // CSP refusals are collected before the Google noise filter, so a blocked map frame can't hide behind it.
  page.on("console", (m) => { if (/Content Security Policy|Refused to (frame|load|connect)/i.test(m.text())) cspErrors.push(m.text().slice(0, 200)); });
  page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push(String(e.message ?? e).slice(0, 160)));
  page.on("requestfailed", (req) => { if (!NOISE.test(`${req.url()} ${req.failure()?.errorText ?? ""}`)) errors.push(`request failed ${req.url().slice(0, 120)}`); });
  try {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const at = (label) => `${vpName}: ${label}`;
      await page.setViewport(vp);
      const res = await page.goto(`${base}/w/${site.slug}`, { waitUntil: "load", timeout: 60000 });
      check(res.status() === 200, at(`public page status ${res.status()}`));
      await page.evaluate(() => document.fonts?.ready);
      await new Promise((r) => setTimeout(r, 250));
      const f = await facts(page);
      entry.viewports[vpName] = f;
      check(f.preset === site.template, at(`renders the ${f.preset} template (expected ${site.template})`));
      check(!f.overflow && f.offenders.length === 0, at(`no horizontal overflow${f.offenders.length ? ` (${f.offenders.join(" | ")})` : ""}`));
      check(f.header && f.footer && f.hero, at("header, hero and footer render"));
      check(Boolean(f.h1) && f.h1Fits, at(`headline visible and wraps inside its box ("${f.h1 ?? ""}")`));
      check(f.ctas === 1 && f.ctaVisible, at(`one visible hero CTA (${f.ctas})`));
      check(f.sticky === vp.width < 768, at(`sticky contact bar ${f.sticky ? "shown" : "hidden"} (phones only)`));
      check(f.sections >= 3, at(`${f.sections} sections render`));
      check(f.broken === 0 && f.emptySrc === 0, at(`${f.broken} broken / ${f.emptySrc} empty image(s)`));
      check(f.scripts === 0, at("no script elements inside the site"));
      if (vpName === "mobile" || vpName === "desktop") {
        await page.screenshot({ path: path.join(shots, `template-${site.template}-${site.demo}-${site.kind}-${vpName}.png`), fullPage: true });
      }

      // ---- location map: the rendered frame, not just the element ----
      const m = await mapFacts(page);
      entry.viewports[vpName].map = m;
      if (site.kind === "noloc") {
        check(m.count === 0 && !m.link, at(`no location: no map frame (${m.count}) and no Maps link (${m.link})`));
      } else {
        const q = (url, key) => { try { return new URL(url).searchParams.get(key); } catch { return null; } };
        check(m.count === 1, at(`one map frame (${m.count})`));
        if (m.count) {
          check(m.origins.every((o) => o === "https://www.google.com") && /^https:\/\/www\.google\.com\/maps\?q=[^&]+&output=embed$/.test(m.src), at(`map src is the keyless Google Maps embed (${m.src})`));
          check(Boolean(m.link) && q(m.src, "q") === q(m.link, "query"), at(`map and Maps button show the same place (${q(m.src, "q")} / ${q(m.link, "query")})`));
          // At least most of the column on a phone; a real map (not a sliver) on bigger screens, without taking over the page.
          const minW = vp.width < 768 ? Math.min(300, m.vw - 48) : 320;
          check(m.w >= minW && m.h >= 200 && m.h <= Math.max(640, vp.height), at(`map is ${m.w}×${m.h}`));
          check(m.shown && m.fillsBox && m.inView && m.onTop, at(`map visible, fills its frame, inside the viewport, not painted over (${JSON.stringify({ shown: m.shown, fillsBox: m.fillsBox, inView: m.inView, onTop: m.onTop })})`));
          check(!m.overlapsLink && !m.coveredBySticky, at(`map doesn't overlap the Maps button or the sticky bar (${JSON.stringify({ link: m.overlapsLink, sticky: m.coveredBySticky })})`));
          if (vpName === "mobile" || vpName === "wide") {
            // The lazy frame is in view now: it must actually navigate to Google's embed page, not an error page.
            const deadline = Date.now() + 20000;
            let frame;
            while (Date.now() < deadline) {
              frame = page.frames().find((fr) => fr !== page.mainFrame() && /google\.com\/maps/.test(fr.url()));
              if (frame?.url().includes("/maps/embed")) break;
              await new Promise((r) => setTimeout(r, 400));
            }
            check(Boolean(frame?.url().includes("/maps/embed")), at(`map frame loaded Google's embed page (${frame?.url().slice(0, 60) ?? "no frame"})`));
            if (site.kind === "wide") {
              await new Promise((r) => setTimeout(r, 1500));
              const section = await page.evaluateHandle(() => document.querySelector("iframe").closest("section"));
              await section.asElement().screenshot({ path: path.join(shots, `template-${site.template}-${site.demo}-map-${vpName}.png`) });
            }
          }
        }
      }
    }
    check(cspErrors.length === 0, `no CSP violations (${cspErrors.slice(0, 2).join(" | ") || "none"})`);
    check(errors.length === 0, `no console errors (${errors.slice(0, 3).join(" | ") || "none"})`);
  } catch (err) {
    check(false, `crashed: ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: path.join(shots, `template-${site.template}-${site.demo}-${site.kind}-fail.png`), fullPage: true }).catch(() => {});
  }
  const bad = entry.checks.filter((c) => !c.ok).map((c) => c.label);
  console.log(`${bad.length ? "FAIL" : "ok  "} ${entry.site} · font ${entry.viewports.desktop?.fontFamily ?? "?"}`);
  for (const b of bad) console.log(`     ✗ ${b}`);
  report.push(entry);
  await context.close();
}

await browser.close();
server.close();
if (!process.env.QA_KEEP) await Promise.all(sites.map((s) => unseed(s.slug)));
writeFileSync(path.join(shots, "templates-report.json"), JSON.stringify(report, null, 2));
console.log(`\n${failed ? `${failed} check(s) failed` : "all checks passed"} — ${sites.length} site(s) × ${Object.keys(VIEWPORTS).length} viewports; report: scripts/qa/shots/templates-report.json`);
process.exit(failed ? 1 : 0);
