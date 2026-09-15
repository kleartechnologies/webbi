/**
 * Firebase App Check in the browser (reCAPTCHA Enterprise, invisible: there is
 * no challenge for the visitor to solve). Its token goes to Webbi's own API
 * routes as X-Firebase-AppCheck, where src/lib/security/appCheck.ts checks it
 * according to APP_CHECK_MODE.
 *
 * Off unless NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is set, and never against
 * the emulators. A debug token (NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN,
 * registered in the Firebase Console) is honoured outside production builds
 * only, so local development and QA can still get a valid token.
 *
 * Getting a token never blocks a request: without one the header is left off
 * and the server decides (off and monitor let it through).
 */
import type { AppCheck } from "firebase/app-check";
import { getFirebaseApp } from "./client";

const SITE_KEY = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY?.trim() ?? "";
const DEBUG_TOKEN = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim() ?? "";
const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" && process.env.NODE_ENV !== "production";

/** Must match APP_CHECK_HEADER on the server. */
export const APP_CHECK_HEADER = "X-Firebase-AppCheck";

let started: Promise<AppCheck | null> | undefined;

export function appCheckEnabled(): boolean {
  return typeof window !== "undefined" && Boolean(SITE_KEY) && !USE_EMULATOR;
}

function startAppCheck(): Promise<AppCheck | null> {
  if (!appCheckEnabled()) return Promise.resolve(null);
  started ??= (async () => {
    try {
      if (DEBUG_TOKEN && process.env.NODE_ENV !== "production") {
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN;
      }
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import("firebase/app-check");
      return initializeAppCheck(getFirebaseApp(), {
        provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.warn("App Check didn't start", error);
      return null;
    }
  })();
  return started;
}

/** The App Check header for a Webbi API request, or nothing when App Check is off or no token could be had. */
export async function appCheckHeaders(): Promise<Record<string, string>> {
  const appCheck = await startAppCheck();
  if (!appCheck) return {};
  try {
    const { getToken } = await import("firebase/app-check");
    const { token } = await getToken(appCheck, false);
    return token ? { [APP_CHECK_HEADER]: token } : {};
  } catch {
    return {};
  }
}
