/**
 * Firebase web SDK (browser). Everything here runs under the security rules in
 * firestore.rules / storage.rules. Import only from client components.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { publicEnv } from "@/lib/env";

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const existing = getApps();
  app = existing.length ? existing[0] : initializeApp(publicEnv.firebase);
  return app;
}

export function getClientAuth(): Auth {
  return getAuth(getFirebaseApp());
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
  return db;
}

export function getClientStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
