/**
 * Auth actions (browser only). Webbi is anonymous-first: a visitor gets an
 * anonymous Firebase user when they start building, and turns it into a real
 * account (Google or email) when they are ready to publish — keeping the draft
 * they already built.
 */
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import { authErrorCode } from "./errors";

/**
 * When an anonymous visitor signs in to an account that already exists, the
 * anonymous user (and everything it owns) becomes unreachable. A handoff
 * captures what matters before the switch and restores it for the new uid.
 */
export interface Handoff<T> {
  capture: () => Promise<T>;
  restore: (captured: T, uid: string) => Promise<void>;
}

export interface AuthResult {
  user: User;
  /** True when we signed in to a different, pre-existing account. */
  switched: boolean;
}

export async function ensureUser(): Promise<User> {
  const auth = getClientAuth();
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function continueWithGoogle<T>(handoff?: Handoff<T>): Promise<AuthResult> {
  const auth = getClientAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const current = auth.currentUser;

  if (current?.isAnonymous) {
    try {
      const linked = await linkWithPopup(current, provider);
      await upsertUserDoc(linked.user);
      return { user: linked.user, switched: false };
    } catch (error) {
      if (authErrorCode(error) !== "auth/credential-already-in-use") throw error;
      const credential = GoogleAuthProvider.credentialFromError(error as never);
      if (!credential) throw error;
      const captured = handoff ? await handoff.capture() : undefined;
      const signedIn = await signInWithCredential(auth, credential);
      if (handoff) await handoff.restore(captured as T, signedIn.user.uid);
      await upsertUserDoc(signedIn.user);
      return { user: signedIn.user, switched: true };
    }
  }

  const result = await signInWithPopup(auth, provider);
  await upsertUserDoc(result.user);
  return { user: result.user, switched: false };
}

export async function createWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const auth = getClientAuth();
  const credential = EmailAuthProvider.credential(input.email.trim(), input.password);
  const current = auth.currentUser;
  let user: User;
  if (current?.isAnonymous) {
    user = (await linkWithCredential(current, credential)).user;
  } else {
    // No anonymous session (e.g. arrived at /signin directly).
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    user = (await createUserWithEmailAndPassword(auth, input.email.trim(), input.password)).user;
  }
  const name = input.name.trim();
  if (name) await updateProfile(user, { displayName: name });
  await upsertUserDoc(user);
  return { user, switched: false };
}

export async function signInWithEmail<T>(
  input: { email: string; password: string },
  handoff?: Handoff<T>,
): Promise<AuthResult> {
  const auth = getClientAuth();
  const wasAnonymous = Boolean(auth.currentUser?.isAnonymous);
  const captured = wasAnonymous && handoff ? await handoff.capture() : undefined;
  const result = await signInWithEmailAndPassword(auth, input.email.trim(), input.password);
  if (wasAnonymous && handoff) await handoff.restore(captured as T, result.user.uid);
  await upsertUserDoc(result.user);
  return { user: result.user, switched: wasAnonymous };
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getClientAuth(), email.trim());
}

export async function signOutUser(): Promise<void> {
  await signOut(getClientAuth());
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
