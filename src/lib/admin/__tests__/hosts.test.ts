import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";
import { adminHosts, adminPanelEnabled, isAdminHost, isAdminPath, normalizeHost } from "../hosts";

const PROD = { NODE_ENV: "production" };
const DEV = { NODE_ENV: "development" };

describe("admin hosts", () => {
  it("defaults to webbi.online only in production", () => {
    expect(adminHosts(PROD)).toEqual(["webbi.online"]);
    expect(isAdminHost("webbi.online", PROD)).toBe(true);
    expect(isAdminHost("WEBBI.online:443", PROD)).toBe(true);
  });

  it("refuses every other production host", () => {
    for (const host of [
      "webbi-my.netlify.app",
      "www.webbi.online",
      "evil.webbi.online",
      "webbi.online.evil.com",
      "customer-bakery.com",
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "",
      null,
      undefined,
      "webbi.online/evil",
      "user@webbi.online",
    ]) {
      expect(isAdminHost(host, PROD), String(host)).toBe(false);
    }
  });

  it("never accepts the Netlify fallback or local hosts in production, even when configured", () => {
    const env = { ...PROD, ADMIN_HOSTS: "webbi.online, webbi-my.netlify.app, localhost" };
    expect(isAdminHost("webbi-my.netlify.app", env)).toBe(false);
    expect(isAdminHost("localhost", env)).toBe(false);
    expect(isAdminHost("webbi.online", env)).toBe(true);
  });

  it("ADMIN_HOSTS replaces the default", () => {
    expect(isAdminHost("webbi.online", { ...PROD, ADMIN_HOSTS: "admin.example.com" })).toBe(false);
    expect(isAdminHost("admin.example.com", { ...PROD, ADMIN_HOSTS: "admin.example.com" })).toBe(true);
  });

  it("allows localhost outside production", () => {
    expect(isAdminHost("localhost:3000", DEV)).toBe(true);
    expect(isAdminHost("127.0.0.1:3000", DEV)).toBe(true);
    expect(isAdminHost("webbi-my.netlify.app", DEV)).toBe(false);
  });

  it("normalizes only plain hostnames", () => {
    expect(normalizeHost("Webbi.Online.")).toBe("webbi.online");
    expect(normalizeHost("a b")).toBeNull();
    expect(normalizeHost("*.webbi.online")).toBeNull();
  });

  it("has a kill switch", () => {
    expect(adminPanelEnabled({})).toBe(true);
    expect(adminPanelEnabled({ ADMIN_PANEL_ENABLED: "true" })).toBe(true);
    for (const off of ["false", "FALSE", "0", "off"]) expect(adminPanelEnabled({ ADMIN_PANEL_ENABLED: off })).toBe(false);
  });

  it("knows its paths", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users/x")).toBe(true);
    expect(isAdminPath("/api/admin/users")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/w/admin")).toBe(false);
  });
});

describe("src/proxy.ts", () => {
  afterEach(() => vi.unstubAllEnvs());

  const run = (url: string, host?: string) =>
    proxy(new NextRequest(url, host ? { headers: { host } } : undefined));

  it("matches only the admin paths", () => {
    expect(config.matcher).toEqual(["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"]);
  });

  it("passes /admin and /api/admin through on webbi.online in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const url of ["https://webbi.online/admin", "https://webbi.online/admin/users", "https://webbi.online/api/admin/overview"]) {
      const response = run(url, "webbi.online");
      expect(response.headers.get("x-middleware-next"), url).toBe("1");
    }
  });

  it.each([
    ["the Netlify fallback", "webbi-my.netlify.app"],
    ["a customer domain", "customer-bakery.com"],
    ["www", "www.webbi.online"],
  ])("gives %s a 404 for pages and API", (_, host) => {
    vi.stubEnv("NODE_ENV", "production");
    const page = run(`https://${host}/admin/users`, host);
    expect(page.status).toBe(404);
    expect(page.headers.get("x-middleware-next")).toBeNull();
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    const api = run(`https://${host}/api/admin/users`, host);
    expect(api.status).toBe(404);
    expect(api.headers.get("x-middleware-next")).toBeNull();
  });

  it("a spoofed Host is judged by the Host header, not X-Forwarded-Host", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(
      new NextRequest("https://webbi-my.netlify.app/api/admin/users", {
        headers: { host: "webbi-my.netlify.app", "x-forwarded-host": "webbi.online" },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("answers 404 everywhere while ADMIN_PANEL_ENABLED=false", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PANEL_ENABLED", "false");
    const api = run("https://webbi.online/api/admin/overview", "webbi.online");
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: { code: "not_found", message: "Not found." } });
    expect(run("https://webbi.online/admin", "webbi.online").status).toBe(404);
  });
});
