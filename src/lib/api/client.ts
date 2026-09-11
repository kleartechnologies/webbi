"use client";

import { getClientAuth } from "@/lib/firebase/client";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** POST JSON to a Webbi API route with the current Firebase user's ID token. */
export async function callApi<T>(path: string, body: unknown): Promise<T> {
  const user = getClientAuth().currentUser;
  if (!user) throw new ApiError("unauthenticated", "Sign in to continue.", 401);
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", "No connection. Check your internet and try again.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new ApiError(
      data.error?.code ?? "unknown",
      data.error?.message ?? "Something went wrong. Please try again.",
      response.status,
    );
  }
  return data as T;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
