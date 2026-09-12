// Runs six realistic Malaysian business descriptions through the real onboarding flow
// (/start → confirm → content → generating → ready) and reports what the AI understood
// and generated for each. Works with AI_PROVIDER=mock (structure check) or a real key.
//
//   npm run qa:industries
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME (Chrome binary path).
// Each industry runs in a fresh browser context (fresh anonymous user) so the per-user
// AI rate limits are not hit. Screenshots + industries-report.json land in scripts/qa/shots/.
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });

const INDUSTRIES = [
  {
    key: "restaurant",
    expectCategory: "restaurant",
    ctaFamily: /order|pesan|tempah/i,
    description:
      "Saya buka kedai makan Warung Mak Nah di Kajang. Jual nasi lemak, mee goreng dan lauk kampung, semua halal dan masak sendiri. Buka 7 pagi sampai 3 petang. Customer biasa order ikut WhatsApp 012-345 6789.",
  },
  {
    key: "car",
    expectCategory: "car",
    ctaFamily: /test drive|pandu uji/i,
    description:
      "Saya jual kereta Perodua dekat Balakong. Nama saya Amir. Saya bantu customer cari kereta baru dan boleh buat loan. WhatsApp saya kalau nak book test drive.",
  },
  {
    key: "property",
    expectCategory: "property",
    ctaFamily: /enquir|tanya|property|hartanah/i,
    description:
      "I'm Sarah Lim, a registered real estate negotiator with IQI in Petaling Jaya. I help families buy, sell and rent condos and landed homes around PJ, Damansara and Subang Jaya. Free valuation, WhatsApp me to enquire.",
  },
  {
    key: "homeServices",
    expectCategory: "homeServices",
    ctaFamily: /quot|sebut harga|harga/i,
    description:
      "Kami buat renovation, plumbing dan wiring untuk rumah area Shah Alam dan Klang. 12 tahun experience, harga berpatutan, free quotation. Kitchen cabinet dari RM3,500. Contact Zul untuk quote.",
  },
  {
    key: "beauty",
    expectCategory: "beauty",
    ctaFamily: /book|appointment|tempah|janji/i,
    description:
      "Salon Ayu Beauty kat Bangi. Kami buat haircut, hair colour, rebonding, facial dan bridal makeup. Ladies only, ada ruang solat. Booking through WhatsApp je 011-2345 6789.",
  },
  {
    key: "photographer",
    expectCategory: "photographer",
    ctaFamily: /availab|kekosongan|tarikh|book/i,
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

for (const industry of INDUSTRIES) {
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
    await page.goto(`${base}/start`, { waitUntil: "load" });
    await page.waitForSelector("textarea", { timeout: 20000 });
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
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-confirm.png`), fullPage: true });
    await clickText(page, "button", "Looks right");
    await page.waitForFunction(() => location.pathname.includes("/content"), { timeout: 20000 });
    await page.waitForSelector("h1", { timeout: 20000 });
    await wait(300);
    const offerings = await page.$$eval("input", (els) => els.map((e) => e.value).filter(Boolean));
    entry.contentInputs = offerings;
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
    }
    entry.siteId = page.url().match(/\/s\/([^/]+)\//)?.[1];
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-ready.png`) });
    // Expand the phone preview frame so the whole generated site is captured.
    await page.evaluate(() => {
      const frame = [...document.querySelectorAll("div")].find((d) => d.className.includes("h-[540px]"));
      if (frame) { frame.style.height = "auto"; frame.style.overflow = "visible"; }
    });
    await wait(300);
    await page.screenshot({ path: path.join(shots, `industry-${industry.key}-site.png`), fullPage: true });
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
