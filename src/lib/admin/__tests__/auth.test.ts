import { generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthAccount } from "@/lib/auth/accounts";

/**
 * requireAdmin(): the only authorization for the admin panel. Google's token
 * keys are replaced by a key made here, Firebase Auth by a mocked lookup, and
 * the audit log by a spy, so nothing leaves the test. The vitest project id is
 * "test", so tokens are issued by https://securetoken.google.com/test.
 */

const keys = vi.hoisted(() => ({ publicKey: undefined as unknown }));

vi.mock("jose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jose")>()),
  createRemoteJWKSet: () => async () => keys.publicKey,
}));
vi.mock("@/lib/auth/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/accounts")>()),
  lookupAccount: vi.fn(),
}));
vi.mock("@/lib/admin/audit", () => ({ recordAdminDenied: vi.fn(async () => {}), recordAdminSession: vi.fn(async () => {}) }));
vi.mock("@/lib/admin/users", () => ({ listUsers: vi.fn(async () => ({ users: [], nextCursor: null })) }));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => {
    throw new Error("requireAdmin never reads Firestore");
  },
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {},
}));

const accounts = await import("@/lib/auth/accounts");
const audit = await import("@/lib/admin/audit");
const users = await import("@/lib/admin/users");
const lookupAccount = vi.mocked(accounts.lookupAccount);

let signing: CryptoKey;
let stranger: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signing = pair.privateKey;
  keys.publicKey = pair.publicKey;
  stranger = (await generateKeyPair("RS256")).privateKey;
});

const now = () => Math.floor(Date.now() / 1000);
const UID = "owner-uid-1";

interface TokenOptions {
  aud?: string;
  iss?: string;
  exp?: string | number;
  key?: CryptoKey;
  claims?: Record<string, unknown>;
}

function idToken({ aud = "test", iss = "https://securetoken.google.com/test", exp = "1h", key, claims = {} }: TokenOptions = {}) {
  return new SignJWT({
    email: "owner@example.com",
    email_verified: true,
    auth_time: now() - 60,
    firebase: { sign_in_provider: "google.com", identities: { "google.com": ["1"] } },
    webbiRole: "owner",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "test" })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject(UID)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key ?? signing);
}

/** An unsigned (alg: none) token, the kind the Auth emulator issues. */
function unsignedToken(claims: Record<string, unknown> = {}) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part({
    iss: "https://securetoken.google.com/test",
    aud: "test",
    sub: UID,
    iat: now(),
    exp: now() + 3600,
    auth_time: now() - 60,
    email: "owner@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
    webbiRole: "owner",
    ...claims,
  })}.`;
}

const OWNER: AuthAccount = { uid: UID, emailVerified: true, providers: ["google.com"], disabled: false, role: "owner", validSince: null };

const request = (token?: string, url = "https://webbi.online/api/admin/users", headers: Record<string, string> = {}) =>
  new Request(url, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } });

async function guard() {
  const [{ requireAdmin }, { handleApiError }] = await Promise.all([import("../auth"), import("@/lib/api/http")]);
  return async (req: Request) => {
    try {
      return { user: await requireAdmin(req, "users"), response: null };
    } catch (error) {
      return { user: null, response: handleApiError(error) };
    }
  };
}

async function expectNotFound(req: Request) {
  const { user, response } = await (await guard())(req);
  expect(user).toBeNull();
  expect(response?.status).toBe(404);
  expect(await response?.json()).toEqual({ error: { code: "not_found", message: "Not found." } });
}

beforeEach(() => {
  lookupAccount.mockReset().mockResolvedValue(OWNER);
  vi.mocked(audit.recordAdminDenied).mockClear();
  vi.mocked(users.listUsers).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("requireAdmin: the owner", () => {
  it("lets the owner in: verified Google sign-in, recent, role in the token and in Firebase Auth", async () => {
    const { user } = await (await guard())(request(await idToken()));
    expect(user).toEqual({ uid: UID, email: "owner@example.com", authTime: expect.any(Number) });
    expect(lookupAccount).toHaveBeenCalledWith(UID);
  });

  it("asks Firebase Auth live on every request, never trusting the token alone", async () => {
    const check = await guard();
    const token = await idToken();
    await check(request(token));
    await check(request(token));
    expect(lookupAccount).toHaveBeenCalledTimes(2);
  });
});

describe("requireAdmin: refusals are all the same 404", () => {
  it("no token", async () => {
    await expectNotFound(request());
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  it("a malformed Authorization header", async () => {
    await expectNotFound(request(undefined, undefined, { authorization: "Basic abc" }));
  });

  it("a garbage token", async () => {
    await expectNotFound(request("not.a.token"));
  });

  it("an expired token", async () => {
    await expectNotFound(request(await idToken({ exp: now() - 10 })));
  });

  it("a token for another Firebase project (audience)", async () => {
    await expectNotFound(request(await idToken({ aud: "another-project" })));
  });

  it("a token from another issuer", async () => {
    await expectNotFound(request(await idToken({ iss: "https://securetoken.google.com/another-project" })));
  });

  it("a token signed with the wrong key", async () => {
    await expectNotFound(request(await idToken({ key: stranger })));
  });

  it("an unsigned token (alg: none)", async () => {
    await expectNotFound(request(unsignedToken()));
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  it("a normal signed-in user without the owner role", async () => {
    await expectNotFound(request(await idToken({ claims: { webbiRole: undefined } })));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "no_role", "users");
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  it("a role that isn't exactly owner", async () => {
    await expectNotFound(request(await idToken({ claims: { webbiRole: "Owner" } })));
    await expectNotFound(request(await idToken({ claims: { webbiRole: "admin" } })));
    await expectNotFound(request(await idToken({ claims: { webbiRole: ["owner"] } })));
  });

  it("an unverified email", async () => {
    await expectNotFound(request(await idToken({ claims: { email_verified: false } })));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "email_unverified", "users");
  });

  it("a sign-in that wasn't Google (email/password)", async () => {
    await expectNotFound(request(await idToken({ claims: { firebase: { sign_in_provider: "password" } } })));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "provider", "users");
  });

  it("a custom-token sign-in", async () => {
    await expectNotFound(request(await idToken({ claims: { firebase: { sign_in_provider: "custom" } } })));
  });

  it("a stale sign-in (auth_time over 12 hours ago), even with a fresh token", async () => {
    await expectNotFound(request(await idToken({ claims: { auth_time: now() - 12 * 3600 - 60 } })));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "stale_sign_in", "users");
  });

  it("an auth_time in the future or missing", async () => {
    await expectNotFound(request(await idToken({ claims: { auth_time: now() + 3600 } })));
    await expectNotFound(request(await idToken({ claims: { auth_time: undefined } })));
  });

  it("a disabled account", async () => {
    lookupAccount.mockResolvedValue({ ...OWNER, disabled: true });
    await expectNotFound(request(await idToken()));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "account_disabled", "users");
  });

  it("a role revoked in Firebase Auth while the token still carries it", async () => {
    lookupAccount.mockResolvedValue({ ...OWNER, role: null });
    await expectNotFound(request(await idToken()));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "role_revoked", "users");
  });

  it("sessions revoked after this sign-in (validSince)", async () => {
    lookupAccount.mockResolvedValue({ ...OWNER, validSince: now() });
    await expectNotFound(request(await idToken()));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "session_revoked", "users");
  });

  it("an account deleted from Firebase Auth", async () => {
    lookupAccount.mockResolvedValue(null);
    await expectNotFound(request(await idToken()));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "account_missing", "users");
  });

  it("Google unlinked or email unverified in Firebase Auth now", async () => {
    lookupAccount.mockResolvedValue({ ...OWNER, providers: ["password"] });
    await expectNotFound(request(await idToken()));
    lookupAccount.mockResolvedValue({ ...OWNER, emailVerified: false });
    await expectNotFound(request(await idToken()));
  });

  it("a customer's domain, even with a valid owner token", async () => {
    await expectNotFound(request(await idToken(), "https://customer-bakery.com/api/admin/users"));
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  it("the Netlify fallback domain in production, even if listed in ADMIN_HOSTS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_HOSTS", "webbi.online,webbi-my.netlify.app");
    await expectNotFound(request(await idToken(), "https://webbi-my.netlify.app/api/admin/users"));
    await expectNotFound(request(await idToken(), "https://localhost/api/admin/users"));
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  it("a Host header naming another host wins over the URL", async () => {
    await expectNotFound(request(await idToken(), "https://webbi.online/api/admin/users", { host: "customer-bakery.com" }));
  });

  it("while ADMIN_PANEL_ENABLED=false", async () => {
    vi.stubEnv("ADMIN_PANEL_ENABLED", "false");
    await expectNotFound(request(await idToken()));
  });

  it("App Check failure when APP_CHECK_MODE=enforce", async () => {
    vi.stubEnv("APP_CHECK_MODE", "enforce");
    await expectNotFound(request(await idToken()));
    await expectNotFound(request(await idToken(), undefined, { "x-firebase-appcheck": "forged" }));
    expect(audit.recordAdminDenied).toHaveBeenCalledWith(UID, "app_check", "users");
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  it("App Check in monitor mode lets the owner through", async () => {
    vi.stubEnv("APP_CHECK_MODE", "monitor");
    const { user } = await (await guard())(request(await idToken()));
    expect(user?.uid).toBe(UID);
  });
});

describe("requireAdmin: Firebase Auth unavailable", () => {
  it("is a 503 for the owner, never a pass", async () => {
    lookupAccount.mockRejectedValue(new accounts.AccountLookupError("status 500"));
    const { user, response } = await (await guard())(request(await idToken()));
    expect(user).toBeNull();
    expect(response?.status).toBe(503);
  });
});

describe("requireAdmin: the emulator's unsigned tokens", () => {
  it("are accepted only outside production (control)", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    const { user } = await (await guard())(request(unsignedToken(), "http://localhost:3000/api/admin/users"));
    expect(user?.uid).toBe(UID);
  });

  it("are refused in production even with FIREBASE_AUTH_EMULATOR_HOST set", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    await expectNotFound(request(unsignedToken()));
    expect(lookupAccount).not.toHaveBeenCalled();
  });

  afterEach(() => vi.resetModules());
});

describe("admin API routes authorize before doing anything", () => {
  it("GET /api/admin/users is a 404 for a normal user and never lists accounts", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET(request(await idToken({ claims: { webbiRole: undefined } }), "https://webbi.online/api/admin/users?limit=10") as never);
    expect(response.status).toBe(404);
    expect(users.listUsers).not.toHaveBeenCalled();
  });

  it("refuses before validating the query, so a stranger can't probe parameters", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET(request(undefined, "https://webbi.online/api/admin/users?limit=999") as never);
    expect(response.status).toBe(404);
  });

  it("answers the owner, and rejects a limit over 50 with a 400", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const ok = await GET(request(await idToken(), "https://webbi.online/api/admin/users?limit=50") as never);
    expect(ok.status).toBe(200);
    expect(users.listUsers).toHaveBeenCalledWith({ limit: 50, cursor: undefined, q: undefined });
    const tooMany = await GET(request(await idToken(), "https://webbi.online/api/admin/users?limit=51") as never);
    expect(tooMany.status).toBe(400);
  });

  it("GET /api/admin/session records the session start for the owner only", async () => {
    const { GET } = await import("@/app/api/admin/session/route");
    const denied = await GET(request(await idToken({ claims: { webbiRole: undefined } }), "https://webbi.online/api/admin/session") as never);
    expect(denied.status).toBe(404);
    expect(audit.recordAdminSession).not.toHaveBeenCalled();
    const ok = await GET(request(await idToken(), "https://webbi.online/api/admin/session") as never);
    expect(ok.status).toBe(200);
    expect(audit.recordAdminSession).toHaveBeenCalledWith(UID, expect.any(Number));
    const body = await ok.json();
    expect(Object.keys(body).sort()).toEqual(["email", "signInExpiresAt", "uid"]);
  });
});
