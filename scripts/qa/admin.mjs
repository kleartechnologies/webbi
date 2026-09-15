// Checks the owner-only admin panel end to end against a dev server + Firebase emulators.
//
//   npm run qa:admin
//
// Needs `firebase emulators:start --only auth,firestore,storage --project webbi-85f26` and the
// emulator dev server from README "Local dev without real credentials". It seeds its own
// website and payments (with a checkout URL that must never come back), signs an owner in
// through the Auth emulator's Google widget, grants and revokes the role with
// scripts/ops/admin-role.mjs, and checks that:
//   A  a signed-out visitor is sent to sign-in and the HTML carries no data
//   B  a normal Google user and an email/password user see "Page not found"; every API is 404
//   C  the owner sees every section, detail pages, the lazy storage and system checks
//   D  API responses carry no secrets or checkout URLs; bad limits, filters and cursors are 400s
//   E  other hosts (customer domain, the Netlify fallback) get 404 even with the owner's token
//   F  headers, robots.txt and the sitemap keep the panel out of search
//   G  the panel fits a 400px screen
//   H  revoking the role locks the owner out on the next request
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME, QA_PROJECT (default webbi-85f26),
// FIREBASE_AUTH_EMULATOR_HOST (127.0.0.1:9099), FIRESTORE_EMULATOR_HOST (127.0.0.1:8080).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import puppeteer from "puppeteer-core";
import { signUp } from "./lib.mjs";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROJECT = process.env.QA_PROJECT || "webbi-85f26";
const AUTH_HOST = (process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099");
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, "shots");
mkdirSync(shots, { recursive: true });

const tag = Date.now().toString(36).slice(-6);
const OWNER_EMAIL = `qa-admin-owner-${tag}@example.com`;
const GOOGLE_USER_EMAIL = `qa-admin-google-${tag}@example.com`;
const SITE_ID = `qaadminsite${tag}`;
const BUSINESS = `QA Admin Bakery ${tag}`;
const CHECKOUT_URL = `https://www.billplz.com/bills/qa-${tag}`;
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1 };
const NARROW = { width: 400, height: 860, deviceScaleFactor: 1 };

/** Keys no admin response may contain (mirrors src/lib/admin/dto.ts). */
const FORBIDDEN = new Set([
  "passwordhash", "salt", "passwordsalt", "checkouturl", "customattributes", "customclaims", "provideruserinfo",
  "token", "idtoken", "refreshtoken", "accesstoken", "appchecktoken", "apikey", "secret", "secretkey", "clientsecret",
  "privatekey", "signaturekey", "xsignature", "credential", "credentials", "serviceaccount",
  "draft", "published", "content", "sourcedescription", "generation", "understanding", "prompt",
]);
const NOT_FOUND_BODY = JSON.stringify({ error: { code: "not_found", message: "Not found." } });

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
    if (current) await current.screenshot({ path: path.join(shots, `admin-fail-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.png`) }).catch(() => {});
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const drain = (re) => { for (let i = errors.length - 1; i >= 0; i--) if (re.test(errors[i])) errors.splice(i, 1); };

function leaks(value, at = "") {
  if (Array.isArray(value)) return value.flatMap((item, i) => leaks(item, `${at}[${i}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [...(FORBIDDEN.has(key.toLowerCase()) ? [`${at}.${key}`] : []), ...leaks(child, `${at}.${key}`)]);
}

/** A raw HTTP request, so the Host header can be anything (fetch won't let us set it). */
function raw(pathname, { host, headers = {}, method = "GET", body } = {}) {
  const url = new URL(pathname, base);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { ...headers, host: host ?? url.host } },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const api = (pathname, token, init = {}) =>
  raw(pathname, {
    ...init,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  });

async function lookupUid(email) {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
    method: "POST",
    headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ email: [email] }),
  });
  if (!res.ok) throw new Error(`Auth emulator lookup: ${res.status}`);
  const uid = (await res.json()).users?.[0]?.localId;
  if (!uid) throw new Error(`no Auth account for ${email}`);
  return uid;
}

/** scripts/ops/admin-role.mjs against the Auth emulator. Returns { code, out }. */
function adminRole(...args) {
  try {
    const out = execFileSync(process.execPath, [path.join(here, "../ops/admin-role.mjs"), ...args], {
      env: { ...process.env, FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST, QA_PROJECT: PROJECT },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (error) {
    return { code: error.status, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

// ── Seed: one suspended, paid, published website with payments and AI usage ────────
const db = getFirestore(initializeApp({ projectId: PROJECT }));
{
  const now = Timestamp.now();
  const owner = `qa-admin-customer-${tag}`;
  const batch = db.batch();
  batch.set(db.doc(`sites/${SITE_ID}`), {
    ownerUid: owner,
    status: "published",
    paid: true,
    slug: `qa-admin-${tag}`,
    moderationStatus: "suspended",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    paidAt: now,
    draft: { business: { name: BUSINESS, category: "bakery", phone: "+60111222333" }, theme: { preset: "warm" } },
  });
  batch.set(db.doc(`siteModeration/${SITE_ID}`), { moderationStatus: "suspended", moderationReason: `QA reason ${tag}`, suspendedAt: now });
  for (const [id, status, extra] of [
    [`qapay${tag}a`, "paid", { paidAt: now, paidAmountSen: 14990, fulfilledAt: now }],
    [`qapay${tag}b`, "pending", {}],
    [`qapay${tag}c`, "paid", { paidAt: now, paidAmountSen: 14990, needsAttention: true, attentionReason: "duplicate" }],
  ]) {
    batch.set(db.doc(`payments/${id}`), {
      siteId: SITE_ID, ownerUid: owner, amountSen: 14990, currency: "myr", provider: "billplz",
      providerRef: `qabill${tag}`, checkoutUrl: CHECKOUT_URL, status, createdAt: now, updatedAt: now, ...extra,
    });
  }
  batch.set(db.doc(`siteAi/${SITE_ID}`), { ownerUid: owner, understandings: 2, generations: 1, updatedAt: now });
  await batch.commit();
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--disable-features=BackForwardCache"],
});

const newVisitor = async (viewport = DESKTOP) => {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
  current = page;
  return page;
};

/** Records the Bearer token the page sends to /api/admin/*, so the API can be probed as that user. */
const captureToken = (page) => {
  const seen = { token: null };
  page.on("request", (req) => {
    if (!new URL(req.url()).pathname.startsWith("/api/admin/")) return;
    const auth = req.headers().authorization;
    if (auth?.startsWith("Bearer ")) seen.token = auth.slice(7);
  });
  return seen;
};

const click = async (page, selector, text) => {
  const handle = await page.waitForFunction(
    (sel, t) => [...document.querySelectorAll(sel)].find((el) => el.textContent.includes(t) && el.getClientRects().length > 0),
    { timeout: 20000 },
    selector,
    text,
  );
  await handle.asElement().click();
};

/** Signs in with the Auth emulator's Google widget as a new Google account. */
async function googleSignIn(page, email, name) {
  await page.goto(`${base}/signin?next=%2Fdashboard`, { waitUntil: "load" });
  const opened = new Promise((resolve, reject) => {
    const onTarget = async (target) => {
      if (target.type() !== "page") return;
      const popup = await target.page();
      if (!popup) return;
      clearTimeout(timer);
      browser.off("targetcreated", onTarget);
      resolve(popup);
    };
    const timer = setTimeout(() => { browser.off("targetcreated", onTarget); reject(new Error("the Google window never opened")); }, 20000);
    browser.on("targetcreated", onTarget);
  });
  await click(page, "button", "Continue with Google");
  const popup = await opened;
  await popup.waitForSelector("#add-account-button, #email-input", { timeout: 20000 });
  // With accounts already in the emulator the widget lists them first, and a click on
  // "Add new account" can land before its handler is attached: click until the form shows.
  for (let i = 0; i < 30; i++) {
    const form = await popup.$eval("#email-input", (e) => e.getClientRects().length > 0).catch(() => false);
    if (form) break;
    const addAccount = await popup.$("#add-account-button");
    if (addAccount && (await addAccount.evaluate((e) => e.getClientRects().length > 0))) await addAccount.click().catch(() => {});
    await wait(500);
  }
  await popup.waitForSelector("#email-input", { visible: true, timeout: 20000 });
  await popup.type("#email-input", email);
  await popup.type("#display-name-input", name);
  await popup.click("#sign-in");
  await page.waitForFunction(() => location.pathname !== "/signin", { timeout: 30000 });
}

const textOf = (page) => page.evaluate(() => document.body.innerText);
const waitForText = (page, text, timeout = 30000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text).catch(async () => {
    throw new Error(`"${text}" never appeared (page says: ${(await textOf(page)).slice(0, 160).replace(/\s+/g, " ")})`);
  });
const expectNotFoundPage = async (page) => {
  await waitForText(page, "Page not found");
  expect(!(await page.$("[data-admin-shell]")), "the admin shell rendered");
  const text = await textOf(page);
  for (const secret of [BUSINESS, SITE_ID, OWNER_EMAIL, "Owner sections", "Collected per"]) expect(!text.includes(secret), `the page shows ${secret}`);
};

const ENDPOINTS = [
  "/api/admin/session",
  "/api/admin/overview",
  "/api/admin/users",
  "/api/admin/sites",
  `/api/admin/sites/${SITE_ID}`,
  "/api/admin/payments",
  "/api/admin/ai",
  "/api/admin/moderation",
  "/api/admin/system",
];

let ownerUid = null;
let ownerToken = null;
let owner = null;
let ownerSeen = null;

// ── A · signed out ───────────────────────────────────────────────────────────────────
await step("A1 signed-out /admin redirects to sign-in and comes back to /admin", async () => {
  const page = await newVisitor();
  await page.goto(`${base}/admin/payments`, { waitUntil: "load" });
  await page.waitForFunction(() => location.pathname === "/signin", { timeout: 20000 });
  const url = new URL(page.url());
  expect(url.searchParams.get("next") === "/admin/payments", `next was ${url.searchParams.get("next")}`);
  await page.close();
});

await step("A2 the HTML of every admin page carries no customer data", async () => {
  for (const p of ["/admin", "/admin/users", "/admin/sites", "/admin/payments", "/admin/ai", "/admin/moderation", "/admin/system", `/admin/sites/${SITE_ID}`]) {
    const res = await raw(p);
    expect(res.status === 200, `${p} answered ${res.status}`);
    for (const secret of [BUSINESS, OWNER_EMAIL, CHECKOUT_URL, `qabill${tag}`, `QA reason ${tag}`, "+60111222333"]) {
      expect(!res.text.includes(secret), `${p} HTML contains ${secret}`);
    }
    if (p === "/admin") expect(!res.text.includes(SITE_ID), "/admin HTML contains the seeded site id");
  }
});

await step("A3 every admin API is the same 404 without a token", async () => {
  for (const p of ENDPOINTS) {
    const res = await api(p);
    expect(res.status === 404 && res.text === NOT_FOUND_BODY, `${p} answered ${res.status} ${res.text.slice(0, 80)}`);
  }
  const post = await api("/api/admin/system/check", null, { method: "POST", body: JSON.stringify({ service: "storage" }) });
  expect(post.status === 404, `system/check answered ${post.status}`);
});

// ── B · normal users ─────────────────────────────────────────────────────────────────
await step("B1 an email/password user sees Page not found, and the API refuses their token", async () => {
  const page = await newVisitor();
  const seen = captureToken(page);
  const { email } = await signUp(page, base, { name: "QA Admin Customer" });
  await page.goto(`${base}/admin`, { waitUntil: "load" });
  await expectNotFoundPage(page);
  expect(seen.token, "the page never asked /api/admin/session");
  for (const p of ENDPOINTS) {
    const res = await api(p, seen.token);
    expect(res.status === 404 && res.text === NOT_FOUND_BODY, `${p} answered ${res.status}`);
  }
  // The ops script won't make a password account the owner.
  const uid = await lookupUid(email);
  const refused = adminRole("grant", uid, "--apply");
  expect(refused.code === 1 && /Google sign-in isn't linked/.test(refused.out), `grant on a password account: exit ${refused.code}`);
  drain(/404|Not Found/i);
  await page.close();
});

await step("B2 a Google user without the role sees Page not found", async () => {
  const page = await newVisitor();
  const seen = captureToken(page);
  await googleSignIn(page, GOOGLE_USER_EMAIL, "QA Google Customer");
  await page.goto(`${base}/admin/users`, { waitUntil: "load" });
  await expectNotFoundPage(page);
  const res = await api("/api/admin/users", seen.token);
  expect(res.status === 404 && res.text === NOT_FOUND_BODY, `users answered ${res.status}`);
  drain(/404|Not Found/i);
  await page.close();
});

// ── C · the owner ────────────────────────────────────────────────────────────────────
await step("C1 the owner signs in with Google, is refused before the grant, let in after", async () => {
  owner = await newVisitor();
  ownerSeen = captureToken(owner);
  await googleSignIn(owner, OWNER_EMAIL, "QA Owner");
  ownerUid = await lookupUid(OWNER_EMAIL);
  await owner.goto(`${base}/admin`, { waitUntil: "load" });
  await expectNotFoundPage(owner);
  drain(/404|Not Found/i);

  const dry = adminRole("grant", ownerUid);
  expect(dry.code === 0 && /Dry run/.test(dry.out), `dry run: exit ${dry.code} ${dry.out}`);
  expect(!/Bearer|access_token|customAttributes/.test(dry.out), "the ops script printed a credential or raw claims");
  const granted = adminRole("grant", ownerUid, "--apply");
  expect(granted.code === 0 && /granted/.test(granted.out), `grant: exit ${granted.code} ${granted.out}`);
  expect(/OWNER/.test(adminRole("status", ownerUid).out), "status doesn't show the role");

  await owner.goto(`${base}/admin`, { waitUntil: "load" });
  await owner.waitForSelector("[data-admin-shell]", { timeout: 30000 });
  await waitForText(owner, "Collected per Webbi's records. Refunds are handled outside Webbi and are not deducted.");
  await waitForText(owner, "Request count (includes failed requests). Provider cost: not tracked.");
  expect(await owner.$("[data-admin-refresh]"), "no refresh button on the overview");
  ownerToken = ownerSeen.token;
  expect(ownerToken, "no admin API request carried a token");
  drain(/404|Not Found/i);
  await owner.screenshot({ path: path.join(shots, "admin-overview.png") });
});

const SECTIONS = [
  ["Users", "/admin/users", OWNER_EMAIL],
  ["Websites", "/admin/sites", BUSINESS],
  ["Payments", "/admin/payments", `qabill${tag}`],
  ["AI usage", "/admin/ai", "Provider cost: not tracked"],
  ["Moderation", "/admin/moderation", BUSINESS],
  ["System", "/admin/system", "Not actively monitored"],
  ["Overview", "/admin", "Collected per Webbi's records"],
];

await step("C2 the owner reaches every section from the navigation", async () => {
  for (const [label, href, text] of SECTIONS) {
    await click(owner, 'nav[aria-label="Owner sections"] a', label);
    await owner.waitForFunction((h) => location.pathname === h, { timeout: 20000 }, href);
    await waitForText(owner, text);
    const current = await owner.$eval('nav[aria-label="Owner sections"] a[aria-current="page"]', (a) => a.textContent);
    expect(current === label, `${label}: aria-current is on ${current}`);
    expect(!(await textOf(owner)).includes(CHECKOUT_URL), `${label} shows a checkout URL`);
  }
});

await step("C3 website and user detail pages, lazy storage and a system check", async () => {
  await owner.goto(`${base}/admin/sites/${SITE_ID}`, { waitUntil: "load" });
  await waitForText(owner, BUSINESS);
  await waitForText(owner, `qabill${tag}`);
  const storage = await owner.waitForSelector("[data-admin-storage]", { timeout: 20000 });
  await storage.click();
  await owner.waitForFunction(() => !document.querySelector("[data-admin-storage]"), { timeout: 20000 });

  await owner.goto(`${base}/admin/users/${ownerUid}`, { waitUntil: "load" });
  await waitForText(owner, OWNER_EMAIL);

  await owner.goto(`${base}/admin/system`, { waitUntil: "load" });
  const check = await owner.waitForSelector('[data-admin-check="storage"]', { timeout: 30000 });
  await check.click();
  await waitForText(owner, "Listing succeeded.");
  const text = await textOf(owner);
  expect(!/sk-[A-Za-z0-9]{8}|BILLPLZ_SECRET|FIREBASE_SERVICE_ACCOUNT/.test(text), "the system page shows a secret");
});

await step("C4 filters and pagination in the browser", async () => {
  await owner.goto(`${base}/admin/sites`, { waitUntil: "load" });
  await waitForText(owner, BUSINESS);
  const filters = await owner.$$eval("[data-filter]", (els) => els.map((el) => el.getAttribute("data-filter")));
  for (const f of ["all", "draft", "published", "paid", "suspended", "payment_pending", "paid_not_live"]) expect(filters.includes(f), `no ${f} filter`);
  expect(!filters.includes("unpublished"), "an unpublished filter exists");
  await owner.click('[data-filter="suspended"]');
  await waitForText(owner, BUSINESS);
});

// ── D · API responses ────────────────────────────────────────────────────────────────
await step("D1 every owner response is 200 and free of secrets and checkout URLs", async () => {
  expect(ownerToken, "no owner token");
  for (const p of [...ENDPOINTS, `/api/admin/sites/${SITE_ID}?section=storage`, `/api/admin/users/${ownerUid}`, "/api/admin/payments?view=refund", "/api/admin/sites?filter=paid_not_live", `/api/admin/users?q=${encodeURIComponent(OWNER_EMAIL)}`]) {
    const res = await api(p, ownerToken);
    expect(res.status === 200, `${p} answered ${res.status} ${res.text.slice(0, 120)}`);
    const found = leaks(JSON.parse(res.text));
    expect(found.length === 0, `${p} contains ${found.join(", ")}`);
    for (const secret of [CHECKOUT_URL, "passwordHash", "\"salt\"", "customAttributes", "+60111222333"]) {
      expect(!res.text.includes(secret), `${p} contains ${secret}`);
    }
    expect(/no-store/.test(res.headers["cache-control"] ?? ""), `${p} cache-control ${res.headers["cache-control"]}`);
  }
  const search = JSON.parse((await api(`/api/admin/users?q=${encodeURIComponent(OWNER_EMAIL)}`, ownerToken)).text);
  expect(search.users.length === 1 && search.users[0].uid === ownerUid, "exact email search didn't find exactly the owner");
  const partial = JSON.parse((await api(`/api/admin/users?q=${encodeURIComponent(OWNER_EMAIL.slice(0, 12))}`, ownerToken)).text);
  expect(partial.users.length === 0, "a partial email matched");
});

await step("D2 invalid input is a 400, never ignored", async () => {
  for (const p of [
    "/api/admin/users?limit=51",
    "/api/admin/sites?limit=0",
    "/api/admin/sites?filter=unpublished",
    "/api/admin/sites?cursor=does-not-exist",
    "/api/admin/sites?cursor=..%2Fpayments",
    "/api/admin/payments?view=everything",
    "/api/admin/payments?limit=10&limit=20",
    "/api/admin/overview?refresh=yes",
    "/api/admin/ai?x=1",
  ]) {
    const res = await api(p, ownerToken);
    expect(res.status === 400, `${p} answered ${res.status}`);
  }
  for (const body of [{ service: "https://example.com" }, { service: "firestore" }, { service: "openai", url: "https://example.com" }]) {
    const res = await api("/api/admin/system/check", ownerToken, { method: "POST", body: JSON.stringify(body) });
    expect(res.status === 400, `system/check ${JSON.stringify(body)} answered ${res.status}`);
  }
  const page = await api("/api/admin/sites?limit=50", ownerToken);
  expect(JSON.parse(page.text).sites.length <= 50, "more than 50 sites in a page");
  const write = await api("/api/admin/sites", ownerToken, { method: "DELETE" });
  expect(write.status === 405, `DELETE /api/admin/sites answered ${write.status}`);
});

// ── E · hosts ────────────────────────────────────────────────────────────────────────
await step("E1 a customer domain and the Netlify fallback get 404, even with the owner's token", async () => {
  for (const host of ["customer-bakery.com", "webbi-my.netlify.app", "www.webbi.online"]) {
    const apiRes = await api("/api/admin/session", ownerToken, { host });
    expect(apiRes.status === 404 && apiRes.text === NOT_FOUND_BODY, `${host} /api/admin/session answered ${apiRes.status}`);
    const pageRes = await raw("/admin", { host });
    expect(pageRes.status === 404, `${host} /admin answered ${pageRes.status}`);
    expect(!pageRes.text.includes("data-admin"), `${host} /admin rendered the panel`);
    expect(pageRes.headers["x-robots-tag"] === "noindex, nofollow, noarchive", `${host} /admin x-robots-tag ${pageRes.headers["x-robots-tag"]}`);
  }
});

// ── F · headers and search ───────────────────────────────────────────────────────────
await step("F1 admin pages and APIs are noindex and no-store; robots.txt and the sitemap leave them out", async () => {
  // `next dev` replaces a page's Cache-Control with its own; a production server keeps no-store.
  const devServer = /'unsafe-eval'/.test((await raw("/")).headers["content-security-policy"] ?? "");
  for (const p of ["/admin", "/admin/users", "/api/admin/session"]) {
    const res = await raw(p);
    expect(res.headers["x-robots-tag"] === "noindex, nofollow, noarchive", `${p} x-robots-tag ${res.headers["x-robots-tag"]}`);
    if (!devServer || p.startsWith("/api/")) expect(/no-store/.test(res.headers["cache-control"] ?? ""), `${p} cache-control ${res.headers["cache-control"]}`);
  }
  const html = (await raw("/admin")).text;
  expect(/<meta name="robots" content="noindex/.test(html), "/admin has no robots meta");
  const robots = (await raw("/robots.txt")).text;
  expect(/Disallow: \/admin/.test(robots), "robots.txt doesn't disallow /admin");
  const sitemap = (await raw("/sitemap.xml")).text;
  expect(!sitemap.includes("admin"), "the sitemap lists admin");
  const landing = (await raw("/")).text;
  expect(!/href="\/admin/.test(landing), "the landing links to /admin");
});

// ── G · 400px ────────────────────────────────────────────────────────────────────────
await step("G1 every section fits a 400px screen without sideways scrolling", async () => {
  await owner.setViewport(NARROW);
  for (const [, href, text] of SECTIONS) {
    await owner.goto(`${base}${href}`, { waitUntil: "load" });
    await waitForText(owner, text);
    const overflow = await owner.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow <= 1, `${href} overflows by ${overflow}px at 400px`);
  }
  await owner.goto(`${base}/admin/payments`, { waitUntil: "load" });
  await waitForText(owner, `qabill${tag}`);
  await owner.screenshot({ path: path.join(shots, "admin-payments-400.png"), fullPage: true });
  await owner.setViewport(DESKTOP);
});

// ── H · revoke ───────────────────────────────────────────────────────────────────────
await step("H1 revoking the role locks the owner out on the next request", async () => {
  const token = ownerSeen.token;
  expect((await api("/api/admin/session", token)).status === 200, "the owner's token didn't work before revoking");
  const revoked = adminRole("revoke", ownerUid, "--apply");
  expect(revoked.code === 0 && /revoked/.test(revoked.out), `revoke: exit ${revoked.code} ${revoked.out}`);
  // validSince has one-second resolution: a token from the same second counts as before.
  await wait(1100);
  const res = await api("/api/admin/session", token);
  expect(res.status === 404 && res.text === NOT_FOUND_BODY, `the revoked token answered ${res.status}`);
  await owner.goto(`${base}/admin`, { waitUntil: "load" });
  await owner.waitForFunction(
    () => location.pathname === "/signin" || document.body.innerText.includes("Page not found"),
    { timeout: 30000 },
  );
  expect(!(await owner.$("[data-admin-shell]")), "the panel still opened after revoking");
  // The browser's token refresh is refused (400) once the sessions are revoked.
  drain(/404|Not Found|400 \(Bad Request\)|auth\/|user-token-expired|TOKEN_EXPIRED/i);
});

// Nothing else should have gone wrong in any browser.
drain(/Download the React DevTools|Could not reach Cloud Firestore backend/i);
await step("Z  no unexpected browser errors", async () => {
  expect(errors.length === 0, errors.slice(0, 5).join(" | "));
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall admin checks passed");
process.exit(failed ? 1 : 0);
