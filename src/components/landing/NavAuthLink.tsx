"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLandingCopy } from "./i18n/LandingLanguage";

/** "Sign in" for visitors, "Dashboard" once they have an account. */
export function NavAuthLink({
  className = "flex h-[42px] items-center rounded-pill px-4 text-[15px] font-semibold text-ink transition-colors hover:bg-ground",
}: {
  className?: string;
}) {
  const { status } = useAuth();
  const copy = useLandingCopy();
  const account = status === "account";
  return (
    <Link href={account ? "/dashboard" : "/signin"} className={className}>
      {account ? copy.nav.dashboard : copy.nav.signIn}
    </Link>
  );
}
