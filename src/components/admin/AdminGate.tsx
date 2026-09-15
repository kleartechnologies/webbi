"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import NotFound from "@/app/not-found";
import { Button, Card, Spinner } from "@/components/ui";
import { adminRequest, type AdminSession } from "@/lib/admin/client";
import { ADMIN_MAX_SIGN_IN_AGE_SECONDS, ADMIN_PROVIDER, ADMIN_ROLE } from "@/lib/admin/policy";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { signOutUser } from "@/lib/auth/actions";
import { authPath } from "@/lib/auth/intent";
import { AdminShell } from "./AdminShell";

/**
 * Opens the panel only after GET /api/admin/session answers 200 for the
 * signed-in user. The page HTML itself carries no data and no panel markup;
 * anyone else sees the ordinary "Page not found". This is presentation only:
 * every admin API route authorizes each request on the server.
 */

type GateState = { kind: "allowed"; session: AdminSession } | { kind: "not_found" } | { kind: "sign_in_again" } | { kind: "error"; message: string };

const SessionContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession | null {
  return useContext(SessionContext);
}

/** Only for an account whose own token already says it is the owner: its Google sign-in is too old, or wasn't Google. */
async function ownerMustSignInAgain(user: User): Promise<boolean> {
  try {
    const { claims, signInProvider } = await user.getIdTokenResult();
    if (claims.webbiRole !== ADMIN_ROLE) return false;
    const authTime = Number(claims.auth_time);
    return signInProvider !== ADMIN_PROVIDER || !Number.isFinite(authTime) || Date.now() / 1000 - authTime > ADMIN_MAX_SIGN_IN_AGE_SECONDS;
  } catch {
    return false;
  }
}

async function openSession(user: User): Promise<GateState> {
  const attempt = async (forceRefresh: boolean): Promise<GateState | null> => {
    try {
      return { kind: "allowed", session: await adminRequest<AdminSession>("/api/admin/session", { forceRefresh }) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      return { kind: "error", message: errorMessage(error) };
    }
  };
  // A token minted before the role was granted doesn't carry it yet: refresh once.
  const state = (await attempt(false)) ?? (await attempt(true));
  if (state) return state;
  return (await ownerMustSignInAgain(user)) ? { kind: "sign_in_again" } : { kind: "not_found" };
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const uid = user?.uid ?? null;
  const [result, setResult] = useState<{ uid: string; nonce: number; state: GateState } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (status === "signed-out") router.replace(authPath(pathname));
  }, [status, pathname, router]);

  useEffect(() => {
    if (!uid || !user) return;
    let cancelled = false;
    openSession(user).then((state) => {
      if (!cancelled) setResult({ uid, nonce, state });
    });
    return () => {
      cancelled = true;
    };
    // `user` is the same account while uid is unchanged (Firebase mutates it in place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, nonce]);

  const state = uid && result?.uid === uid && result.nonce === nonce ? result.state : null;

  if (!state) {
    return (
      <main className="flex flex-1 items-center justify-center py-16 text-navy" aria-busy="true">
        <Spinner size={28} />
      </main>
    );
  }
  if (state.kind === "not_found") return <NotFound />;
  if (state.kind === "sign_in_again") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="flex max-w-[420px] flex-col gap-4 p-6 text-center">
          <h1 className="text-h2">Sign in again</h1>
          <p className="text-[14px] text-muted">For security, sign in again with Google to continue.</p>
          <Button
            onClick={async () => {
              await signOutUser().catch(() => {});
              window.location.assign(authPath(pathname));
            }}
          >
            Sign in with Google
          </Button>
        </Card>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
          <p className="text-[15px] font-semibold text-danger" role="alert">
            {state.message}
          </p>
          <Button variant="secondary" size="md" onClick={() => setNonce((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </main>
    );
  }
  return (
    <SessionContext.Provider value={state.session}>
      <AdminShell email={state.session.email}>{children}</AdminShell>
    </SessionContext.Provider>
  );
}
