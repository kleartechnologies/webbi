// Checks the browser security headers a running Webbi actually sends, then loads the
// app and customer sites in Chrome and fails on any Content Security Policy violation,
// a broken image, a missing Maps embed, a page that can be framed, or an API that
// answers a cross-origin preflight.
//
//   npm run build && npx next start      (a production server; `next dev` adds dev allowances)
//   npm run qa:headers
//
// Env: QA_BASE_URL (default http://localhost:3000), QA_CHROME (path to a Chrome binary),
// QA_SITE_SLUGS (comma-separated published slugs to load, read-only; the demo site is always loaded).
// Exit code 1 if any check fails.
import puppeteer from "puppeteer-core";

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const chrome = process.env.QA_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const slugs = ["hafiz-rahman", ...(process.env.QA_SITE_SLUGS || "").split(",").map((s) => s.trim()).filter(Boolean)];

const APP_PAGES = ["/", "/signin", "/signin?mode=create&next=%2Fstart", "/dashboard"];
const SITE_PAGES = slugs.map((slug) => `/w/${slug}`);
const API = ["/api/sites", "/api/publish/checkout", "/api/payments/webhook"];

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : error}`);
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const directives = (csp) =>
  Object.fromEntries((csp || "").split(";").map((p) => p.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));

function checkBaseline(headers, where) {
  assert(headers.get("strict-transport-security")?.startsWith("max-age="), `${where}: no HSTS`);
  assert(headers.get("x-content-type-options") === "nosniff", `${where}: no nosniff`);
  assert(headers.get("referrer-policy") === "strict-origin-when-cross-origin", `${where}: referrer-policy ${headers.get("referrer-policy")}`);
  assert(headers.get("permissions-policy")?.includes("camera=()"), `${where}: no permissions-policy`);
  assert(headers.get("x-frame-options") === "DENY", `${where}: x-frame-options ${headers.get("x-frame-options")}`);
  assert(!headers.get("x-powered-by"), `${where}: x-powered-by is sent`);
  assert(!headers.get("access-control-allow-origin"), `${where}: access-control-allow-origin ${headers.get("access-control-allow-origin")}`);
  const csp = headers.get("content-security-policy");
  assert(csp, `${where}: no CSP`);
  const d = directives(csp);
  // default-src 'none' (API responses) already covers object-src.
  const objects = d["object-src"] || (d["default-src"]?.join(" ") === "'none'" ? ["'none'"] : undefined);
  assert(objects?.join(" ") === "'none'", `${where}: object-src ${d["object-src"]}`);
  assert(d["frame-ancestors"]?.join(" ") === "'none'", `${where}: frame-ancestors ${d["frame-ancestors"]}`);
  assert(!(d["script-src"] || []).some((s) => s.includes("*") || s === "'unsafe-eval'"), `${where}: script-src ${d["script-src"]}`);
  assert(!(d["frame-src"] || []).some((s) => s.includes("*")), `${where}: frame-src ${d["frame-src"]}`);
  return d;
}

for (const p of APP_PAGES) {
  await step(`headers ${p} (app policy)`, async () => {
    const res = await fetch(base + p, { redirect: "manual" });
    const d = checkBaseline(res.headers, p);
    assert(d["connect-src"]?.includes("https://identitytoolkit.googleapis.com"), `${p}: app policy expected, got ${res.headers.get("content-security-policy")}`);
  });
}

for (const p of SITE_PAGES) {
  await step(`headers ${p} (site policy)`, async () => {
    const res = await fetch(base + p);
    assert(res.status === 200, `${p}: status ${res.status}`);
    const d = checkBaseline(res.headers, p);
    assert(d["connect-src"]?.join(" ") === "'self'", `${p}: site policy expected, got ${res.headers.get("content-security-policy")}`);
    assert(!/firebaseapp|apis\.google/.test(res.headers.get("content-security-policy")), `${p}: site policy allows Firebase Auth`);
  });
}

await step("headers on a missing site (404 still locked down)", async () => {
  const res = await fetch(`${base}/w/this-site-does-not-exist-qa`);
  assert(res.status === 404, `status ${res.status}`);
  checkBaseline(res.headers, "404");
});

for (const p of API) {
  await step(`headers ${p} (API: no-store, load-nothing CSP)`, async () => {
    const res = await fetch(base + p, { method: "GET", headers: { origin: "https://evil.example" } });
    checkBaseline(res.headers, p);
    assert(res.headers.get("content-security-policy") === "default-src 'none'; frame-ancestors 'none'", `${p}: CSP ${res.headers.get("content-security-policy")}`);
    assert(/no-store/.test(res.headers.get("cache-control") || ""), `${p}: cache-control ${res.headers.get("cache-control")}`);
    const text = await res.text();
    assert(!/BILLPLZ|STRIPE|FIREBASE_|OPENAI|node_modules|\/Users\/|at .*:\d+:\d+/.test(text), `${p}: body leaks internals: ${text.slice(0, 200)}`);
  });
  await step(`CORS preflight ${p} from another origin is not granted`, async () => {
    const res = await fetch(base + p, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    });
    for (const h of ["access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-headers"]) {
      assert(!res.headers.get(h), `${p}: ${h}: ${res.headers.get(h)}`);
    }
  });
}

await step("Billplz callback still reachable without sign-in (bad signature → 400, not 401/403)", async () => {
  const res = await fetch(`${base}/api/payments/webhook`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: "qa-not-a-bill", paid: "false", x_signature: "0".repeat(64) }).toString(),
  });
  assert(![401, 403].includes(res.status), `status ${res.status}`);
  assert(!res.headers.get("access-control-allow-origin"), "ACAO on the callback");
});

await step("open redirect: /signin?next=https://evil.example stays on Webbi", async () => {
  const res = await fetch(`${base}/signin?next=${encodeURIComponent("https://evil.example")}`, { redirect: "manual" });
  assert(!(res.headers.get("location") || "").includes("evil.example"), `redirects to ${res.headers.get("location")}`);
});

for (const [p, script] of [["/__/auth/handler", "handler.js"], ["/__/auth/iframe", "iframe.js"]]) {
  await step(`Firebase Auth handler ${p} is proxied from firebaseapp.com with no framing header or CSP`, async () => {
    const res = await fetch(`${base}${p}`, { redirect: "manual" });
    assert(res.status === 200, `status ${res.status} (location ${res.headers.get("location")})`);
    assert(/text\/html/.test(res.headers.get("content-type") || ""), `content-type ${res.headers.get("content-type")}`);
    assert(!res.headers.get("x-frame-options"), `x-frame-options ${res.headers.get("x-frame-options")}`);
    assert(!res.headers.get("content-security-policy"), `content-security-policy ${res.headers.get("content-security-policy")}`);
    // Firebase's own headers pass through the proxy, so this is Firebase's HSTS, not Webbi's.
    assert(res.headers.get("strict-transport-security")?.startsWith("max-age="), "no HSTS");
    assert(!res.headers.get("access-control-allow-origin"), `access-control-allow-origin ${res.headers.get("access-control-allow-origin")}`);
    const html = await res.text();
    assert(html.includes(`src="${script}"`), `body doesn't load ${script}: ${html.slice(0, 300)}`);
    const js = await fetch(`${base}/__/auth/${script}`);
    assert(js.status === 200 && /javascript/.test(js.headers.get("content-type") || ""), `${script}: ${js.status} ${js.headers.get("content-type")}`);
  });
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });

async function open(p, { wait = 1500 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const violations = [];
  await page.exposeFunction("__qaViolation", (v) => violations.push(v));
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__qaViolation(`${e.violatedDirective} blocked ${e.blockedURI || "(inline)"} ${e.sourceFile || ""}:${e.lineNumber || ""}`),
    );
  });
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to (load|execute|connect|frame)/i.test(msg.text())) violations.push(msg.text());
  });
  const res = await page.goto(base + p, { waitUntil: "networkidle0", timeout: 60_000 });
  await new Promise((r) => setTimeout(r, wait));
  return { page, res, violations };
}

for (const p of APP_PAGES) {
  await step(`browser ${p}: no CSP violations`, async () => {
    // /signin loads Firebase Auth, which preloads its Google sign-in iframe after a moment.
    const { page, violations } = await open(p, { wait: p.startsWith("/signin") ? 5000 : 1500 });
    assert(violations.length === 0, violations.join("\n     "));
    await page.close();
  });
}

await step("browser /signin: Firebase Auth's sign-in iframe is allowed to load", async () => {
  const { page, violations } = await open("/signin", { wait: 6000 });
  const frames = page.frames().map((f) => f.url()).filter((u) => /__\/auth\/iframe/.test(u));
  assert(violations.length === 0, violations.join("\n     "));
  // The SDK only creates the iframe on some flows; when it did, it must not be an error page.
  for (const url of frames) assert(url.startsWith("https://"), `auth iframe at ${url}`);
  console.log(`     auth iframes: ${frames.length ? frames.join(", ") : "none created before a sign-in click"}`);
  await page.close();
});

for (const p of SITE_PAGES) {
  await step(`browser ${p}: renders, images load, Maps embed allowed, no CSP violations`, async () => {
    const { page, res, violations } = await open(p, { wait: 3000 });
    assert(res.status() === 200, `status ${res.status()}`);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    // Lazy photos go through /_next/image, which optimises on first request: wait for each to load or fail.
    const report = await page.evaluate(async () => ({
      images: await Promise.all(
        [...document.images].map(async (img) => {
          img.loading = "eager";
          const settled = img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              });
          await Promise.race([settled, new Promise((r) => setTimeout(r, 20_000))]);
          return { src: img.currentSrc || img.src, ok: img.complete && img.naturalWidth > 0 };
        }),
      ),
      maps: [...document.querySelectorAll("iframe")].map((f) => f.src).filter((s) => s.includes("google.com/maps")),
      scripts: [...document.scripts].map((s) => s.src).filter((s) => s && !s.startsWith(location.origin)),
      unsafeLinks: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /^\s*(javascript|data|vbscript|file):/i.test(h)),
    }));
    const broken = report.images.filter((i) => !i.ok && i.src);
    assert(broken.length === 0, `broken images: ${broken.map((i) => i.src).join(", ")}`);
    assert(report.scripts.length === 0, `third-party scripts: ${report.scripts.join(", ")}`);
    assert(report.unsafeLinks.length === 0, `unsafe links: ${report.unsafeLinks.join(", ")}`);
    const mapFrames = page.frames().filter((f) => f.url().includes("google.com/maps"));
    for (const f of mapFrames) assert(!f.url().startsWith("chrome-error"), `maps frame blocked: ${f.url()}`);
    assert(violations.length === 0, violations.join("\n     "));
    console.log(`     ${report.images.length} images, ${report.maps.length} maps embed(s)`);
    await page.close();
  });
}

await step("clickjacking: a page on another origin can't frame the app or a site", async () => {
  const page = await browser.newPage();
  const refused = [];
  page.on("console", (msg) => refused.push(msg.text()));
  const targets = ["/", "/signin", SITE_PAGES[0]];
  await page.setContent(targets.map((t) => `<iframe src="${base}${t}" width="400" height="300"></iframe>`).join(""), { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 3000));
  for (const t of targets) {
    const frame = page.frames().find((f) => f !== page.mainFrame() && (f.url() === base + t || f.url().startsWith("chrome-error")));
    let rendered = false;
    if (frame && !frame.url().startsWith("chrome-error")) {
      rendered = await frame.evaluate(() => document.body?.innerText.length > 0).catch(() => false);
    }
    assert(!rendered, `${t} rendered inside a frame`);
  }
  await page.close();
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall security header checks passed");
process.exit(failed ? 1 : 0);
