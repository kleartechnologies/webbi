import "server-only";
/**
 * Firebase Admin SDK (server only: route handlers and server actions).
 *
 * Credentials come from, in order:
 *   1. FIREBASE_SERVICE_ACCOUNT_BASE64 – base64 of the service-account JSON
 *      (what Netlify uses).
 *   2. Application Default Credentials – GOOGLE_APPLICATION_CREDENTIALS or the
 *      file written by `gcloud auth application-default login` (local dev).
 *
 * Against the local Firebase Emulator Suite (FIRESTORE_EMULATOR_HOST set,
 * never in production) no credentials are needed at all.
 *
 * If none of these apply the feature that needs Admin fails with
 * AdminNotConfiguredError, which routes turn into an honest 503.
 *
 * Only app, firestore and storage are imported. ID tokens are verified with
 * jose (src/lib/auth/verify.ts); firebase-admin/auth is not needed and it
 * pulls in jwks-rsa, whose CommonJS require() of the ESM-only jose v6 fails
 * in runtimes that disable require(esm) (Netlify's local function runner).
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { publicEnv, serverEnv } from "@/lib/env";

export class AdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_BASE64 " +
        "(see README) or run `gcloud auth application-default login` for local development.",
    );
    this.name = "AdminNotConfiguredError";
  }
}

function adcPath(): string {
  return join(homedir(), ".config", "gcloud", "application_default_credentials.json");
}

/** Local emulator: the Admin SDK talks to it without credentials. */
const EMULATOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST) && process.env.NODE_ENV !== "production";

export function isAdminConfigured(): boolean {
  return Boolean(
    EMULATOR ||
      serverEnv.firebaseServiceAccountBase64 ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      existsSync(adcPath()),
  );
}

let adminApp: App | undefined;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length) {
    adminApp = existing[0];
    return adminApp;
  }
  if (EMULATOR) {
    // No credential: the Firestore client talks to the emulator unauthenticated.
    // (Its one-off probe for Google credentials logs a MetadataLookupWarning and
    // costs a few seconds on the first request; harmless in local dev.)
    adminApp = initializeApp({
      projectId: publicEnv.firebase.projectId,
      storageBucket: publicEnv.firebase.storageBucket,
    });
    return adminApp;
  }
  const b64 = serverEnv.firebaseServiceAccountBase64;
  if (b64) {
    const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    adminApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
      projectId: serviceAccount.project_id ?? publicEnv.firebase.projectId,
      storageBucket: publicEnv.firebase.storageBucket,
    });
    return adminApp;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || existsSync(adcPath())) {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: publicEnv.firebase.projectId,
      storageBucket: publicEnv.firebase.storageBucket,
    });
    return adminApp;
  }
  throw new AdminNotConfiguredError();
}

/**
 * Marker on the Firestore instance itself, not a module variable: dev hot
 * reload re-evaluates this module while firebase-admin keeps the already
 * configured instance, and settings() throws when called a second time.
 */
const DB_CONFIGURED = Symbol.for("webbi.adminDb.configured");
type MarkedFirestore = Firestore & { [DB_CONFIGURED]?: true };

export function adminDb(): Firestore {
  const db = getFirestore(getAdminApp()) as MarkedFirestore;
  if (!db[DB_CONFIGURED]) {
    try {
      // Site content has many optional fields; drop `undefined` instead of throwing.
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Already in use (hot reload); the earlier settings call still applies.
    }
    db[DB_CONFIGURED] = true;
  }
  return db;
}

export function adminStorage() {
  return getStorage(getAdminApp());
}
