/**
 * The owner policy, shared by the server guard (src/lib/admin/auth.ts) and the
 * browser gate, which only uses it to tell the owner to sign in again. The
 * browser never decides access: the API does, on every request.
 */

export const ADMIN_ROLE = "owner";
export const ADMIN_PROVIDER = "google.com";
/** How long ago the owner may have signed in with Google. Refreshed tokens keep the original sign-in time. */
export const ADMIN_MAX_SIGN_IN_AGE_SECONDS = 12 * 60 * 60;
