/**
 * Google sign-in under Webbi's own domain, the way Firebase documents it
 * (https://firebase.google.com/docs/auth/web/redirect-best-practices, option 3).
 *
 * Firebase Auth opens its sign-in handler at https://<authDomain>/__/auth/handler,
 * and that handler is the redirect URI Google sends the user back to, so Google's
 * account chooser says "to continue to <authDomain>". Firebase only serves the
 * handler on the project's own hosting domains, so the app proxies
 * /__/auth/* to https://<project>.firebaseapp.com/__/auth/* as a transparent
 * rewrite (never a redirect), which passes Firebase's response and headers
 * through unchanged. With the proxy live and
 * https://<site>/__/auth/handler added to the Google OAuth client, the site's
 * domain can be NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.
 *
 * The target comes from the project id, never from the auth domain, so the
 * proxy can't point back at itself. Kept free of "@/" imports so
 * next.config.ts can load it.
 */

/** Firebase's handler pages and scripts: handler, iframe, handler.js, iframe.js, experiments.js, callback. */
export const FIREBASE_AUTH_SOURCE = "/__/auth/:path+";

/** A Google Cloud project id: 6 to 30 lowercase letters, digits and hyphens, starting with a letter. */
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function firebaseAuthHandlerOrigin(projectId: string | undefined): string | null {
  const id = projectId?.trim();
  return id && PROJECT_ID.test(id) ? `https://${id}.firebaseapp.com` : null;
}

export interface Rewrite {
  source: string;
  destination: string;
}

/** For next.config.ts `rewrites().beforeFiles`. No valid project id, no proxy. */
export function firebaseAuthRewrites(projectId: string | undefined): Rewrite[] {
  const origin = firebaseAuthHandlerOrigin(projectId);
  return origin ? [{ source: FIREBASE_AUTH_SOURCE, destination: `${origin}/__/auth/:path+` }] : [];
}
