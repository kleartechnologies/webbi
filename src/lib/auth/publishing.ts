/**
 * Who may publish: the one rule, shared by the server (which enforces it) and
 * the browser (which only explains it). No Firebase import.
 *
 * Email/password accounts must have verified their address with Firebase's
 * verification link. Google accounts are verified by Google, so a Google
 * sign-in on the account is enough. Anything else (a legacy anonymous user, an
 * unknown account) may not publish.
 */

export interface AccountIdentity {
  /** Firebase's email_verified, from a signed ID token or the Auth record itself. */
  emailVerified?: boolean;
  /** Sign-in providers on the account: "password", "google.com", … */
  providers?: readonly string[];
}

export const GOOGLE_PROVIDER = "google.com";

export const VERIFY_EMAIL_MESSAGE = "Please verify your email before publishing your website.";

export function mayPublish(account: AccountIdentity | null | undefined): boolean {
  if (!account) return false;
  if (account.emailVerified === true) return true;
  return Boolean(account.providers?.includes(GOOGLE_PROVIDER));
}

/** 403 email_unverified (src/lib/api/http.ts): the caller may build and preview, not publish. */
export class EmailUnverifiedError extends Error {
  constructor() {
    super(VERIFY_EMAIL_MESSAGE);
    this.name = "EmailUnverifiedError";
  }
}

/** Throws unless the (already token-verified) caller may publish. Anonymous sessions never may. */
export function assertMayPublish(user: AccountIdentity & { isAnonymous?: boolean }): void {
  if (user.isAnonymous || !mayPublish(user)) throw new EmailUnverifiedError();
}
