/**
 * Auth actions (browser only). Webbi is account-first: a visitor creates their
 * account (Google or email) before they start building, so every draft has a
 * real owner. There are no guest (anonymous) sessions; the Anonymous provider
 * is switched off in the Firebase Console.
 *
 * Email/password accounts are sent Firebase's verification link when they sign
 * up. They can build and preview straight away; publishing waits for the
 * address to be verified (src/lib/auth/publishing.ts, enforced on the server).
 */
import {
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import { normalizeEmail } from "./email";
import { authErrorCode } from "./errors";
import { GOOGLE_PROVIDER } from "./publishing";

export interface AuthResult {
  user: User;
}

export async function continueWithGoogle(): Promise<AuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(getClientAuth(), provider);
  await upsertUserDoc(result.user);
  return { user: result.user };
}

export async function createWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const auth = getClientAuth();
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  const user = (await createUserWithEmailAndPassword(auth, normalizeEmail(input.email), input.password)).user;
  const name = input.name.trim();
  if (name) await updateProfile(user, { displayName: name });
  // Best-effort: the account exists either way, and the Publish screen can resend.
  await sendVerification(user).catch((error) => console.warn("verification email not sent", authErrorCode(error)));
  await upsertUserDoc(user);
  return { user };
}

export async function signInWithEmail(input: { email: string; password: string }): Promise<AuthResult> {
  const result = await signInWithEmailAndPassword(getClientAuth(), normalizeEmail(input.email), input.password);
  await upsertUserDoc(result.user);
  return { user: result.user };
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getClientAuth(), normalizeEmail(email));
}

export async function signOutUser(): Promise<void> {
  await signOut(getClientAuth());
}

/** True for an email/password account whose address isn't verified yet. Google accounts never need it. */
export function needsEmailVerification(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous || user.emailVerified) return false;
  return !user.providerData.some((profile) => profile.providerId === GOOGLE_PROVIDER);
}

/** Sends the verification link again. Firebase rate-limits this too (auth/too-many-requests). */
export async function resendVerification(): Promise<void> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in to continue.");
  await sendVerification(user);
}

/**
 * After the owner clicks the link (often in another tab or app): reloads the
 * account and forces a new ID token, so both this page and the server see
 * email_verified. Returns whether the address is now verified.
 */
export async function refreshVerification(): Promise<boolean> {
  const user = getClientAuth().currentUser;
  if (!user) return false;
  await user.reload();
  // A fresh token carries email_verified; onIdTokenChanged then re-renders the app.
  await user.getIdToken(true);
  return getClientAuth().currentUser?.emailVerified === true;
}

async function sendVerification(user: User): Promise<void> {
  try {
    // The link comes back to the dashboard, where the owner carries on.
    await sendEmailVerification(user, { url: `${window.location.origin}/dashboard` });
  } catch (error) {
    // This address isn't an authorized domain (a preview deploy): Firebase's own page instead.
    if (authErrorCode(error) !== "auth/unauthorized-continue-uri") throw error;
    await sendEmailVerification(user);
  }
}

/** users/{uid} — profile mirror used by the dashboard greeting. */
async function upsertUserDoc(user: User): Promise<void> {
  if (user.isAnonymous) return;
  const ref = doc(getClientDb(), "users", user.uid);
  const profile = {
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    updatedAt: serverTimestamp(),
  };
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, profile);
    else await setDoc(ref, { ...profile, locale: "en", createdAt: serverTimestamp() });
  } catch (error) {
    // Profile mirror is best-effort; never block sign-in on it.
    console.warn("users/{uid} upsert failed", error);
  }
}
