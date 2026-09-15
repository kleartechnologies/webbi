import "server-only";
import { lookupAccount, type AuthAccount } from "@/lib/auth/accounts";
import { verifyIdToken, type VerifiedUser } from "@/lib/auth/verify";
import { AdminNotConfiguredError } from "@/lib/firebase/admin";
import { AppCheckError, requireAppCheck } from "@/lib/security/appCheck";
import { recordAdminDenied, type AdminDenyReason } from "./audit";
import { AdminNotFoundError, AdminUnavailableError } from "./errors";
import { adminPanelEnabled, isAdminHost } from "./hosts";
import { ADMIN_MAX_SIGN_IN_AGE_SECONDS, ADMIN_PROVIDER, ADMIN_ROLE } from "./policy";

/**
 * The only authorization for Webbi's admin panel, called by every admin API
 * route itself (never trusted to the proxy, the page, or the browser).
 *
 * The owner is the account holding the custom claim webbiRole: "owner", which
 * only scripts/ops/admin-role.mjs can grant. No email list, cookie, local
 * storage or Firestore document grants anything.
 *
 * In order:
 *  1. the panel is enabled and the request came to an admin host
 *  2. a Bearer ID token, verified by signature, issuer, audience and expiry
 *  3. the token's webbiRole is "owner", its email is verified, it came from a
 *     Google sign-in, and that sign-in is recent (ADMIN_MAX_SIGN_IN_AGE_SECONDS)
 *  4. App Check, according to APP_CHECK_MODE
 *  5. Firebase Auth itself, right now: the account exists, isn't disabled,
 *     still holds the role, still has Google linked and a verified email, and
 *     its sessions haven't been revoked since this sign-in
 *
 * Every refusal is the same 404 as a missing page. Refusals after the token is
 * verified are recorded (src/lib/admin/audit.ts).
 */

export { ADMIN_MAX_SIGN_IN_AGE_SECONDS, ADMIN_PROVIDER, ADMIN_ROLE };
/** Clock skew allowed for a sign-in time slightly in the future. */
const CLOCK_SKEW_SECONDS = 300;

export interface AdminUser {
  uid: string;
  email: string | null;
  /** Seconds. */
  authTime: number;
}

/** The host the request was made to. Never X-Forwarded-Host, which a client can set. */
export function requestHost(request: Request): string | null {
  const header = request.headers.get("host");
  if (header) return header;
  try {
    return new URL(request.url).host;
  } catch {
    return null;
  }
}

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Why the token alone disqualifies the caller, or null. */
export function tokenDenyReason(user: VerifiedUser, nowSeconds: number): AdminDenyReason | null {
  if (user.role !== ADMIN_ROLE) return "no_role";
  if (user.emailVerified !== true) return "email_unverified";
  if (user.signInProvider !== ADMIN_PROVIDER) return "provider";
  const authTime = user.authTime;
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) return "stale_sign_in";
  if (authTime > nowSeconds + CLOCK_SKEW_SECONDS || nowSeconds - authTime > ADMIN_MAX_SIGN_IN_AGE_SECONDS) return "stale_sign_in";
  return null;
}

/** Why Firebase Auth's current record disqualifies the caller, or null. */
export function accountDenyReason(account: AuthAccount | null, authTime: number): AdminDenyReason | null {
  if (!account) return "account_missing";
  if (account.disabled) return "account_disabled";
  if (account.role !== ADMIN_ROLE) return "role_revoked";
  if (account.validSince !== null && authTime < account.validSince) return "session_revoked";
  if (!account.emailVerified) return "email_unverified";
  if (!account.providers.includes(ADMIN_PROVIDER)) return "provider";
  return null;
}

export async function requireAdmin(request: Request, route: string): Promise<AdminUser> {
  if (!adminPanelEnabled() || !isAdminHost(requestHost(request))) throw new AdminNotFoundError();

  const token = bearer(request);
  if (!token) throw new AdminNotFoundError();
  let user: VerifiedUser;
  try {
    user = await verifyIdToken(token);
  } catch {
    throw new AdminNotFoundError();
  }

  const deny = async (reason: AdminDenyReason) => {
    await recordAdminDenied(user.uid, reason, route);
    return new AdminNotFoundError();
  };

  const tokenReason = tokenDenyReason(user, Math.floor(Date.now() / 1000));
  if (tokenReason) throw await deny(tokenReason);
  const authTime = user.authTime as number;

  try {
    await requireAppCheck(request, `admin.${route}`);
  } catch (error) {
    if (error instanceof AppCheckError) throw await deny("app_check");
    throw error;
  }

  let account: AuthAccount | null;
  try {
    account = await lookupAccount(user.uid);
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) throw error;
    console.error("[admin] couldn't check the account with Firebase Auth", {
      route,
      error: error instanceof Error ? error.message : typeof error,
    });
    throw new AdminUnavailableError();
  }
  const accountReason = accountDenyReason(account, authTime);
  if (accountReason) throw await deny(accountReason);

  return { uid: user.uid, email: user.email ?? null, authTime };
}
