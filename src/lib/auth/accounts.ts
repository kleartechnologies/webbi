import "server-only";
import { publicEnv } from "@/lib/env";
import { AdminNotConfiguredError, getAdminApp } from "@/lib/firebase/admin";
import { mayPublish } from "./publishing";

/**
 * Reads an account straight from Firebase Auth (server only), for decisions
 * that can't rely on a browser's ID token: publishing a paid website from the
 * payment callback, where no user token exists at all.
 *
 * Uses the Identity Toolkit REST API with the Admin credential. It isn't
 * firebase-admin/auth, which pulls in jwks-rsa (see src/lib/firebase/admin.ts).
 */

export interface AuthAccount {
  uid: string;
  emailVerified: boolean;
  /** Linked sign-in providers: "password", "google.com", … */
  providers: string[];
  disabled: boolean;
  /** webbiRole from the account's custom claims, as Firebase Auth holds them now. */
  role: string | null;
  /** Tokens issued before this (seconds) are revoked. */
  validSince: number | null;
}

export class AccountLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountLookupError";
  }
}

const LOOKUP_TIMEOUT_MS = 8_000;

/**
 * An account as the Identity Toolkit API returns it. The API also returns
 * password hashes, salts and provider details: callers copy the fields they
 * need and nothing else ever leaves the server.
 */
export interface RawAuthUser {
  localId?: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  providerUserInfo?: { providerId?: string }[];
  /** JSON string of the custom claims. */
  customAttributes?: string;
  /** Seconds, as a string. */
  validSince?: string;
  /** Milliseconds, as strings. */
  createdAt?: string;
  lastLoginAt?: string;
}

interface LookupResponse {
  users?: RawAuthUser[];
}

function authEmulatorHost(): string | undefined {
  return process.env.NODE_ENV !== "production" ? process.env.FIREBASE_AUTH_EMULATOR_HOST || undefined : undefined;
}

/**
 * One Identity Toolkit call for this project with the Admin credential (or the
 * emulator). `action` is the method after /accounts, e.g. ":lookup". Throws
 * AccountLookupError when Auth can't be asked or refuses.
 */
export async function identityToolkit<T>(
  action: string,
  init: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const projectId = publicEnv.firebase.projectId;
  const emulator = authEmulatorHost();
  let origin: string;
  let authorization: string;
  if (emulator) {
    origin = `http://${emulator}/identitytoolkit.googleapis.com`;
    authorization = "Bearer owner";
  } else {
    const credential = getAdminApp().options.credential;
    if (!credential) throw new AdminNotConfiguredError();
    let token: string;
    try {
      ({ access_token: token } = await credential.getAccessToken());
    } catch (error) {
      throw new AccountLookupError(`no access token (${error instanceof Error ? error.name : typeof error})`);
    }
    origin = "https://identitytoolkit.googleapis.com";
    authorization = `Bearer ${token}`;
  }
  const url = new URL(`${origin}/v1/projects/${projectId}/accounts${action}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "POST",
      headers: { "content-type": "application/json", authorization },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new AccountLookupError(`request failed (${error instanceof Error ? error.name : typeof error})`);
  }
  if (!response.ok) throw new AccountLookupError(`status ${response.status}`);
  const data = (await response.json().catch(() => null)) as T | null;
  if (!data) throw new AccountLookupError("unreadable response");
  return data;
}

/** The webbiRole claim inside an account's customAttributes JSON, or null. */
export function roleFromCustomAttributes(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const claims = JSON.parse(value) as unknown;
    const role = claims && typeof claims === "object" ? (claims as { webbiRole?: unknown }).webbiRole : undefined;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

export function providerIds(user: RawAuthUser): string[] {
  return (user.providerUserInfo ?? []).map((info) => info.providerId).filter((id): id is string => Boolean(id));
}

/** Several accounts by uid (at most 100), with passwords and claims left behind. Missing uids are simply absent. */
export async function lookupRawAccounts(query: { localId?: string[]; email?: string[] }): Promise<RawAuthUser[]> {
  const data = await identityToolkit<LookupResponse>(":lookup", { body: query });
  return data.users ?? [];
}

/** The account, or null when Firebase Auth has no such user. Throws AccountLookupError when Auth can't be asked. */
export async function lookupAccount(uid: string): Promise<AuthAccount | null> {
  const users = await lookupRawAccounts({ localId: [uid] });
  const user = users.find((candidate) => candidate.localId === uid);
  if (!user) return null;
  const validSince = Number(user.validSince);
  return {
    uid,
    emailVerified: user.emailVerified === true,
    providers: providerIds(user),
    disabled: user.disabled === true,
    role: roleFromCustomAttributes(user.customAttributes),
    validSince: Number.isFinite(validSince) && validSince > 0 ? validSince : null,
  };
}

export type PublishStanding = "allowed" | "unverified" | "unavailable";

/**
 * May this account's paid website go live? Asked of Firebase Auth itself, so a
 * verification made a moment ago counts. "unavailable" (Auth couldn't be
 * reached) is never treated as allowed: the caller keeps the payment for a retry.
 */
export async function publishStanding(uid: string): Promise<PublishStanding> {
  let account: AuthAccount | null;
  try {
    account = await lookupAccount(uid);
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) throw error;
    console.error("[auth] couldn't look up an account before publishing", {
      error: error instanceof Error ? error.message : typeof error,
    });
    return "unavailable";
  }
  if (!account) {
    console.error("[auth] a paid website's owner has no Firebase Auth account", { uid });
    return "unverified";
  }
  return !account.disabled && mayPublish(account) ? "allowed" : "unverified";
}
