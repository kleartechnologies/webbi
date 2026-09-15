"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api/client";
import { appCheckHeaders } from "@/lib/firebase/appCheck";
import { getClientAuth } from "@/lib/firebase/client";

/**
 * The admin panel's only way to data: its own API, with the signed-in user's
 * ID token and App Check token on every request. Nothing is cached in the
 * browser and no Firestore query is made from here.
 */

export interface AdminSession {
  uid: string;
  email: string | null;
  /** When the Google sign-in stops being accepted, ISO. */
  signInExpiresAt: string;
}

export async function adminRequest<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; forceRefresh?: boolean } = {},
): Promise<T> {
  const user = getClientAuth().currentUser;
  if (!user) throw new ApiError("unauthenticated", "Sign in to continue.", 401);
  const [token, appCheck] = await Promise.all([user.getIdToken(init.forceRefresh === true), appCheckHeaders()]);
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...appCheck,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", "No connection. Check your internet and try again.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string } & Record<string, unknown>;
  };
  if (!response.ok) {
    const { code, message, ...details } = data.error ?? {};
    throw new ApiError(code ?? "unknown", message ?? "Something went wrong. Please try again.", response.status, details);
  }
  return data as T;
}

/** GETs `path` (null: nothing yet) and reloads on demand. */
export function useAdminData<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${nonce}:${path}` : null;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!key || !path) return;
    let cancelled = false;
    adminRequest<T>(path).then(
      (data) => {
        if (!cancelled) setResult({ key, data, error: null });
      },
      (error) => {
        if (!cancelled) setResult({ key, data: null, error: errorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, path]);

  const current = result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: key !== null && current === null,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}
