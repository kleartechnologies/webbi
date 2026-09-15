"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { needsEmailVerification } from "./actions";

/**
 * - loading: Firebase hasn't reported yet (first paint)
 * - signed-out: nobody. A leftover guest (anonymous) session from before
 *   Webbi became account-first counts as signed out: it can't build or publish.
 * - account: a real account (Google or email)
 */
export type AuthStatus = "loading" | "signed-out" | "account";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** An email/password account whose address isn't verified yet: it can build and preview, not publish. */
  needsVerification: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, status: "loading", needsVerification: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; ready: boolean; tick: number }>({
    user: null,
    ready: false,
    tick: 0,
  });

  useEffect(() => {
    // onIdTokenChanged (not onAuthStateChanged) so that a refreshed token (for
    // example after the email is verified) re-renders consumers.
    return onIdTokenChanged(getClientAuth(), (user) => {
      setState({ user, ready: true, tick: Date.now() });
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const { ready } = state;
    const user = state.user && !state.user.isAnonymous ? state.user : null;
    const status: AuthStatus = !ready ? "loading" : user ? "account" : "signed-out";
    return { user, status, needsVerification: needsEmailVerification(user) };
    // `tick` is part of the deps on purpose: the User object is mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user, state.ready, state.tick]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
