import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { publicEnv } from "@/lib/env";

/**
 * Firebase App Check on Webbi's own API routes (server only).
 *
 * The browser attests with reCAPTCHA Enterprise (invisible, no challenge wall)
 * and sends the resulting App Check token as X-Firebase-AppCheck
 * (src/lib/firebase/appCheck.ts). Here the token is verified with jose against
 * App Check's public keys, like ID tokens in src/lib/auth/verify.ts;
 * firebase-admin/app-check is avoided for the same jwks-rsa reason.
 *
 * APP_CHECK_MODE decides what happens to a request without a valid token:
 *   off     (default) nothing is checked: local development, tests, emulators.
 *   monitor verified and logged, never refused: roll out here first and watch
 *           the logs until real traffic carries valid tokens.
 *   enforce refused with 401 app_check_failed.
 *
 * App Check raises the cost of scripted abuse; it doesn't replace sign-in,
 * ownership checks, quotas or rate limits, which all still apply.
 */

export const APP_CHECK_HEADER = "x-firebase-appcheck";

export type AppCheckMode = "off" | "monitor" | "enforce";

export class AppCheckError extends Error {
  constructor() {
    super("We couldn't verify this browser. Refresh the page and try again.");
    this.name = "AppCheckError";
  }
}

export function appCheckMode(): AppCheckMode {
  const value = process.env.APP_CHECK_MODE?.trim().toLowerCase();
  return value === "monitor" || value === "enforce" ? value : "off";
}

/** The Firebase project number: the messaging sender id, or the middle of the web app id ("1:<number>:web:…"). */
export function projectNumber(): string | null {
  const sender = publicEnv.firebase.messagingSenderId.trim();
  if (/^\d+$/.test(sender)) return sender;
  const fromAppId = publicEnv.firebase.appId.split(":")[1];
  return fromAppId && /^\d+$/.test(fromAppId) ? fromAppId : null;
}

const JWKS = createRemoteJWKSet(new URL("https://firebaseappcheck.googleapis.com/v1/jwks"));

/** Resolves with the attested app id, or throws AppCheckError. */
export async function verifyAppCheckToken(token: string): Promise<{ appId: string }> {
  const number = projectNumber();
  if (!token || !number) throw new AppCheckError();
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://firebaseappcheck.googleapis.com/${number}`,
      audience: `projects/${number}`,
      algorithms: ["RS256"],
    });
    // The token must be for this web app, not another app in the same project.
    if (payload.sub !== publicEnv.firebase.appId) throw new Error("wrong app");
    return { appId: payload.sub };
  } catch {
    throw new AppCheckError();
  }
}

/**
 * Checks the request's App Check token according to APP_CHECK_MODE. `route`
 * only labels the log line. Call after requireUser so an anonymous caller gets
 * the sign-in error first.
 */
export async function requireAppCheck(request: Request, route: string): Promise<void> {
  const mode = appCheckMode();
  if (mode === "off") return;
  const token = request.headers.get(APP_CHECK_HEADER)?.trim() ?? "";
  try {
    await verifyAppCheckToken(token);
  } catch (error) {
    if (!(error instanceof AppCheckError)) throw error;
    const reason = !token ? "missing" : projectNumber() ? "invalid" : "project_number_unknown";
    if (mode === "monitor") {
      console.warn("[app-check] would refuse", { route, reason });
      return;
    }
    console.warn("[app-check] refused", { route, reason });
    throw error;
  }
}
