"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

/**
 * - loading: Firebase hasn't reported yet (first paint)
 * - signed-out: nobody
 * - anonymous: a visitor building a draft before creating an account
 * - account: a real account (Google or email)
 */
export type AuthStatus = "loading" | "signed-out" | "anonymous" | "account";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
}

const AuthContext = createContext<AuthContextValue>({ user: null, status: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; ready: boolean; tick: number }>({
    user: null,
    ready: false,
    tick: 0,
  });

  useEffect(() => {
    // onIdTokenChanged (not onAuthStateChanged) so that linking an anonymous
    // user to Google/email — same uid, new token — re-renders consumers.
    return onIdTokenChanged(getClientAuth(), (user) => {
      setState({ user, ready: true, tick: Date.now() });
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const { user, ready } = state;
    const status: AuthStatus = !ready
      ? "loading"
      : !user
        ? "signed-out"
        : user.isAnonymous
          ? "anonymous"
          : "account";
    return { user, status };
    // `tick` is part of the deps on purpose: the User object is mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user, state.ready, state.tick]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
