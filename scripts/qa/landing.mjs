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

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nlanding ok");
process.exit(failed ? 1 : 0);
