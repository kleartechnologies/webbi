import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApiError } from "@/lib/api/http";
import { AppCheckError, appCheckMode, projectNumber, requireAppCheck, verifyAppCheckToken } from "../appCheck";

/**
 * App Check on Webbi's API routes, with App Check's public keys replaced by a
 * key made here: no request leaves the test. The vitest env gives the web app
 * id "1:1:web:test", so the project number is "1".
 */

const keys = vi.hoisted(() => ({ publicKey: undefined as unknown, other: undefined as unknown }));

vi.mock("jose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jose")>()),
  createRemoteJWKSet: () => async () => keys.publicKey,
}));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => {
    throw new Error("App Check never reaches Firestore");
  },
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {},
}));

let signing: CryptoKey;
let stranger: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signing = pair.privateKey;
  keys.publicKey = pair.publicKey;
  stranger = (await generateKeyPair("RS256")).privateKey;
  expect(await exportJWK(pair.publicKey)).toMatchObject({ kty: "RSA" });
});

function token(overrides: { iss?: string; aud?: string; sub?: string; exp?: string; key?: CryptoKey } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "test" })
    .setIssuer(overrides.iss ?? "https://firebaseappcheck.googleapis.com/1")
    .setAudience(overrides.aud ?? "projects/1")
    .setSubject(overrides.sub ?? "1:1:web:test")
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? "1h")
    .sign(overrides.key ?? signing);
}

const request = (headers: Record<string, string> = {}) =>
  new Request("https://webbi.online/api/sites", { method: "POST", headers });

beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("App Check tokens", () => {
  it("reads the project number from the web app id", () => {
    expect(projectNumber()).toBe("1");
  });

  it("accepts a token App Check issued for this web app", async () => {
    await expect(verifyAppCheckToken(await token())).resolves.toEqual({ appId: "1:1:web:test" });
  });

  it.each([
    ["another project", { iss: "https://firebaseappcheck.googleapis.com/2" }],
    ["another audience", { aud: "projects/2" }],
    ["another app in the project", { sub: "1:1:android:test" }],
    ["an expired token", { exp: "-1m" }],
  ])("refuses %s", async (_, overrides) => {
    await expect(verifyAppCheckToken(await token(overrides))).rejects.toBeInstanceOf(AppCheckError);
  });

  it("refuses a token signed by anyone but App Check, and garbage", async () => {
    await expect(verifyAppCheckToken(await token({ key: stranger }))).rejects.toBeInstanceOf(AppCheckError);
    await expect(verifyAppCheckToken("not-a-token")).rejects.toBeInstanceOf(AppCheckError);
    await expect(verifyAppCheckToken("")).rejects.toBeInstanceOf(AppCheckError);
  });
});

describe("APP_CHECK_MODE", () => {
  it("is off unless set to monitor or enforce, so dev, tests and emulators need nothing", async () => {
    for (const value of [undefined, "", "on", "true", "ENFORCED"]) {
      if (value === undefined) vi.stubEnv("APP_CHECK_MODE", undefined as unknown as string);
      else vi.stubEnv("APP_CHECK_MODE", value);
      expect(appCheckMode()).toBe("off");
    }
    await expect(requireAppCheck(request(), "sites.create")).resolves.toBeUndefined();
    vi.stubEnv("APP_CHECK_MODE", " Enforce ");
    expect(appCheckMode()).toBe("enforce");
  });

  it("monitor: logs a missing or bad token and lets the request through", async () => {
    vi.stubEnv("APP_CHECK_MODE", "monitor");
    await expect(requireAppCheck(request(), "ai")).resolves.toBeUndefined();
    await expect(requireAppCheck(request({ "X-Firebase-AppCheck": "forged" }), "ai")).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith("[app-check] would refuse", { route: "ai", reason: "missing" });
    expect(console.warn).toHaveBeenCalledWith("[app-check] would refuse", { route: "ai", reason: "invalid" });
  });

  it("enforce: refuses a missing or bad token with 401 app_check_failed and a message that names nothing", async () => {
    vi.stubEnv("APP_CHECK_MODE", "enforce");
    const attempts: Record<string, string>[] = [{}, { "X-Firebase-AppCheck": "forged" }, { "X-Firebase-AppCheck": await token({ key: stranger }) }];
    for (const headers of attempts) {
      const error = await requireAppCheck(request(headers), "sites.images").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppCheckError);
      const response = handleApiError(error);
      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("app_check_failed");
      expect(body.error.message).not.toMatch(/app.?check|recaptcha|token|jwt|firebase/i);
    }
  });

  it("enforce: lets a valid token through", async () => {
    vi.stubEnv("APP_CHECK_MODE", "enforce");
    await expect(requireAppCheck(request({ "X-Firebase-AppCheck": await token() }), "ai")).resolves.toBeUndefined();
  });
});
