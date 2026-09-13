// Checks that Webbi authenticates before it creates: every "Create My Website" CTA on the
// marketing landing sends a new visitor to sign-up first, and brings them back to the
// creation flow — not to the dashboard. Runs against a dev server + Firebase emulators.
//
//   npm run qa:auth
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

const tag = Date.now().toString(36).slice(-5);
const account = { name: "Ros", email: `qa-auth-${tag}@example.com`, password: "password123" };
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
/** Google's four brand colours, in the order the official mark is drawn. */
const BRAND = ["#EA4335", "#4285F4", "#FBBC05", "#34A853"];
/** Where a "Create My Website" CTA must land a visitor who has no account yet. */
const SIGNUP_URL = "/signin?mode=create&next=%2Fstart";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"],
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
let current = null;

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}${current ? ` at ${current.url()}` : ""}: ${String(e.message).split("\n")[0]}`);
    if (current) await current.screenshot({ path: path.join(shots, `auth-fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png`) }).catch(() => {});
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
/** Forgets browser errors a check provoked on purpose, so real ones still stand out. */
const drain = (re) => { for (let i = errors.length - 1; i >= 0; i--) if (re.test(errors[i])) errors.splice(i, 1); };
const here = (page) => new URL(page.url()).pathname + new URL(page.url()).search;

/** A fresh, cookie-less browser context — a visitor who has never been here. */
const newVisitor = async (viewport = DESKTOP) => {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });
  // Next routes on the client, so record history changes to spot redirect loops.
  await page.evaluateOnNewDocument(() => {
    window.__navs = [location.pathname + location.search];
    for (const k of ["pushState", "replaceState"]) {
      const original = history[k].bind(history);
      history[k] = (...args) => { const out = original(...args); window.__navs.push(location.pathname + location.search); return out; };
    }
    addEventListener("popstate", () => window.__navs.push(location.pathname + location.search));
  });
  current = page;
  return page;
};
const navs = (page) => page.evaluate(() => window.__navs ?? []);
/** A real mouse click (not element.click()) so Chrome treats it as a user gesture. */
const click = async (page, sel, label) => {
  for (const el of await page.$$(sel)) {
    const text = (await el.evaluate((e) => e.textContent)).trim();
    const shown = await el.evaluate((e) => e.getClientRects().length > 0);
    if (shown && text.includes(label)) { await el.click(); return; }
  }
  throw new Error(`No visible ${sel} reading "${label}"`);
};
const fillSignUp = async (page, { name, email, password }) => {
  await page.waitForSelector("#auth-password", { timeout: 20000 });
  if (await page.$("#auth-name")) await page.type("#auth-name", name);
  await page.type("#auth-email", email);
  await page.type("#auth-password", password);
  await page.click("button[type=submit]");
};
const heading = (page) => page.$eval("h1", (h) => h.textContent.trim());
const atPath = (page, p, timeout = 30000) =>
  page.waitForFunction((want) => location.pathname === want, { timeout }, p);

// ── A · a new visitor presses "Create My Website" and signs up with email ────────────
const visitor = await newVisitor(DESKTOP);

await step("A1 landing CTA sends a visitor with no account to sign-up, not the dashboard", async () => {
  await visitor.goto(`${base}/`, { waitUntil: "load" });
  await click(visitor, "nav a", "Create My Website");
  await visitor.waitForFunction(() => location.pathname === "/signin", { timeout: 20000 });
  expect(here(visitor) === SIGNUP_URL, `landed on ${here(visitor)}, expected ${SIGNUP_URL}`);
  await visitor.waitForSelector("#auth-name", { timeout: 20000 });
  expect((await heading(visitor)) === "Create your Webbi account", `heading reads "${await heading(visitor)}"`);
  const copy = await visitor.evaluate(() => document.body.innerText);
  expect(/tell us about your business/i.test(copy), "sign-up copy should say what happens after the account");
  expect(/Already have an account\?/.test(copy), "a visitor who already has an account must be able to switch to Sign in");
  await visitor.screenshot({ path: path.join(shots, "auth-create.png") });
});

// ── H · the Google mark on that screen is the official one ───────────────────────────
await step("H  Continue with Google shows the official four-colour Google G", async () => {
  const mark = await visitor.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => /Continue with Google/.test(b.textContent));
    if (!button) return { error: "no Continue with Google button" };
    const svg = button.querySelector("svg");
    if (!svg) return { error: "the Google button has no mark" };
    const box = svg.getBoundingClientRect();
    const style = getComputedStyle(svg);
    return {
      viewBox: svg.getAttribute("viewBox"),
      fills: [...svg.querySelectorAll("path")].map((p) => p.getAttribute("fill")),
      shapes: svg.querySelectorAll("circle, ellipse, rect").length,
      radius: style.borderRadius,
      background: style.backgroundImage,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  });
  expect(!mark.error, mark.error);
  expect(mark.viewBox === "0 0 48 48", `viewBox is ${mark.viewBox}, not Google's 48×48 grid`);
  expect(JSON.stringify(mark.fills) === JSON.stringify(BRAND), `fills are ${JSON.stringify(mark.fills)}`);
  expect(mark.shapes === 0, "the mark must be four paths only — no enclosing circle");
  expect(mark.background === "none", `the mark must not be painted with ${mark.background}`);
  expect(mark.width === mark.height && mark.width > 0, `the mark is ${mark.width}×${mark.height}, not square`);
  const clip = await visitor.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Continue with Google/.test(x.textContent)).getBoundingClientRect();
    return { x: Math.round(b.x) - 4, y: Math.round(b.y) - 4, width: Math.round(b.width) + 8, height: Math.round(b.height) + 8 };
  });
  await visitor.screenshot({ path: path.join(shots, "auth-google-button.png"), clip });
});

await step("A2 signing up returns the visitor to the creation flow they asked for", async () => {
  await fillSignUp(visitor, account);
  await atPath(visitor, "/start");
  await visitor.waitForSelector("textarea", { timeout: 20000 });
  const seen = await navs(visitor);
  expect(!seen.includes("/dashboard"), `the visitor was routed through the dashboard: ${seen.join(" → ")}`);
  expect((await heading(visitor)) === "What do you do?", `landed on "${await heading(visitor)}"`);
  await visitor.screenshot({ path: path.join(shots, "auth-start.png") });
});

// ── D · already signed in: straight to creation, no sign-in screen ───────────────────
await step("D  an authenticated visitor goes straight from the CTA to the creation flow", async () => {
  await visitor.goto(`${base}/`, { waitUntil: "load" });
  await visitor.waitForFunction(() => /Dashboard/.test(document.querySelector("nav")?.innerText ?? ""), { timeout: 20000 });
  await click(visitor, "nav a", "Create My Website");
  await atPath(visitor, "/start", 20000);
  await visitor.waitForSelector("textarea", { timeout: 20000 });
  const seen = await navs(visitor);
  expect(!seen.some((u) => u.startsWith("/signin")), `they were sent through sign-in again: ${seen.join(" → ")}`);
});

// ── G · no redirect loops in either direction ────────────────────────────────────────
await step("G  a signed-out visitor lands on sign-up once and stays there", async () => {
  const lost = await newVisitor(DESKTOP);
  await lost.goto(`${base}/start`, { waitUntil: "load" });
  await lost.waitForFunction(() => location.pathname === "/signin", { timeout: 20000 });
  expect(here(lost) === SIGNUP_URL, `direct /start went to ${here(lost)}`);
  await wait(2000);
  expect(here(lost) === SIGNUP_URL, `the page moved to ${here(lost)} on its own`);
  const hops = (await navs(lost)).filter((u) => u.startsWith("/signin"));
  expect(hops.length === 1, `bounced to sign-in ${hops.length} times: ${(await navs(lost)).join(" → ")}`);
  await lost.close();
  current = visitor;
});

await step("G  a signed-in visitor never sees the sign-in screen", async () => {
  await visitor.goto(`${base}/signin`, { waitUntil: "load" });
  await atPath(visitor, "/dashboard", 20000);
  await wait(1500);
  expect(new URL(visitor.url()).pathname === "/dashboard", `settled on ${here(visitor)}`);
});

// ── C · a returning owner uses "Sign in" and lands on their dashboard ────────────────
await step("C  Sign in on the landing takes an existing owner to their dashboard", async () => {
  const owner = await newVisitor(DESKTOP);
  await owner.goto(`${base}/`, { waitUntil: "load" });
  await click(owner, "nav a", "Sign in");
  await owner.waitForFunction(() => location.pathname === "/signin", { timeout: 20000 });
  await owner.waitForSelector("#auth-email", { timeout: 20000 });
  expect((await heading(owner)) === "Welcome back", `heading reads "${await heading(owner)}"`);
  expect(!(await owner.$("#auth-name")), "sign-in must not ask for a name");
  await owner.screenshot({ path: path.join(shots, "auth-signin.png") });
  await owner.type("#auth-email", account.email);
  await owner.type("#auth-password", account.password);
  await owner.click("button[type=submit]");
  await atPath(owner, "/dashboard");
  await owner.close();
  current = visitor;
});

// ── E · an owner who presses "Create My Website" by mistake is not made to start over ─
await step("E  an existing owner on the sign-up screen can sign in instead, and still reaches creation", async () => {
  const owner = await newVisitor(DESKTOP);
  await owner.goto(`${base}/`, { waitUntil: "load" });
  await click(owner, "nav a", "Create My Website");
  await owner.waitForSelector("#auth-name", { timeout: 20000 });
  await fillSignUp(owner, account);
  await owner.waitForFunction(() => /already has a Webbi account/.test(document.body.innerText), { timeout: 20000 });
  await owner.waitForFunction(() => document.querySelector("h1")?.textContent.trim() === "Welcome back", { timeout: 20000 });
  expect(!(await owner.$("#auth-name")), "the form should have turned into sign-in");
  expect((await owner.$eval("#auth-email", (e) => e.value)) === account.email, "their email should still be there");
  await owner.click("button[type=submit]");
  // Their original intent survives: they wanted to build, so building is where they land.
  await atPath(owner, "/start");
  await owner.waitForSelector("textarea", { timeout: 20000 });
  await owner.close();
  current = visitor;
  // Rejecting the duplicate sign-up is the whole point of this check; Firebase logs it.
  drain(/auth\/email-already-in-use|400 \(Bad Request\)/);
});

// ── B · a new visitor signs up with Google ───────────────────────────────────────────
await step("B  Continue with Google signs a new visitor up and drops them in creation", async () => {
  const google = await newVisitor(DESKTOP);
  await google.goto(`${base}/`, { waitUntil: "load" });
  await click(google, "nav a", "Create My Website");
  await google.waitForSelector("#auth-name", { timeout: 20000 });
  const opened = new Promise((resolve, reject) => {
    // Chrome announces other targets too (workers, the DevTools page), so wait for a real one.
    const onTarget = async (target) => {
      if (target.type() !== "page") return;
      const opened = await target.page();
      if (!opened) return;
      clearTimeout(timer);
      browser.off("targetcreated", onTarget);
      resolve(opened);
    };
    const timer = setTimeout(() => { browser.off("targetcreated", onTarget); reject(new Error("the Google window never opened")); }, 20000);
    browser.on("targetcreated", onTarget);
  });
  await click(google, "button", "Continue with Google");
  const popup = await opened;
  await popup.waitForSelector("#add-account-button, #email-input", { timeout: 20000 });
  const addAccount = await popup.$("#add-account-button");
  if (addAccount && (await addAccount.evaluate((e) => e.getClientRects().length > 0))) await addAccount.click();
  await popup.waitForSelector("#email-input", { visible: true, timeout: 20000 });
  await popup.type("#email-input", `qa-google-${tag}@example.com`);
  await popup.type("#display-name-input", "Ros Google");
  await popup.click("#sign-in");
  await atPath(google, "/start");
  await google.waitForSelector("textarea", { timeout: 20000 });
  const seen = await navs(google);
  expect(!seen.includes("/dashboard"), `Google sign-up detoured through the dashboard: ${seen.join(" → ")}`);
  await google.close();
  current = visitor;
});

// ── F · the same routing on a phone ──────────────────────────────────────────────────
await step("F  every landing CTA on a phone routes to sign-up too", async () => {
  const phone = await newVisitor(MOBILE);
  await phone.goto(`${base}/`, { waitUntil: "load" });
  const hrefs = await phone.$$eval("a", (as) => as.filter((a) => /Create My Website/.test(a.textContent)).map((a) => new URL(a.href).pathname));
  expect(hrefs.length >= 3, `only ${hrefs.length} Create My Website CTAs on the landing`);
  expect(hrefs.every((h) => h === "/start"), `some CTAs point elsewhere: ${[...new Set(hrefs)].join(", ")}`);
  // The sticky dock only slides up once the visitor has scrolled past the hero.
  await phone.evaluate(() => scrollTo(0, 2200));
  await phone.waitForFunction(() => document.querySelector('[data-show="true"]') !== null, { timeout: 20000 });
  await phone.screenshot({ path: path.join(shots, "auth-mobile-dock.png") });
  await click(phone, '[data-show="true"] a', "Create My Website");
  await phone.waitForFunction(() => location.pathname === "/signin", { timeout: 20000 });
  expect(here(phone) === SIGNUP_URL, `the mobile dock landed on ${here(phone)}`);
  await phone.waitForSelector("#auth-name", { timeout: 20000 });
  await phone.screenshot({ path: path.join(shots, "auth-mobile-create.png") });
  await phone.close();
  current = visitor;
});

await browser.close();
const unexpected = errors.filter((e) => !/403 \(Forbidden\)|404 \(Not Found\)/.test(e));
if (unexpected.length) { failed++; console.log("FAIL unexpected browser errors:", unexpected.slice(0, 6)); }
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
