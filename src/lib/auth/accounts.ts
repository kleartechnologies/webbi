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
}

export class AccountLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountLookupError";
  }
}

const LOOKUP_TIMEOUT_MS = 8_000;

interface LookupResponse {
  users?: {
    localId?: string;
    emailVerified?: boolean;
    disabled?: boolean;
    providerUserInfo?: { providerId?: string }[];
  }[];
}

function authEmulatorHost(): string | undefined {
  return process.env.NODE_ENV !== "production" ? process.env.FIREBASE_AUTH_EMULATOR_HOST || undefined : undefined;
}

/** The account, or null when Firebase Auth has no such user. Throws AccountLookupError when Auth can't be asked. */
export async function lookupAccount(uid: string): Promise<AuthAccount | null> {
  const projectId = publicEnv.firebase.projectId;
  const emulator = authEmulatorHost();
  let url: string;
  let authorization: string;
  if (emulator) {
    url = `http://${emulator}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
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
    url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
    authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ localId: [uid] }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new AccountLookupError(`request failed (${error instanceof Error ? error.name : typeof error})`);
  }
  if (!response.ok) throw new AccountLookupError(`status ${response.status}`);
  const data = (await response.json().catch(() => null)) as LookupResponse | null;
  if (!data) throw new AccountLookupError("unreadable response");
  const user = data.users?.find((candidate) => candidate.localId === uid);
  if (!user) return null;
  return {
    uid,
    emailVerified: user.emailVerified === true,
    providers: (user.providerUserInfo ?? []).map((info) => info.providerId).filter((id): id is string => Boolean(id)),
    disabled: user.disabled === true,
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
