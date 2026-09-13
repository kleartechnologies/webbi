/**
 * Webbi authenticates before creation: "Create My Website" leads to the account
 * screen first and the creation flow second. These helpers carry that original
 * intent across the round trip through /signin, so nobody is dropped on the
 * dashboard having to find the button they already pressed.
 */

/** Which face of /signin to show: a new visitor signs up, a returning one signs in. */
export type AuthMode = "create" | "signin";

/** Where authentication lands when the visitor had no particular destination. */
export const DEFAULT_NEXT = "/dashboard";

/** The creation flow — what every "Create My Website" CTA means. */
export const CREATE_NEXT = "/start";

/** The origin a destination must stay on: the page's own, or the configured public address outside a browser. */
function currentOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Only a same-origin destination may be resumed after signing in, so a crafted
 * ?next= can never bounce someone off to another site. The value is resolved
 * the way the browser will resolve it: "//host", "/\host", "/\t/host" (browsers
 * drop tabs and newlines) and "/..//host" all name another origin in disguise.
 * An absolute URL on this origin is accepted and reduced to its path.
 */
export function safeNext(value: string | null | undefined, origin: string = currentOrigin()): string {
  if (!value) return DEFAULT_NEXT;
  if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) return DEFAULT_NEXT;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return DEFAULT_NEXT;
  let url: URL;
  let home: URL;
  try {
    home = new URL(origin);
    url = new URL(value, home);
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== home.origin) return DEFAULT_NEXT;
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("//") ? DEFAULT_NEXT : path;
}

/** The /signin URL that opens the right face and remembers where the visitor was going. */
export function authPath(next: string, mode: AuthMode = "signin"): string {
  const params = new URLSearchParams();
  if (mode === "create") params.set("mode", "create");
  params.set("next", next);
  return `/signin?${params.toString()}`;
}

/** The mode a ?mode= parameter asks for; anything unknown is a returning visitor. */
export function authMode(value: string | null | undefined): AuthMode {
  return value === "create" ? "create" : "signin";
}

/** True when the visitor set out to build a website, so the sign-up copy can say so. */
export function isCreateIntent(next: string): boolean {
  return next === CREATE_NEXT || next.startsWith(`${CREATE_NEXT}/`) || next.startsWith(`${CREATE_NEXT}?`);
}
