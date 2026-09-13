import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webhook } from "@/app/api/payments/webhook/route";
import { handleApiError } from "@/lib/api/http";
import { AdminNotConfiguredError } from "@/lib/firebase/admin";
import { firebaseAuthHandlerOrigin, firebaseAuthRewrites } from "@/lib/firebase/authHandler";
import { PaymentError } from "@/lib/payments";
import {
  API_CSP,
  appCspDirectives,
  HSTS,
  PERMISSIONS_POLICY,
  securityHeaderRules,
  siteCspDirectives,
  type SecurityHeaderOptions,
} from "../headers";

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => {
    throw new Error("a rejected callback must never reach Firestore");
  },
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {
    constructor() {
      super("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_BASE64.");
    }
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const root = process.cwd();
const PROD: SecurityHeaderOptions = { authDomain: "webbi-85f26.firebaseapp.com" };

/** Next's own compiler for next.config `headers()` sources: the regex it writes to routes-manifest.json. */
const { buildCustomRoute } = createRequire(import.meta.url)("next/dist/lib/build-custom-route.js") as {
  buildCustomRoute: (type: "header" | "rewrite", route: object) => { regex: string };
};

/** The headers Next sends for a path: every matching rule applies, a later rule wins per header. */
function headersFor(pathname: string, options: SecurityHeaderOptions = PROD): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of securityHeaderRules(options)) {
    if (!new RegExp(buildCustomRoute("header", rule).regex).test(pathname)) continue;
    for (const { key, value } of rule.headers) result[key.toLowerCase()] = value;
  }
  return result;
}

function parseCsp(value: string): Record<string, string[]> {
  return Object.fromEntries(
    value.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

const APP_PAGES = ["/", "/signin", "/start", "/dashboard", "/account", "/s/abc123/edit", "/s/abc123/publish", "/s/abc123/live"];
const SITE_PAGES = ["/w/hafiz-rahman", "/w/amir-perodua-sales-advisor"];
const API_PATHS = ["/api/sites", "/api/publish/checkout", "/api/payments/webhook", "/api/sites/images"];

describe("baseline headers on every response", () => {
  it.each([...APP_PAGES, ...SITE_PAGES, ...API_PATHS])("%s gets HSTS, nosniff, referrer, permissions, framing and CSP", (p) => {
    const h = headersFor(p);
    expect(h["strict-transport-security"]).toBe(HSTS);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toBe(PERMISSIONS_POLICY);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toBeTruthy();
  });

  it("uses a year of HSTS with no preload and no includeSubDomains until the custom domain is deliberate", () => {
    expect(HSTS).toBe("max-age=31536000");
    expect(HSTS).not.toMatch(/preload|includeSubDomains/i);
  });

  it("switches off capabilities Webbi never uses, and leaves clipboard and share alone", () => {
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb", "display-capture"]) {
      expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
    }
    expect(PERMISSIONS_POLICY).not.toMatch(/clipboard|web-share|fullscreen/);
    expect(PERMISSIONS_POLICY).not.toContain("*");
  });

  it("never allows SAMEORIGIN framing", () => {
    for (const p of [...APP_PAGES, ...SITE_PAGES]) expect(headersFor(p)["x-frame-options"]).not.toMatch(/sameorigin/i);
  });
});

describe("one policy per surface", () => {
  it.each(APP_PAGES)("%s gets the app policy", (p) => {
    expect(parseCsp(headersFor(p)["content-security-policy"])).toEqual(appCspDirectives(PROD));
  });

  it.each(SITE_PAGES)("%s gets the customer site policy", (p) => {
    expect(parseCsp(headersFor(p)["content-security-policy"])).toEqual(siteCspDirectives(PROD));
  });

  it.each(API_PATHS)("%s gets a load-nothing policy and is never cached", (p) => {
    const h = headersFor(p);
    expect(h["content-security-policy"]).toBe(API_CSP);
    expect(h["cache-control"]).toBe("private, no-store");
  });

  it("doesn't mark public pages uncacheable, so static pages keep their CDN caching", () => {
    for (const p of [...APP_PAGES, ...SITE_PAGES]) expect(headersFor(p)["cache-control"]).toBeUndefined();
  });

  it("doesn't let a look-alike path pick up another surface's policy", () => {
    expect(headersFor("/work")["content-security-policy"]).toBe(headersFor("/")["content-security-policy"]);
    expect(headersFor("/apis")["cache-control"]).toBeUndefined();
  });
});

describe("content security policy", () => {
  const policies = { app: appCspDirectives(PROD), site: siteCspDirectives(PROD) };

  it.each(Object.entries(policies))("%s: no plugins, no <base> hijack, no framing, forms stay on Webbi", (_, csp) => {
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["default-src"]).toEqual(["'self'"]);
  });

  it.each(Object.entries(policies))("%s: no wildcard, scheme-only or eval sources for scripts, frames or connections", (_, csp) => {
    for (const directive of ["script-src", "frame-src", "connect-src", "img-src", "default-src"]) {
      for (const source of csp[directive] ?? []) {
        expect(source, `${directive} ${source}`).not.toMatch(/\*/);
        expect(source, `${directive} ${source}`).not.toMatch(/^(https?:|http:\/\/)$/);
      }
    }
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("data:");
    expect(csp["script-src"]).not.toContain("blob:");
    for (const source of Object.values(csp).flat()) expect(source).not.toMatch(/^http:\/\//);
  });

  it("allows exactly the origins the app needs", () => {
    const app = policies.app;
    expect(app["script-src"]).toEqual(["'self'", "'unsafe-inline'", "https://apis.google.com"]);
    expect(app["connect-src"]).toEqual([
      "'self'",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
    ]);
    expect(app["frame-src"]).toEqual(["https://webbi-85f26.firebaseapp.com", "https://www.google.com"]);
    expect(app["img-src"]).toEqual(["'self'", "data:", "blob:", "https://firebasestorage.googleapis.com"]);
  });

  it("gives customer sites no Firebase Auth, no Google script loader and no external connections", () => {
    const site = policies.site;
    expect(site["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(site["connect-src"]).toEqual(["'self'"]);
    expect(site["frame-src"]).toEqual(["https://www.google.com"]);
    expect(Object.values(site).flat().join(" ")).not.toMatch(/firebaseapp|identitytoolkit|securetoken|firestore|apis\.google/);
  });

  it("lets the app policy load anything a customer site loads, so a client-side hop into /w/ still works", () => {
    for (const [directive, sources] of Object.entries(policies.site)) {
      if (["frame-ancestors", "base-uri", "object-src", "form-action"].includes(directive)) continue;
      for (const source of sources) expect(policies.app[directive], `${directive} ${source}`).toContain(source);
    }
  });

  it("adds only local development allowances under next dev", () => {
    const dev = appCspDirectives({ ...PROD, dev: true });
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws://localhost:*");
    expect(appCspDirectives(PROD)["connect-src"].join(" ")).not.toMatch(/localhost|127\.0\.0\.1|ws:/);
  });

  it("ignores an auth domain that isn't a plain hostname instead of widening frame-src", () => {
    for (const authDomain of ["*", "*.firebaseapp.com", "evil.example https://other.example", "https://x.example", "x.example;script-src *"]) {
      expect(appCspDirectives({ authDomain })["frame-src"]).toEqual(["https://www.google.com"]);
    }
  });

  it("is applied through next.config.ts headers(), the only place security headers are set", () => {
    const config = readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(config).toMatch(/async headers\(\)[\s\S]*securityHeaderRules\(/);
    expect(config).toMatch(/poweredByHeader:\s*false/);
    expect(readFileSync(path.join(root, "netlify.toml"), "utf8")).not.toMatch(/\[\[headers\]\]/);
    expect(existsAny(["src/middleware.ts", "src/proxy.ts", "middleware.ts", "proxy.ts", "public/_headers"])).toBe(false);
  });
});

describe("Firebase Auth handler under Webbi's own domain", () => {
  const HANDLER_PATHS = ["/__/auth/handler", "/__/auth/iframe", "/__/auth/handler.js", "/__/auth/iframe.js", "/__/auth/experiments.js"];

  it.each(HANDLER_PATHS)("%s gets transport headers only: no CSP or framing header, as Firebase serves it", (p) => {
    const h = headersFor(p);
    expect(h["strict-transport-security"]).toBe(HSTS);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-frame-options"]).toBeUndefined();
    expect(h["content-security-policy"]).toBeUndefined();
    expect(h["cache-control"]).toBeUndefined();
  });

  it.each(["/__/auth", "/__/authorize", "/__/auth-handler", "/__/firebase/init.json", "/x/__/auth/handler", "/w/__/auth/handler", "/api/__/auth/handler"])(
    "%s is not the handler and keeps the full headers",
    (p) => {
      const h = headersFor(p);
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["content-security-policy"]).toBeTruthy();
    },
  );

  it("proxies only /__/auth/… to this project's firebaseapp.com, never to the auth domain", () => {
    expect(firebaseAuthRewrites("webbi-85f26")).toEqual([
      { source: "/__/auth/:path+", destination: "https://webbi-85f26.firebaseapp.com/__/auth/:path+" },
    ]);
    const rewriteRegex = new RegExp(buildCustomRoute("rewrite", firebaseAuthRewrites("webbi-85f26")[0]).regex);
    for (const p of ["/__/auth/handler", "/__/auth/iframe", "/__/auth/handler.js"]) expect(rewriteRegex.test(p), p).toBe(true);
    for (const p of ["/", "/__/auth", "/__/authorize", "/__/firebase/init.json", "/signin", "/api/sites", "/x/__/auth/handler"]) {
      expect(rewriteRegex.test(p), p).toBe(false);
    }
  });

  it("sets up no proxy for a missing or malformed project id", () => {
    for (const id of [undefined, "", "evil.example", "webbi-85f26.firebaseapp.com/", "x", "a/b", "WEBBI", "webbi-85f26 x"]) {
      expect(firebaseAuthRewrites(id), String(id)).toEqual([]);
    }
    expect(firebaseAuthHandlerOrigin(" webbi-85f26 ")).toBe("https://webbi-85f26.firebaseapp.com");
  });

  it("is wired as a Next.js rewrite from the project id (Netlify reads netlify.toml rules after the Next.js function)", () => {
    const config = readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(config).toMatch(/async rewrites\(\)[\s\S]*firebaseAuthRewrites\(process\.env\.NEXT_PUBLIC_FIREBASE_PROJECT_ID\)/);
    expect(config).not.toMatch(/firebaseAuthRewrites\(process\.env\.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/);
    expect(readFileSync(path.join(root, "netlify.toml"), "utf8")).not.toMatch(/\[\[redirects\]\]|__\/auth/);
  });

  it("frames the handler from webbi.online once it is the auth domain", () => {
    expect(appCspDirectives({ authDomain: "webbi.online" })["frame-src"]).toEqual(["https://webbi.online", "https://www.google.com"]);
  });
});

function existsAny(files: string[]): boolean {
  return files.some((file) => {
    try {
      readFileSync(path.join(root, file));
      return true;
    } catch {
      return false;
    }
  });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [full] : [];
  });
}

describe("CORS: nothing opts other origins in", () => {
  it("sets no Access-Control-* header anywhere in the app, config or Netlify settings", () => {
    const files = [...sourceFiles(path.join(root, "src")), path.join(root, "next.config.ts"), path.join(root, "netlify.toml")];
    for (const file of files) {
      if (file.includes(`${path.sep}security${path.sep}__tests__`)) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/Access-Control-Allow|access-control-allow/);
    }
    for (const rule of securityHeaderRules(PROD)) {
      for (const { key } of rule.headers) expect(key.toLowerCase()).not.toMatch(/^access-control-/);
    }
  });

  it("has no OPTIONS handlers that could answer a cross-origin preflight", () => {
    for (const file of sourceFiles(path.join(root, "src/app/api"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/export (async )?function OPTIONS|export const OPTIONS/);
    }
  });
});

describe("Billplz callback stays open to Billplz", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMENT_PROVIDER", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLPLZ_BASE_URL", "https://www.billplz.com/api/");
    vi.stubEnv("BILLPLZ_SECRET_KEY", "secret-key-for-unit-tests-only");
    vi.stubEnv("BILLPLZ_COLLECTION_ID", "webbi_test_col");
    vi.stubEnv("BILLPLZ_X_SIGNATURE_KEY", "x-signature-key-for-unit-tests-only");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers a server-to-server POST with no sign-in, App Check or Origin, and rejects a bad signature on its own", async () => {
    const body = new URLSearchParams({ id: "bill-1", paid: "true", state: "paid", x_signature: "0".repeat(64) });
    const response = await webhook(
      new Request("https://webbi.online/api/payments/webhook", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe("bad_request");
  });

  it("has no auth, App Check or origin check in the callback route", () => {
    const source = readFileSync(path.join(root, "src/app/api/payments/webhook/route.ts"), "utf8");
    expect(source).not.toMatch(/requireUser|verifyIdToken|appCheck|X-Firebase-AppCheck|headers\.get\(["']origin/i);
  });
});

describe("error responses don't describe the server", () => {
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const LEAKS = /BILLPLZ|STRIPE|NEXT_PUBLIC|FIREBASE_|SERVICE_ACCOUNT|OPENAI|gcloud|process\.env|\/Users\/|node_modules|at .*\(.*:\d+:\d+\)|Error:/;

  it.each([
    ["payments not configured", new PaymentError("payments_not_configured", "Missing BILLPLZ_SECRET_KEY, NEXT_PUBLIC_SITE_URL")],
    ["admin not configured", new AdminNotConfiguredError()],
    ["unexpected error", Object.assign(new Error("ENOENT /Users/x/node_modules/y"), { stack: "Error: boom\n at f (/Users/x/a.ts:1:2)" })],
  ])("%s → generic message, same code the client relies on", async (_, error) => {
    const response = handleApiError(error);
    const text = await response.text();
    expect(text).not.toMatch(LEAKS);
    expect(response.status).toBeGreaterThanOrEqual(500);
  });

  it("keeps the admin_not_configured code the Publish screen checks", async () => {
    const response = handleApiError(new AdminNotConfiguredError());
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("admin_not_configured");
  });
});
