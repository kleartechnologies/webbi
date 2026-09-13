"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { useAuth, type AuthStatus } from "@/lib/auth/AuthProvider";
import { authPath, type AuthMode } from "@/lib/auth/intent";

/**
 * Gate for app screens. `allow` lists the statuses that may see the children;
 * anyone else is sent to /signin and back here afterwards. `authMode` picks the
 * face they land on: a screen a new visitor reaches first (the creation flow)
 * asks them to sign up, everything else asks them to sign in.
 */
export function RequireAuth({
  allow = ["account"],
  authMode = "signin",
  children,
}: {
  allow?: AuthStatus[];
  authMode?: AuthMode;
  children: ReactNode;
}) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = status !== "loading" && allow.includes(status);

  useEffect(() => {
    if (status === "loading" || allowed) return;
    router.replace(authPath(pathname, authMode));
  }, [status, allowed, pathname, authMode, router]);

  if (!allowed) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-navy">
        <Spinner size={28} />
      </div>
    );
  }
  return <>{children}</>;
}
