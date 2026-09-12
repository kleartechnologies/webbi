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
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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

export function adminAuth() {
  return getAuth(getAdminApp());
}

let dbConfigured = false;

export function adminDb() {
  const db = getFirestore(getAdminApp());
  if (!dbConfigured) {
    // Site content has many optional fields; drop `undefined` instead of throwing.
    db.settings({ ignoreUndefinedProperties: true });
    dbConfigured = true;
  }
  return db;
}

export function adminStorage() {
  return getStorage(getAdminApp());
}

export class UnauthorizedError extends Error {
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Verify the Firebase ID token sent as `Authorization: Bearer <token>`. */
export async function requireUser(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new UnauthorizedError();
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    throw new UnauthorizedError("Your session has expired. Please sign in again.");
  }
}
