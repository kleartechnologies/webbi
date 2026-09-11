"use client";

import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AccountMenu } from "./AccountMenu";

/** Top bar for signed-in app screens: wordmark left, account bubble right. */
export function AppHeader() {
  const { status } = useAuth();
  return (
    <header className="flex items-center justify-between px-5 pt-3 sm:pt-5">
      <Wordmark href="/dashboard" size={22} />
      {status === "account" ? (
        <AccountMenu />
      ) : status === "loading" ? (
        <span className="h-10 w-10 rounded-full bg-navy-tint" aria-hidden />
      ) : (
        <Link
          href="/signin"
          className="flex h-10 items-center rounded-pill px-[14px] text-[14px] font-semibold text-ink hover:bg-[#EDEBE5]"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}

/** Phone-width column used by every app screen (design frames are 402px). */
export function AppPage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`mx-auto flex w-full max-w-[560px] flex-1 flex-col ${className}`}>{children}</main>
  );
}
