"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { useAuth, type AuthStatus } from "@/lib/auth/AuthProvider";

/**
 * Gate for app screens. `allow` lists the statuses that may see the children;
 * anyone else is sent to /signin (and back here afterwards).
 */
export function RequireAuth({
  allow = ["account"],
  children,
}: {
  allow?: AuthStatus[];
  children: ReactNode;
}) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = status !== "loading" && allow.includes(status);

  useEffect(() => {
    if (status === "loading" || allowed) return;
    router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [status, allowed, pathname, router]);

  if (!allowed) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-navy">
        <Spinner size={28} />
      </div>
    );
  }
  return <>{children}</>;
}
