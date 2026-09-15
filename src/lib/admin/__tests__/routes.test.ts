import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guards over the admin panel's source: every API route authorizes
 * itself before reading anything, the browser code never touches Firestore or
 * server modules, and nothing public links to /admin.
 */

const root = process.cwd();

function walk(dir: string): string[] {
  const full = path.join(root, dir);
  return readdirSync(full).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const API_ROUTES = walk("src/app/api/admin").filter((file) => file.endsWith("route.ts"));

describe("admin API routes", () => {
  it("are exactly the V1 read-only set", () => {
    expect(API_ROUTES.map((file) => path.dirname(file).replace("src/app/api/admin", "") || "/").sort()).toEqual(
      ["/ai", "/moderation", "/overview", "/payments", "/session", "/sites", "/sites/[siteId]", "/system", "/system/check", "/users", "/users/[uid]"].sort(),
    );
  });

  it.each(API_ROUTES)("%s only reads (GET), except the fixed system check (POST)", (file) => {
    const source = read(file);
    const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)/g)].map((match) => match[1]);
    expect(methods).toEqual(file.includes("system/check") ? ["POST"] : ["GET"]);
    expect(source).toMatch(/export const runtime = "nodejs"/);
    expect(source).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it.each(API_ROUTES)("%s calls requireAdmin() before parsing input or reading data", (file) => {
    const source = read(file);
    const guard = source.indexOf("await requireAdmin(request");
    expect(guard).toBeGreaterThan(0);
    const body = source.slice(source.search(/export\s+async\s+function/));
    const firstGuard = body.indexOf("await requireAdmin(request");
    for (const later of [".parse(", "searchParamsOf(", "request.json(", "params;", "await params"]) {
      const at = body.indexOf(later);
      if (at !== -1) expect(at, `${later} comes before requireAdmin`).toBeGreaterThan(firstGuard);
    }
    // Responses with data go through the DTO leak check.
    expect(source).not.toMatch(/NextResponse\.json\(|Response\.json\(/);
    expect(source).toMatch(/adminJson\(/);
  });

  it("the system check accepts only a named service, never a URL, and is rate limited", () => {
    const source = read("src/app/api/admin/system/check/route.ts");
    expect(source).toMatch(/systemCheckBody\.parse/);
    expect(source).toMatch(/assertRateLimit\(/);
    expect(read("src/lib/admin/health.ts")).not.toMatch(/fetch\(\s*(?:url|body|input|service)\b/);
  });
});

const UI_FILES = [...walk("src/app/(admin)"), ...walk("src/components/admin"), "src/lib/admin/client.ts", "src/lib/admin/format.ts", "src/lib/admin/policy.ts"].filter(
  (file) => /\.(tsx?|mjs)$/.test(file),
);

const SERVER_ADMIN_MODULES = ["auth", "audit", "dto", "users", "sites", "payments", "ai", "moderation", "metrics", "health", "paging"];

describe("admin browser code", () => {
  it.each(UI_FILES)("%s never reads Firestore or loads server modules", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/from\s+["']firebase\/firestore["']/);
    expect(source).not.toMatch(/from\s+["']firebase-admin/);
    expect(source).not.toMatch(/@\/lib\/firebase\/admin/);
    expect(source).not.toMatch(/onSnapshot|getDocs?\(/);
    for (const match of source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+["']@\/lib\/admin\/([a-z]+)["']/gm)) {
      if (SERVER_ADMIN_MODULES.includes(match[2])) expect(match[1], `${file} imports @/lib/admin/${match[2]} at runtime`).toBe("type ");
    }
  });

  it("admin pages render no data on the server: no fetching, no async components", () => {
    for (const file of walk("src/app/(admin)").filter((f) => /(page|layout)\.tsx$/.test(f))) {
      const source = read(file);
      expect(source, file).not.toMatch(/\bawait\b|\bfetch\(|async function/);
    }
  });

  it("server admin modules are marked server-only", () => {
    for (const name of SERVER_ADMIN_MODULES) {
      expect(read(`src/lib/admin/${name}.ts`), name).toMatch(/^import "server-only";/);
    }
  });
});

describe("nothing public points at /admin", () => {
  it("no page or component outside the panel links to it", () => {
    const publicFiles = [...walk("src/app"), ...walk("src/components")].filter(
      (file) =>
        /\.(tsx?)$/.test(file) &&
        !file.startsWith("src/app/(admin)") &&
        !file.startsWith("src/app/api/admin") &&
        !file.startsWith("src/components/admin") &&
        !file.includes("__tests__") &&
        file !== "src/app/robots.ts",
    );
    const offenders = publicFiles.filter((file) => /["'`]\/admin(?:[/"'`?#]|$)/m.test(read(file)));
    expect(offenders).toEqual([]);
  });
});
