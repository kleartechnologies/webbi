// End-to-end check of the whole Webbi flow against a dev server + Firebase emulators
// with AI_PROVIDER=mock and PAYMENT_PROVIDER=mock (see README "Local dev without real credentials").
//
//   npm run qa:publish
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME (path to a Chrome binary),
//      FIRESTORE_EMULATOR_HOST (default 127.0.0.1:8080), QA_PROJECT (default webbi-85f26).
// Screenshots land in scripts/qa/shots/ (git-ignored). Exit code 1 if any step fails.
import puppeteer from "puppeteer-core";
import { signUp } from "./lib.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"}/v1/projects/${process.env.QA_PROJECT || "webbi-85f26"}/databases/(default)/documents`;
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(shots, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  // BackForwardCache off: Chrome would otherwise keep old pages' Firestore channels open and hit
  // its 6-connections-per-host cap against the HTTP/1.1 emulator (production Firestore is HTTP/2).
  args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"],
});
const vp = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const page = await browser.newPage();
await page.setViewport(vp);
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("console: " + m.text().slice(0, 200)); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: path.join(shots, `${name}.png`) });
const text = () => page.evaluate(() => document.body.innerText);
const clickText = async (sel, label, exact = false) => {
  for (const el of await page.$$(sel)) {
    const t = (await el.evaluate((e) => e.textContent)).trim();
    if (exact ? t === label : t.includes(label)) { await el.evaluate((e) => e.click()); return true; }
  }
  throw new Error(`No ${sel} with text "${label}"`);
};
const retype = async (sel, value) => { await page.$eval(sel, (e) => { e.focus(); e.select(); }); await page.keyboard.type(value); };
const button = (re) => page.$$eval("button", (bs, src) => { const b = bs.find((x) => new RegExp(src).test(x.textContent)); return b ? { disabled: b.disabled } : null; }, re.source);
const fsDoc = async (p) => { const r = await fetch(`${FS}/${p}`, { headers: { Authorization: "Bearer owner" } }); return r.ok ? (await r.json()).fields : null; };
const val = (f, k) => f?.[k]?.stringValue ?? f?.[k]?.booleanValue ?? f?.[k]?.integerValue ?? null;

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) {
    failed++;
    console.log(`FAIL ${name} at ${page.url()}: ${String(e.message).split("\n")[0]}`);
    await shot(`fail-${name}`).catch(() => {});
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const tag = Date.now().toString(36).slice(-5);
const name = `Hafiz Proton ${tag}`;
let siteId, siteId2, slug;

const onboard = async (bizName) => {
  await page.goto(`${base}/start`, { waitUntil: "load" });
  await page.waitForSelector("textarea", { timeout: 15000 });
  await clickText("button", "Proton");
  await wait(200);
  await clickText("button", "Continue", true);
  await page.waitForFunction(() => location.pathname.includes("/confirm"), { timeout: 30000 });
  await page.waitForSelector("#name", { timeout: 15000 });
  await retype("#name", bizName);
  await page.type("#whatsapp", "012-345 6789");
  await page.select("#category", "car");
  await clickText("button", "Looks right");
  await page.waitForFunction(() => location.pathname.includes("/content"), { timeout: 15000 });
  await page.waitForSelector("h1", { timeout: 15000 });
  await wait(300);
  await clickText("button", "Build my website");
  await page.waitForFunction(() => location.pathname.includes("/ready"), { timeout: 60000 });
  return page.url().match(/\/s\/([^/]+)\//)[1];
};

// Building is account-first: a new visitor signs up before they describe anything.
await step("sign up → creation flow", async () => {
  await signUp(page, base, { name: "Hafiz", email: `qa-${tag}@example.com` });
});

await step("onboarding → ready", async () => { siteId = await onboard(name); });

await step("Publish → /publish (the account already exists)", async () => {
  await clickText("a", "Publish");
  await page.waitForFunction(() => location.pathname.endsWith("/publish"), { timeout: 20000 });
});

await step("slug suggested and available", async () => {
  await page.waitForSelector("#slug", { timeout: 15000 });
  await page.waitForFunction(() => /Available/.test(document.body.innerText), { timeout: 15000 });
  slug = await page.$eval("#slug", (e) => e.value);
  expect(slug.startsWith("hafiz-proton"), `unexpected slug ${slug}`);
  expect((await button(/Pay RM149\.90/))?.disabled === false, "pay button should be enabled");
  await shot("publish");
});

await step("slug validation states", async () => {
  await retype("#slug", "ab");
  await wait(150);
  expect(/At least 3/.test(await text()), "short slug hint missing");
  await page.keyboard.type("!!c");
  expect((await page.$eval("#slug", (e) => e.value)) === "ab-c", "bad characters should collapse to a dash");
  await retype("#slug", "dashboard");
  await wait(150);
  expect((await page.$$eval("[role=alert]", (es) => es.map((e) => e.textContent).join(" "))).length > 0, "reserved slug should show an error");
  await retype("#slug", slug);
  await page.waitForFunction(() => /Available/.test(document.body.innerText), { timeout: 15000 });
  expect((await page.$eval("#slug", (e) => e.value)) === slug, "dashes must survive retyping");
});

await step("mock payment → live", async () => {
  await clickText("button", "Pay RM149.90");
  await page.waitForFunction(() => location.pathname.endsWith("/live"), { timeout: 30000 });
  await page.waitForFunction(() => /You.re live/.test(document.body.innerText), { timeout: 15000 });
  await page.waitForSelector("img[alt^='QR code']", { timeout: 15000 });
  const dl = await page.$eval("a[download]", (a) => a.href.startsWith("data:image/png"));
  expect(dl, "QR download should be a PNG data URL");
  await shot("live");
});

await step("Firestore: site paid+published, publicSites, slugs, payments", async () => {
  const site = await fsDoc(`sites/${siteId}`);
  expect(val(site, "status") === "published" && val(site, "paid") === true && val(site, "slug") === slug, "site doc not published/paid");
  const pub = await fsDoc(`publicSites/${slug}`);
  expect(pub && val(pub, "siteId") === siteId && !("ownerUid" in pub), "publicSites doc wrong or leaks ownerUid");
  expect(val(await fsDoc(`slugs/${slug}`), "siteId") === siteId, "slug not claimed");
  const q = await fetch(`${FS}:runQuery`, { method: "POST", headers: { Authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "payments" }], where: { fieldFilter: { field: { fieldPath: "siteId" }, op: "EQUAL", value: { stringValue: siteId } } } } }) }).then((r) => r.json());
  const pay = q.map((x) => x.document?.fields).filter(Boolean)[0];
  expect(pay && val(pay, "status") === "paid" && val(pay, "amountSen") === "14990", "payment doc not paid for RM149.90");
});

const ctx = await browser.createBrowserContext();
const visitor = await ctx.newPage();
await visitor.setViewport(vp);
const publicText = async () => { await visitor.goto(`${base}/w/${slug}`, { waitUntil: "networkidle0" }); return visitor.evaluate(() => document.body.innerText); };

await step("public /w/{slug} for a signed-out visitor, 404 for unknown", async () => {
  const res = await visitor.goto(`${base}/w/${slug}`, { waitUntil: "networkidle0" });
  expect(res.status() === 200 && (await visitor.evaluate(() => document.body.innerText)).includes(name), "public page missing");
  await visitor.screenshot({ path: path.join(shots, "public.png") });
  expect((await visitor.goto(`${base}/w/${slug}-nope`, { waitUntil: "networkidle0" })).status() === 404, "unknown slug should 404");
});

await step("editor: Publish changes updates the live site", async () => {
  await page.goto(`${base}/s/${siteId}/edit`, { waitUntil: "load" });
  await page.waitForSelector("#biz-tagline", { timeout: 15000 });
  await wait(600);
  expect((await button(/Publish changes/))?.disabled === true, "nothing to publish yet");
  await retype("#biz-tagline", `Republished ${tag}`);
  await page.waitForFunction(() => /Saved/.test(document.querySelector("[role=status]")?.textContent || ""), { timeout: 15000 });
  await wait(300);
  expect((await button(/Publish changes/))?.disabled === false, "edits should enable Publish changes");
  expect(!(await publicText()).includes(`Republished ${tag}`), "visitors must not see unpublished edits");
  await clickText("button", "Publish changes");
  await page.waitForFunction(() => /up to date/.test(document.body.innerText), { timeout: 20000 });
  await wait(300);
  expect((await publicText()).includes(`Republished ${tag}`), "live site should show the republished tagline immediately");
});

await step("dashboard shows Published + paid, /publish redirects to /live", async () => {
  await page.goto(`${base}/dashboard`, { waitUntil: "load" });
  await page.waitForSelector("article", { timeout: 15000 });
  const card = await page.$eval("article", (a) => a.innerText);
  expect(/Published/.test(card) && /RM149\.90/.test(card), "dashboard card missing status/price");
  await page.goto(`${base}/s/${siteId}/publish`, { waitUntil: "load" });
  await page.waitForFunction(() => location.pathname.endsWith("/live"), { timeout: 15000 });
});

await step("second site: slug collision → Taken + suggestion", async () => {
  siteId2 = await onboard(name);
  await page.goto(`${base}/s/${siteId2}/publish`, { waitUntil: "load" });
  await page.waitForSelector("#slug", { timeout: 15000 });
  await page.waitForFunction(() => /Taken/.test(document.body.innerText), { timeout: 15000 });
  expect((await button(/Pay RM149\.90/))?.disabled === true, "pay must be disabled while the slug is taken");
  await shot("publish-taken");
  await clickText("button", `Use ${slug}-2`, true);
  await page.waitForFunction(() => /Available/.test(document.body.innerText), { timeout: 15000 });
  expect((await page.$eval("#slug", (e) => e.value)) === `${slug}-2`, "suggestion not applied");
});

await step("cancelled checkout and bogus return session", async () => {
  await page.goto(`${base}/s/${siteId2}/publish?cancelled=1`, { waitUntil: "load" });
  await page.waitForSelector("#slug", { timeout: 15000 });
  expect(/cancelled/i.test(await text()), "cancelled notice missing");
  await page.goto(`${base}/s/${siteId2}/publish/return?session_id=mock_cs_nonexistent`, { waitUntil: "load" });
  await page.waitForFunction(() => /couldn.t confirm/.test(document.body.innerText), { timeout: 20000 });
  await shot("return-error");
  await page.goto(`${base}/s/${siteId2}/publish/return`, { waitUntil: "load" });
  await page.waitForFunction(() => /Nothing to confirm/.test(document.body.innerText), { timeout: 20000 });
});

await browser.close();
const unexpected = consoleErrors.filter((e) => !/403 \(Forbidden\)/.test(e));
if (unexpected.length) { failed++; console.log("FAIL unexpected browser errors:", unexpected); }
console.log(failed ? `\n${failed} step(s) failed` : "\nall steps passed");
process.exit(failed ? 1 : 0);
