import { FirebaseError } from "firebase/app";

/** Human-readable copy for the Firebase Auth errors a user can actually hit. */
export function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/missing-password":
    case "auth/weak-password":
      return "Use a password with at least 8 characters.";
    case "auth/email-already-in-use":
      return "This email already has a Webbi account. Sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google window was closed before finishing. Try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups and try again.";
    case "auth/account-exists-with-different-credential":
      return "This email is already used with a different sign-in method.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
    case "auth/admin-restricted-operation":
      return "Sign-in isn't available yet. Please try again later.";
    case "auth/unauthorized-domain":
      return "Sign-in isn't enabled for this website address yet.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function authErrorCode(error: unknown): string {
  return error instanceof FirebaseError ? error.code : "";
}
