// Reads the marketing landing the way a visitor does and holds its copy to the house
// rules: no em dashes used as a marketing device, no generic AI-SaaS vocabulary, no
// badge or sparkle decoration on the hero, and the lines we deliberately keep still
// there. Also checks the page does not scroll sideways on a phone or a laptop.
//
//   npm run qa:landing
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME (path to a Chrome binary).
// Screenshots land in scripts/qa/shots/ (git-ignored). Exit code 1 if any check fails.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Marketing words that make a product read as an AI demo rather than a product. */
const BANNED = [
  "ai-powered", "ai website", "ai-generated", "powered by ai", "seamless", "effortless",
  "unlock", "elevate", "next-generation", "revolutionary", "revolutionize", "intelligent",
  "cutting-edge", "supercharge", "game-changing", "magic", "✨",
];
/** Lines that carry the product's voice; a copy pass must not lose them. */
const KEEP = [
  "Tell us what you do.",
  "We'll build your website.",
  "Professional websites for businesses, creators and salespeople. No hassle.",
  "See it free. Pay to go live.",
];

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});

const errors = [];
let failed = 0;
let current = null;

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${String(e.message).split("\n")[0]}`);
    if (current) await current.screenshot({ path: path.join(shots, `landing-fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png`) }).catch(() => {});
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

/** Opens the landing at one viewport and scrolls the whole page so every section reveals. */
const open = async (viewport) => {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });
  await page.goto(`${base}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 500));
  });
  current = page;
  return page;
};

/** Every word the visitor can actually read, with the product previews left out. */
const copy = async (page) => {
  const text = await page.evaluate(() => {
    const main = document.querySelector("[data-landing]");
    const clone = main.cloneNode(true);
    for (const el of clone.querySelectorAll("[data-site-preview], [aria-hidden='true'], noscript")) el.remove();
    return clone.innerText.replace(/\s+/g, " ").trim();
  });
  // Curly and straight apostrophes read the same; compare on one of them.
  return text.replace(/[\u2018\u2019]/g, "'");
};

const desktop = await open(DESKTOP);

await step("A  the hero leads with the headline, no badge above it", async () => {
  const first = await desktop.$eval("#top h1", (h) => {
    const column = h.parentElement;
    return { first: column.firstElementChild.tagName, text: h.innerText.replace(/\s+/g, " ").trim() };
  });
  expect(first.first === "H1", `something still sits above the hero headline: <${first.first.toLowerCase()}>`);
  expect(/Tell us what you do\. We.ll build your website\./.test(first.text), `hero headline changed: ${first.text}`);
  // Only the headline column: the phone beside it is a real site, pills and all.
  const pills = await desktop.$eval("#top h1", (h) =>
    Array.from(h.parentElement.querySelectorAll("span"))
      .filter((s) => /rounded-pill/.test(String(s.className)) && s.getClientRects().length > 0)
      .map((s) => s.textContent.trim()),
  );
  expect(pills.length === 0, `the hero still carries a pill: ${pills.join(" | ")}`);
});

await step("B  the visible copy has no em dashes", async () => {
  const text = await copy(desktop);
  const hits = text.split(/(?<=—[^.]{0,60})\./).filter((s) => s.includes("—"));
  expect(!text.includes("—"), `em dash still on the page: ${hits[0]?.trim().slice(0, 120) ?? text.slice(text.indexOf("—") - 60, text.indexOf("—") + 60)}`);
});

await step("C  the visible copy has no generic AI marketing vocabulary", async () => {
  const text = (await copy(desktop)).toLowerCase();
  const found = BANNED.filter((w) => text.includes(w));
  expect(found.length === 0, `banned wording on the landing: ${found.join(", ")}`);
});

await step("D  the lines worth keeping are still there", async () => {
  const text = await copy(desktop);
  const missing = KEEP.filter((line) => !text.includes(line));
  expect(missing.length === 0, `missing copy: ${missing.join(" | ")}`);
});

await step("E  the desktop page does not scroll sideways", async () => {
  const over = await desktop.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over <= 0, `${over}px of horizontal overflow at 1440px`);
  await desktop.screenshot({ path: path.join(shots, "landing-desktop.png"), fullPage: true });
});

const phone = await open(MOBILE);

await step("F  the phone page does not scroll sideways", async () => {
  const over = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over <= 0, `${over}px of horizontal overflow at 390px`);
});

await step("G  nothing on the phone sticks out past the viewport", async () => {
  const wide = await phone.evaluate(() => {
    // Rails, tab strips and the tilted previews are clipped by an ancestor on
    // purpose, so only measure what nothing above it is hiding.
    const loose = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (p.hasAttribute("data-site-preview")) return false;
        const o = getComputedStyle(p);
        if (o.overflowX !== "visible" || o.overflowY !== "visible") return false;
      }
      return true;
    };
    const out = [];
    for (const el of document.querySelectorAll("[data-landing] *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !loose(el)) continue;
      if (r.right > innerWidth + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${Math.round(r.left)}→${Math.round(r.right)}`);
    }
    return out.slice(0, 5);
  });
  expect(wide.length === 0, `sticking out at 390px: ${wide.join(" | ")}`);
});

await step("H  the mobile dock still offers Create My Website", async () => {
  const dock = await phone.evaluate(() => {
    const el = document.querySelector('[data-show="true"] a');
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  });
  expect(dock !== null, "the mobile dock never appeared after scrolling");
  expect(dock.includes("Create My Website"), `the dock reads "${dock}"`);
  await phone.screenshot({ path: path.join(shots, "landing-mobile.png"), fullPage: true });
});

await step("I  the landing loaded without browser errors", () => {
  expect(errors.length === 0, `${errors.length} error(s): ${errors.slice(0, 3).join(" | ")}`);
});

// ---- EN | BM ----------------------------------------------------------------
// The switch only changes the landing's own words. The example websites drawn
// inside it are customer content and read the same in both languages.

const TABLET = { width: 768, height: 1024, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const BM_HERO = /Ceritakan bisnes anda\. Kami bina website anda\./;
/** Words that are the same in both languages on purpose: names, template names, places, prices, addresses. */
const SAME = new Set([
  "Webbi", "EN", "BM", "English (EN)", "Bahasa Melayu (BM)", "Dashboard", "Menu", "FPX", "Kajang",
  "Nasi Lemak · Kajang", "Minuman · Kajang", "Warm · Bold · Bright · Elegant · Trust",
  "Warm", "Elegant", "Bold", "Trust", "Bright", "Rasa kampung yang sentiasa dirindui",
  "Rasa Kampung", "Hafiz Rahman", "Cikgu Amir", "Sereni", "SejukTech", "Studio Dua", "Teh Tarik", "Kedai Rina", "Lim & Co.",
]);
const same = (t) => SAME.has(t) || /^RM\d|^©|^Webbi ·$|\/w\/|^[\w.-]+\.(online|app|my)\b|^localhost|^rasa-kampung$/.test(t);

/** Each distinct piece of landing text and every aria-label or title, previews left out. */
const words = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("[data-landing]");
    const skip = (el) => !el || el.closest("[data-site-preview], [aria-hidden='true'], noscript, script, style");
    const out = new Set();
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t && /\p{L}{2}/u.test(t) && !skip(n.parentElement)) out.add(t);
    }
    for (const el of root.querySelectorAll("[aria-label], [title]")) {
      if (skip(el)) continue;
      for (const a of ["aria-label", "title"]) if (el.getAttribute(a)) out.add(el.getAttribute(a).trim());
    }
    return [...out];
  });

const heroText = (page) => page.$eval("#top h1", (h) => h.innerText.replace(/\s+/g, " ").trim());
const pressed = (page) => page.$$eval("[data-language-toggle] button", (bs) => bs.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("lang")));

/** Buttons and links whose label no longer fits, and nav pieces that run into each other. */
const cramped = (page) =>
  page.evaluate(() => {
    const out = [];
    const label = (el) => `${el.tagName.toLowerCase()} "${el.textContent.replace(/\s+/g, " ").trim().slice(0, 40)}"`;
    for (const el of document.querySelectorAll("[data-landing] a, [data-landing] button")) {
      if (el.closest("[data-site-preview]") || !el.getClientRects().length) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${label(el)} clips its label (${el.scrollWidth}>${el.clientWidth})`);
    }
    const pill = document.querySelector("nav [data-lifted]");
    const box = pill.getBoundingClientRect();
    const kids = [...pill.querySelectorAll(":scope > *, :scope > div > *")].filter((k) => k.getClientRects().length && getComputedStyle(k).display !== "none");
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1) out.push(`${label(k)} spills out of the nav pill`);
    }
    const mark = pill.firstElementChild.getBoundingClientRect();
    const toggle = pill.querySelector("[data-language-toggle]").getBoundingClientRect();
    if (mark.right > toggle.left + 1) out.push("the wordmark runs into the language switch");
    for (const cta of document.querySelectorAll('[data-landing] a[href="/start"]')) {
      if (!cta.getClientRects().length) continue;
      const style = getComputedStyle(cta);
      const lines = Math.round(cta.scrollHeight / parseFloat(style.lineHeight || style.fontSize));
      if (cta.getBoundingClientRect().height > parseFloat(style.height) + 1 || (style.whiteSpace !== "nowrap" && lines > 2)) out.push(`${label(cta)} wraps`);
    }
    return out.slice(0, 6);
  });

// The phone tab opened last; background tabs have their timers throttled, so bring the laptop back.
await desktop.bringToFront();
current = desktop;
const en = await copy(desktop);
const enWords = await words(desktop);

await step("J  English is the default and the switch says so", async () => {
  expect((await desktop.$eval("html", (h) => h.lang)) === "en", "html lang is not en on a first visit");
  expect(JSON.stringify(await pressed(desktop)) === '["en"]', `pressed: ${await pressed(desktop)}`);
  const labels = await desktop.$$eval("[data-language-toggle] button", (bs) => bs.map((b) => [b.type, b.getAttribute("aria-label"), b.textContent]));
  expect(labels.length === 2 && labels.every(([type, aria]) => type === "button" && aria), `switch buttons: ${JSON.stringify(labels)}`);
});

await step("K  choosing BM from the keyboard switches the page in place", async () => {
  const before = await desktop.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur();
    return (window.__noReload = true);
  });
  // Tab to it the way a keyboard user would, so :focus-visible applies.
  for (let i = 0; i < 12; i++) {
    await desktop.keyboard.press("Tab");
    if (await desktop.evaluate(() => document.activeElement?.matches('[data-language-toggle] button[lang="ms"]'))) break;
  }
  expect(await desktop.evaluate(() => document.activeElement?.matches('[data-language-toggle] button[lang="ms"]')), "Tab never reaches the BM button");
  const ring = await desktop.$eval('[data-language-toggle] button[lang="ms"]', (b) => getComputedStyle(b).outlineStyle);
  expect(ring !== "none", "the focused language button shows no focus ring");
  await desktop.keyboard.press("Enter");
  await desktop.waitForFunction(() => document.documentElement.lang === "ms", { timeout: 5000 });
  expect(before && (await desktop.evaluate(() => window.__noReload === true)), "the page reloaded to switch language");
  expect(BM_HERO.test(await heroText(desktop)), `hero reads: ${await heroText(desktop)}`);
  expect(JSON.stringify(await pressed(desktop)) === '["ms"]', `pressed: ${await pressed(desktop)}`);
  expect((await desktop.title()).includes("bisnes kecil"), `title: ${await desktop.title()}`);
});

await step("L  nothing is left in English when BM is on", async () => {
  await new Promise((r) => setTimeout(r, 300));
  const bm = new Set(await words(desktop));
  const left = enWords.filter((t) => bm.has(t) && !same(t));
  expect(left.length === 0, `still English: ${left.slice(0, 8).join(" | ")}`);
  const text = await copy(desktop);
  expect(!text.includes("—"), "em dash in the BM copy");
  const found = BANNED.filter((w) => text.toLowerCase().includes(w));
  expect(found.length === 0, `banned wording in BM: ${found.join(", ")}`);
  expect(text.includes("Bina Website Saya"), "the BM CTA is missing");
  await desktop.screenshot({ path: path.join(shots, "landing-desktop-bm.png"), fullPage: true });
});

await step("M  BM survives a refresh", async () => {
  await desktop.reload({ waitUntil: "networkidle0" });
  await desktop.waitForFunction(() => document.documentElement.lang === "ms", { timeout: 5000 });
  expect(BM_HERO.test(await heroText(desktop)), `after reload the hero reads: ${await heroText(desktop)}`);
});

await step("N  switching back to EN restores every word", async () => {
  await desktop.click('[data-language-toggle] button[lang="en"]');
  await desktop.waitForFunction(() => document.documentElement.lang === "en", { timeout: 5000 });
  await desktop.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  // The refresh in M replays the hero's typing; compare once it has finished again.
  await desktop.waitForFunction(() => document.querySelector("#top").innerText.includes("Your website is ready"), { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 500));
  const back = await copy(desktop);
  const at = [...back].findIndex((c, i) => c !== en[i]);
  expect(back === en, `EN differs after the round trip: "${back.slice(at - 50, at + 50)}" was "${en.slice(at - 50, at + 50)}"`);
  const enNow = new Set(await words(desktop));
  const bmLeft = [...enNow].filter((t) => !enWords.includes(t));
  expect(bmLeft.length === 0, `words that were not there in EN: ${bmLeft.slice(0, 6).join(" | ")}`);
  await desktop.click('[data-language-toggle] button[lang="ms"]');
  await desktop.waitForFunction(() => document.documentElement.lang === "ms", { timeout: 5000 });
  await desktop.click('[data-language-toggle] button[lang="en"]');
  await desktop.waitForFunction(() => document.documentElement.lang === "en" && document.title.includes("Malaysian"), { timeout: 5000 });
});

for (const [name, viewport] of [["1440", DESKTOP], ["768", TABLET], ["390", MOBILE]]) {
  await step(`O  BM at ${name}px: no sideways scroll, no clipped buttons, no crowded nav`, async () => {
    const page = await browser.newPage();
    current = page;
    await page.setViewport(viewport);
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });
    for (const lang of ["ms", "en"]) {
      await page.goto(`${base}/`, { waitUntil: "networkidle0", timeout: 60000 });
      await page.evaluate((l) => localStorage.setItem("webbi.landing.lang", l), lang);
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForFunction((l) => document.documentElement.lang === l, { timeout: 5000 }, lang);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, document.body.scrollHeight - window.innerHeight * 2);
        await new Promise((r) => setTimeout(r, 600));
      });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over <= 0, `${lang}: ${over}px of horizontal overflow`);
      const bad = await cramped(page);
      expect(bad.length === 0, `${lang}: ${bad.join(" | ")}`);
      if (viewport === MOBILE) {
        const dock = await page.evaluate(() => document.querySelector('[data-show="true"] a')?.textContent.replace(/\s+/g, " ").trim() ?? null);
        expect(dock?.includes(lang === "ms" ? "Bina Website Saya" : "Create My Website"), `${lang} dock reads "${dock}"`);
      }
      if (lang === "ms") {
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise((r) => setTimeout(r, 400));
        await page.screenshot({ path: path.join(shots, `landing-bm-${name}.png`) });
        await page.screenshot({ path: path.join(shots, `landing-bm-${name}-full.png`), fullPage: true });
      }
    }
    await page.evaluate(() => localStorage.removeItem("webbi.landing.lang"));
    await page.close();
  });
}

await step("P  the switch and the round trips raised no browser errors", () => {
  expect(errors.length === 0, `${errors.length} error(s): ${errors.slice(0, 3).join(" | ")}`);
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nlanding ok");
process.exit(failed ? 1 : 0);
