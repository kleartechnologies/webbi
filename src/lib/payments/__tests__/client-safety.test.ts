import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Billplz's keys live on the server and nowhere else. These checks read the
 * source the way the bundler follows it, so a stray import or a NEXT_PUBLIC_
 * copy fails here before it could ever reach a browser.
 */

const ROOT = process.cwd();
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const sources = new Map<string, string>();
function read(file: string): string {
  const full = path.isAbsolute(file) ? file : path.join(ROOT, file);
  let source = sources.get(full);
  if (source === undefined) {
    source = readFileSync(full, "utf8");
    sources.set(full, source);
  }
  return source;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const CODE = /\.(ts|tsx|js|jsx|mjs)$/;
const isTest = (file: string) => /(^|\/)(__tests__|test)\/|\.test\.tsx?$/.test(rel(file));
/** Application code: everything under src/ that ships, tests and test helpers left out. */
const APP = walk(path.join(ROOT, "src")).filter((file) => !isTest(file));
/** Committed config and docs that could carry a variable. */
const CONFIG = ["next.config.ts", "netlify.toml", ".env.example", "README.md"].map((file) => path.join(ROOT, file));

const LEADING_COMMENTS = String.raw`^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*`;
const SERVER_ONLY = new RegExp(`${LEADING_COMMENTS}import\\s+["']server-only["']`);
const USE_CLIENT = new RegExp(`${LEADING_COMMENTS}["']use client["']`);

/** Module specifiers a file loads at runtime. Type-only imports are erased by the compiler, so they don't count. */
function runtimeImports(source: string): string[] {
  const specs: string[] = [];
  const statement = /(?:^|;|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s*)?["']([^"']+)["']/g;
  for (const match of source.matchAll(statement)) if (!match[1]) specs.push(match[2]);
  for (const match of source.matchAll(/\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g)) specs.push(match[1]);
  return specs;
}

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join(ROOT, "src", spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** Everything a "use client" file pulls into the browser bundle, followed import by import. */
function browserGraph() {
  const entries = APP.filter((file) => USE_CLIENT.test(read(file)));
  const modules = new Set<string>();
  const packages = new Map<string, string>();
  const queue = [...entries];
  for (let file = queue.pop(); file; file = queue.pop()) {
    if (modules.has(file)) continue;
    modules.add(file);
    if (!CODE.test(file)) continue;
    for (const spec of runtimeImports(read(file))) {
      const local = resolveLocal(file, spec);
      if (local) queue.push(local);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) packages.set(spec, rel(file));
    }
  }
  return { entries: entries.map(rel), modules: [...modules].map(rel), packages };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Billplz credentials stay on the server", () => {
  it("are read from process.env in exactly one place, src/lib/env.ts", () => {
    const readers = APP.filter((file) => /process\.env\s*(?:\.\s*BILLPLZ_|\[\s*["'`]BILLPLZ_)/.test(read(file)));
    expect(readers.map(rel)).toEqual(["src/lib/env.ts"]);
    // Nothing copies process.env wholesale or by computed name, which would dodge the check above.
    const indirect = APP.filter((file) => /=\s*process\.env\s*[;\n]|\.\.\.process\.env\b|process\.env\s*\[\s*[^"'`\s]/.test(read(file)));
    expect(indirect.map(rel)).toEqual([]);
  });

  it("are only named in server-only modules, besides env.ts", () => {
    const naming = APP.filter((file) => read(file).includes("BILLPLZ_")).map(rel);
    expect(naming).toContain("src/lib/payments/billplz.ts");
    for (const file of naming.filter((name) => name !== "src/lib/env.ts")) {
      expect(SERVER_ONLY.test(read(file)), `${file} names a Billplz variable but isn't server-only`).toBe(true);
    }
  });

  it("are never NEXT_PUBLIC_ variables", () => {
    const leaks = [...APP, ...CONFIG].filter((file) => /NEXT_PUBLIC_\w*BILLPLZ|BILLPLZ\w*NEXT_PUBLIC/i.test(read(file)));
    expect(leaks.map(rel)).toEqual([]);
  });

  it("sit behind modules that refuse to load in a browser bundle", () => {
    for (const file of [
      "src/lib/payments/billplz.ts",
      "src/lib/payments/index.ts",
      "src/lib/payments/provider.ts",
      "src/lib/payments/stripe.ts",
      "src/lib/payments/mock.ts",
      "src/lib/site/publish.ts",
      "src/lib/site/drafts.ts",
      "src/lib/api/http.ts",
      "src/lib/ai/guard.ts",
      "src/lib/ai/index.ts",
      "src/lib/ai/openai.ts",
      "src/lib/ai/anthropic.ts",
    ]) {
      expect(SERVER_ONLY.test(read(file)), `${file} must start with import "server-only"`).toBe(true);
    }
  });

  it("can't be reached from any client component", () => {
    const { entries, modules, packages } = browserGraph();
    expect(entries).toEqual(
      expect.arrayContaining([
        "src/app/(app)/s/[siteId]/publish/PublishView.tsx",
        "src/app/(app)/s/[siteId]/publish/return/ReturnView.tsx",
      ]),
    );
    // Proves the walk follows "@/" imports: client code does use publicEnv from env.ts.
    expect(modules).toContain("src/lib/env.ts");

    const serverModules = modules.filter(
      (file) =>
        file.startsWith("src/lib/payments/") ||
        file.startsWith("src/app/api/") ||
        [
          "src/lib/site/publish.ts",
          "src/lib/site/drafts.ts",
          "src/lib/firebase/admin.ts",
          "src/lib/api/http.ts",
          "src/lib/ai/guard.ts",
          "src/lib/ai/index.ts",
        ].includes(file),
    );
    expect(serverModules).toEqual([]);
    expect(modules.filter((file) => CODE.test(file) && SERVER_ONLY.test(read(file)))).toEqual([]);
    const serverPackages = [...packages.keys()].filter((name) => /^(server-only|stripe|firebase-admin)(\/|$)/.test(name));
    expect(serverPackages).toEqual([]);
    expect(modules.filter((file) => file !== "src/lib/env.ts" && CODE.test(file) && read(file).includes("BILLPLZ_"))).toEqual([]);
    // Client components only ever take publicEnv from env.ts.
    expect(entries.filter((file) => /\bserverEnv\b/.test(read(file)))).toEqual([]);
  });

  it("aren't part of the env object the browser gets", async () => {
    vi.stubEnv("BILLPLZ_SECRET_KEY", "canary-secret-3f9a");
    vi.stubEnv("BILLPLZ_COLLECTION_ID", "canary-collection-3f9a");
    vi.stubEnv("BILLPLZ_X_SIGNATURE_KEY", "canary-signature-3f9a");
    vi.stubEnv("BILLPLZ_BASE_URL", "https://www.billplz.com/api/");
    vi.resetModules();
    const { publicEnv, serverEnv } = await import("@/lib/env");

    expect(serverEnv.billplzSecretKey).toBe("canary-secret-3f9a"); // the server does see them
    expect(JSON.stringify(publicEnv)).not.toMatch(/canary|billplz/i);
    expect(Object.keys(publicEnv).filter((key) => /billplz|secret|signature|collection/i.test(key))).toEqual([]);
  });

  it("aren't forwarded into the bundle by next.config.ts", () => {
    const config = read("next.config.ts");
    expect(config).not.toMatch(/\benv\s*:/);
    expect(config).not.toMatch(/BILLPLZ_|DefinePlugin/);
  });

  it("aren't written into the code or the committed config", () => {
    const keyShaped = [
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUID-shaped API keys
      /\bS-[A-Za-z0-9_-]{16,}/, // S-… signing keys
    ];
    const hits = [...APP, ...CONFIG].filter((file) => keyShaped.some((pattern) => pattern.test(read(file))));
    expect(hits.map(rel)).toEqual([]);

    const example = read(".env.example");
    for (const name of ["BILLPLZ_SECRET_KEY", "BILLPLZ_COLLECTION_ID", "BILLPLZ_X_SIGNATURE_KEY"]) {
      expect(example).toMatch(new RegExp(`^${name}=$`, "m"));
    }
    expect(example).toMatch(/^BILLPLZ_BASE_URL=https:\/\/www\.billplz\.com\/api\/$/m);
    expect(`${example}\n${read("README.md")}`).not.toMatch(/^BILLPLZ_BASE_URL=.*sandbox/m);
  });
});
