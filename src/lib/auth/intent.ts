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

/**
 * Only a same-origin path may be resumed after signing in, so a crafted ?next=
 * can never bounce someone off to another site. A leading "//" or "/\" is a
 * protocol-relative URL in disguise.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT;
  return value;
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
