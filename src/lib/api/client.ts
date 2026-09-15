"use client";

import type { User } from "firebase/auth";
import { appCheckHeaders } from "@/lib/firebase/appCheck";
import { getClientAuth } from "@/lib/firebase/client";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    /** Anything else the route put on the error, e.g. existingSiteId on a 409 from /api/sites. */
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The user's ID token, refreshed when it is behind the account: Firebase
 * reloads the user when a page opens (so `emailVerified` turns true right
 * after the link is clicked) but keeps the cached token, whose
 * `email_verified` claim is what the server checks before publishing.
 */
async function freshIdToken(user: User): Promise<string> {
  if (!user.emailVerified) return user.getIdToken();
  const result = await user.getIdTokenResult();
  return result.claims.email_verified === true ? result.token : user.getIdToken(true);
}

/** POST JSON to a Webbi API route with the current Firebase user's ID token. */
export async function callApi<T>(path: string, body: unknown): Promise<T> {
  const user = getClientAuth().currentUser;
  if (!user) throw new ApiError("unauthenticated", "Sign in to continue.", 401);
  const [token, appCheck] = await Promise.all([freshIdToken(user), appCheckHeaders()]);
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...appCheck },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", "No connection. Check your internet and try again.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string } & Record<string, unknown>;
  };
  if (!response.ok) {
    const { code, message, ...details } = data.error ?? {};
    throw new ApiError(
      code ?? "unknown",
      message ?? "Something went wrong. Please try again.",
      response.status,
      details,
    );
  }
  return data as T;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
