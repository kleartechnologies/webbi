/**
 * Firebase web SDK (browser). Everything here runs under the security rules in
 * firestore.rules / storage.rules. Import only from client components.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { publicEnv } from "@/lib/env";

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

/** Local development against the Firebase Emulator Suite (never in production builds). */
const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" && process.env.NODE_ENV !== "production";
const EMULATOR_HOST = "127.0.0.1";

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const existing = getApps();
  app = existing.length ? existing[0] : initializeApp(publicEnv.firebase);
  return app;
}

export function getClientAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  if (USE_EMULATOR) connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  return auth;
}

export function getClientDb(): Firestore {
  if (db) return db;
  const firebaseApp = getFirebaseApp();
  try {
    // Site content has many optional fields; drop `undefined` instead of throwing.
    db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(firebaseApp);
  }
  if (USE_EMULATOR) connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (storage) return storage;
  storage = getStorage(getFirebaseApp());
  if (USE_EMULATOR) connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  return storage;
}
