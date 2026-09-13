// Dashboard "Share your website" dialog, against a dev server + Firebase emulators
// (see README "Local dev without real credentials"; start the dev server with
// NEXT_PUBLIC_SITE_URL=https://webbi.online so links look like production).
//
//   npm run qa:share
//
// Signs up a fresh account, seeds three sites straight into the Firestore emulator
// (the owner's published site, the owner's draft and another account's published
// site), then checks the dialog: public URL, QR, downloads, Copy, Share and its
// fallback, keyboard and focus, and layout at 390 / 768 / 1024 / 1440.
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME, FIRESTORE_EMULATOR_HOST
//      (default 127.0.0.1:8080), QA_PROJECT (default webbi-85f26), QA_PUBLIC_ORIGIN
//      (default https://webbi.online). Downloads and screenshots land in scripts/qa/shots/share/.
import puppeteer from "puppeteer-core";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signUp } from "./lib.mjs";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const origin = (process.env.QA_PUBLIC_ORIGIN || "https://webbi.online").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const project = process.env.QA_PROJECT || "webbi-85f26";
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"}/v1/projects/${project}/databases/(default)/documents`;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots", "share");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const tag = Date.now().toString(36).slice(-5);
const NAME = `Amir (Perodua Sales Advisor) ${tag}`;
const SLUG = `amir-perodua-sales-advisor-${tag}`;
const URL_EXPECTED = `${origin}/w/${SLUG}`;
const OTHER_SLUG = `someone-else-${tag}`;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
const consoleErrors = [];
const requests = new Set();
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("console: " + m.text().slice(0, 200)); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${String(e.message).split("\n")[0]}`);
    await shot(`fail-${name.replace(/\W+/g, "-")}`).catch(() => {});
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

/** Firestore REST value encoding, enough for a site document. */
const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const seed = async (id, doc) => {
  const r = await fetch(`${FS}/sites/${id}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: enc(doc).mapValue.fields }),
  });
  if (!r.ok) throw new Error(`seed ${id}: ${r.status} ${await r.text()}`);
};
const content = (name) => ({
  business: { name, category: "automotive", description: "", phone: "", whatsapp: "", email: "", address: "" },
  theme: { preset: "bold" },
  sections: [],
});
const siteDoc = (ownerUid, name, over) => {
  const now = new Date();
  return {
    ownerUid, status: "published", paid: true, paidAt: now, slug: null, published: content(name), publishedAt: now,
    draft: content(name), sourceDescription: "", generation: { status: "done" }, language: "en",
    createdAt: now, updatedAt: now, ...over,
  };
};

const dialogState = () => page.evaluate(() => {
  const d = document.querySelector("dialog");
  if (!d) return null;
  const title = document.getElementById(d.getAttribute("aria-labelledby") || "")?.textContent;
  const img = d.querySelector("img");
  const input = d.querySelector("input");
  const r = d.getBoundingClientRect();
  return {
    open: d.open,
    title,
    alt: img?.alt ?? null,
    imgW: img?.getBoundingClientRect().width ?? 0,
    imgLoaded: Boolean(img?.complete && img.naturalWidth > 0),
    imgSrc: img?.src.slice(0, 30) ?? "",
    url: input?.value ?? null,
    activeInside: d.contains(document.activeElement),
    active: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || document.activeElement?.tagName,
    status: d.querySelector("[role=status][aria-live=polite]")?.textContent ?? null,
    rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
    vw: window.innerWidth,
    vh: window.innerHeight,
    scrollW: document.documentElement.scrollWidth,
    minTap: Math.min(...[...d.querySelectorAll("button")].map((b) => b.getBoundingClientRect().height)),
    inputOverflowsRow: input ? input.getBoundingClientRect().right > input.parentElement.getBoundingClientRect().right + 0.5 : true,
  };
});
const card = () => page.evaluateHandle((name) => [...document.querySelectorAll("article")].find((a) => a.textContent.includes(name)) ?? null, NAME);
const openShare = async () => {
  const button = await page.evaluateHandle((name) => {
    const a = [...document.querySelectorAll("article")].find((x) => x.textContent.includes(name));
    return [...(a?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Share") ?? null;
  }, NAME);
  expect(button.asElement(), "Share tile missing on the published card");
  await button.asElement().click();
  await page.waitForFunction(() => document.querySelector("dialog")?.open && document.querySelector("dialog img")?.complete, { timeout: 15000 });
};
const clickInDialog = (label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll("dialog button")].find((x) => x.textContent.trim() === l || x.getAttribute("aria-label") === l);
  if (!b) throw new Error(`no dialog button ${l}`);
  b.click();
}, label);
/** Records what the page hands to the clipboard and the share sheet, and lets a step switch either off. */
const instrument = (opts) => page.evaluate(({ share, clipboardFails }) => {
  window.__copied = [];
  window.__shared = [];
  const clip = { writeText: async (t) => { if (clipboardFails) throw new DOMException("denied", "NotAllowedError"); window.__copied.push(t); } };
  Object.defineProperty(navigator, "clipboard", { value: clip, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "share", {
    value: share ? async (data) => { window.__shared.push(data); } : undefined,
    configurable: true,
  });
}, opts);
const recorded = () => page.evaluate(() => ({ copied: window.__copied, shared: window.__shared }));

let uid;
await step("sign up and seed sites", async () => {
  await signUp(page, base, { name: "Share QA" });
  uid = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("firebaseLocalStorageDb");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
      req.onsuccess = () => resolve(req.result.find((r) => String(r.fbase_key).startsWith("firebase:authUser"))?.value?.uid);
    };
  }));
  expect(uid, "no signed-in uid");
  await seed(`qa-share-${tag}`, siteDoc(uid, NAME, { slug: SLUG }));
  await seed(`qa-share-draft-${tag}`, siteDoc(uid, `Draft ${tag}`, { status: "draft", paid: false, paidAt: null, published: null, publishedAt: null }));
  await seed(`qa-share-other-${tag}`, siteDoc("someone-else", `Someone Else ${tag}`, { slug: OTHER_SLUG }));
});

await step("dashboard: Share only on the owner's published site", async () => {
  await page.goto(`${base}/dashboard`, { waitUntil: "load" });
  await page.waitForFunction((name) => document.body.innerText.includes(name), { timeout: 30000 }, NAME);
  await page.waitForFunction((t) => document.body.innerText.includes(`Draft ${t}`), { timeout: 15000 }, tag);
  const cards = await page.$$eval("article", (as) => as.map((a) => ({ text: a.innerText, buttons: [...a.querySelectorAll("button,a")].map((b) => b.textContent.trim()) })));
  expect(!cards.some((c) => c.text.includes(`Someone Else ${tag}`)), "another account's site is on this dashboard");
  const pub = cards.find((c) => c.text.includes(NAME));
  const draft = cards.find((c) => c.text.includes(`Draft ${tag}`));
  expect(["View", "Edit", "Share"].every((l) => pub.buttons.includes(l)), `published card actions: ${pub.buttons}`);
  expect(!draft.buttons.includes("Share"), "draft card offers Share");
  const lazy = await page.evaluate(() => performance.getEntriesByType("resource").some((e) => /qrcode/i.test(e.name)));
  expect(!lazy, "QR library loaded before Share was pressed");
  await (await card()).asElement().evaluate((a) => a.scrollIntoView({ block: "center" }));
  await shot("390-dashboard");
});

await step("open: dialog, focus inside, public URL, QR alt", async () => {
  page.on("request", (r) => requests.add(new URL(r.url()).origin));
  await openShare();
  const s = await dialogState();
  expect(s.open && s.title === "Share your website", `title ${s.title}`);
  expect(s.url === URL_EXPECTED, `url ${s.url}`);
  expect(s.alt === `QR code for ${NAME} website`, `alt ${s.alt}`);
  expect(s.imgLoaded && s.imgSrc.startsWith("data:image/svg+xml"), "QR image not rendered locally");
  expect(s.activeInside, `focus outside the dialog (${s.active})`);
  const text = await page.$eval("dialog", (d) => d.innerText);
  for (const l of ["Scan to visit your website", "Download PNG", "Download SVG", "Website link", "Copy", "Share"]) expect(text.includes(l), `missing "${l}"`);
  // Whole-viewport shot only: clipped or element screenshots of top-layer <dialog> content land
  // on the wrong spot under mobile emulation.
  await shot("390-dialog");
});

await step("Copy copies the exact public URL and says so", async () => {
  await instrument({ share: false, clipboardFails: false });
  await clickInDialog("Copy");
  await page.waitForFunction(() => document.querySelector("dialog [role=status]")?.textContent === "Link copied", { timeout: 5000 });
  const { copied } = await recorded();
  expect(copied.length === 1 && copied[0] === URL_EXPECTED, `copied ${JSON.stringify(copied)}`);
  expect(await page.$eval("dialog", (d) => [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "Copied")), "no Copied state");
  await shot("390-copied");
});

await step("Copy failure shows a message and selects the link", async () => {
  await instrument({ share: false, clipboardFails: true });
  await clickInDialog("Copied").catch(() => clickInDialog("Copy"));
  await page.waitForFunction(() => /Couldn't copy/.test(document.querySelector("dialog [role=status]")?.textContent ?? ""), { timeout: 5000 });
  const sel = await page.evaluate(() => { const i = document.querySelector("dialog input"); return document.activeElement === i && i.selectionStart === 0 && i.selectionEnd === i.value.length; });
  expect(sel, "link not selected for manual copy");
  await shot("390-copy-failed");
});

await step("Share uses the Web Share API with the public URL", async () => {
  await instrument({ share: true, clipboardFails: false });
  await clickInDialog("Share");
  await wait(300);
  const { shared, copied } = await recorded();
  expect(shared.length === 1, "share not called");
  expect(shared[0].url === URL_EXPECTED && shared[0].title === NAME && shared[0].text === "Check out my website", JSON.stringify(shared[0]));
  expect(copied.length === 0, "copied as well as shared");
});

await step("Share falls back to copying without Web Share", async () => {
  await instrument({ share: false, clipboardFails: false });
  await clickInDialog("Share");
  await page.waitForFunction(() => document.querySelector("dialog [role=status]")?.textContent === "Link copied", { timeout: 5000 });
  const { copied } = await recorded();
  expect(copied[0] === URL_EXPECTED, `copied ${copied}`);
});

const downloaded = async (file) => {
  for (let i = 0; i < 50; i++) {
    const hit = readdirSync(out).find((f) => f === file);
    if (hit && statSync(path.join(out, hit)).size > 0) return path.join(out, hit);
    await wait(200);
  }
  throw new Error(`${file} not downloaded (have: ${readdirSync(out).join(", ")})`);
};

await step("Download PNG: high-resolution file named after the business", async () => {
  await clickInDialog("Download PNG");
  const file = await downloaded(`${SLUG}-qr.png`);
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString() === "PNG", "not a PNG");
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  expect(w >= 1200 && w === h, `PNG ${w}×${h}`);
  console.log(`     ${path.basename(file)} ${w}×${h}, ${buf.length} bytes`);
});

await step("Download SVG: vector file named after the business", async () => {
  await clickInDialog("Download SVG");
  const file = await downloaded(`${SLUG}-qr.svg`);
  const svg = readFileSync(file, "utf8");
  expect(svg.startsWith("<svg") && /<path/.test(svg) && !/<image|base64/.test(svg), "not a vector SVG");
  console.log(`     ${path.basename(file)} ${svg.length} bytes`);
});

await step("no external requests while sharing", async () => {
  const foreign = [...requests].filter((o) => o !== base && !/127\.0\.0\.1|localhost/.test(o) && !o.startsWith("data:") && o !== "null");
  expect(foreign.length === 0, `external: ${foreign}`);
});

await step("keyboard: Tab stays in the dialog, Escape closes, focus returns to Share", async () => {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement) || document.activeElement === document.body);
    expect(inside, `Tab ${i + 1} left the dialog`);
  }
  const ring = await page.evaluate(() => { const b = document.querySelector("dialog button[aria-label=Close]"); b.focus(); return getComputedStyle(b).outlineStyle; });
  expect(ring !== "none", "no visible focus outline on Close");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog"), { timeout: 5000 });
  const focus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(focus === "Share", `focus went to ${focus}`);
});

await step("Close button and backdrop close the dialog", async () => {
  await openShare();
  await clickInDialog("Close");
  await page.waitForFunction(() => !document.querySelector("dialog"), { timeout: 5000 });
  await openShare();
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => !document.querySelector("dialog"), { timeout: 5000 });
  const scroll = await page.evaluate(() => document.documentElement.style.overflow);
  expect(scroll === "", `page scroll still locked (${scroll})`);
});

for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
  await step(`layout at ${w}px`, async () => {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: w <= 768 ? 2 : 1, isMobile: w < 768, hasTouch: w < 768 });
    await wait(300);
    await openShare();
    const s = await dialogState();
    expect(s.rect.left >= 0 && s.rect.right <= s.vw && s.rect.top >= 0 && s.rect.bottom <= s.vh, `dialog off-screen ${JSON.stringify(s.rect)}`);
    expect(s.scrollW <= s.vw, `horizontal scroll ${s.scrollW} > ${s.vw}`);
    expect(s.imgW >= 200, `QR only ${s.imgW}px`);
    expect(s.minTap >= 44, `a button is ${s.minTap}px tall`);
    expect(!s.inputOverflowsRow, "URL field overflows its row");
    console.log(`     dialog ${Math.round(s.rect.right - s.rect.left)}×${Math.round(s.rect.bottom - s.rect.top)}, QR ${Math.round(s.imgW)}px, smallest button ${s.minTap}px`);
    await shot(`${w}-dialog`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog"), { timeout: 5000 });
  });
}

await step("no console errors", async () => {
  expect(consoleErrors.length === 0, consoleErrors.join(" | "));
});

await browser.close();
console.log(`\nShare QA artefacts: ${out}`);
console.log(failed ? `${failed} step(s) failed` : "All share steps passed");
process.exit(failed ? 1 : 0);
