import "server-only";
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { publicEnv } from "@/lib/env";

/**
 * Verifies a Firebase ID token with Google's public keys — no service account
 * needed. Used by API routes that only need to know *who* is calling.
 */
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export interface VerifiedUser {
  uid: string;
  isAnonymous: boolean;
  email?: string;
  /** Display name from the sign-in, when there is one. Used to address the payment bill. */
  name?: string;
  /**
   * Firebase's signed email_verified claim. Missing counts as not verified, so
   * a caller built without it can never publish (src/lib/auth/publishing.ts).
   */
  emailVerified?: boolean;
  /** Sign-in providers linked to the account when the token was issued ("password", "google.com"). */
  providers?: string[];
}

export class UnauthorizedError extends Error {
  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

interface FirebaseClaims extends JWTPayload {
  firebase?: { sign_in_provider?: string; identities?: Record<string, unknown> };
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/** Every provider on the account: the one used for this sign-in plus the linked identities. */
function tokenProviders(claims: FirebaseClaims): string[] {
  const providers = new Set<string>();
  const signIn = claims.firebase?.sign_in_provider;
  if (typeof signIn === "string") providers.add(signIn);
  const identities = claims.firebase?.identities;
  if (identities && typeof identities === "object") {
    for (const key of Object.keys(identities)) providers.add(key === "email" ? "password" : key);
  }
  return [...providers];
}

/** Emulator tokens are unsigned; accept them only in local development. */
const EMULATOR = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) && process.env.NODE_ENV !== "production";

export async function verifyIdToken(token: string): Promise<VerifiedUser> {
  const projectId = publicEnv.firebase.projectId;
  let payload: FirebaseClaims;
  try {
    if (EMULATOR) {
      payload = decodeJwt<FirebaseClaims>(token);
      if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("bad claims");
      if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("expired");
    } else {
      ({ payload } = await jwtVerify<FirebaseClaims>(token, JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        algorithms: ["RS256"],
      }));
    }
  } catch {
    throw new UnauthorizedError("Your session has expired. Please sign in again.");
  }
  if (!payload.sub) throw new UnauthorizedError();
  return {
    uid: payload.sub,
    isAnonymous: payload.firebase?.sign_in_provider === "anonymous",
    email: payload.email,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : undefined,
    emailVerified: payload.email_verified === true,
    providers: tokenProviders(payload),
  };
}

export async function requireUser(request: Request): Promise<VerifiedUser> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new UnauthorizedError();
  return verifyIdToken(token);
}
