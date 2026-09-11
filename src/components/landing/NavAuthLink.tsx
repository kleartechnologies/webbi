"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

/** "Sign in" for visitors, "Dashboard" once they have an account. */
export function NavAuthLink() {
  const { status } = useAuth();
  const account = status === "account";
  return (
    <Link
      href={account ? "/dashboard" : "/signin"}
      className="flex h-[42px] items-center rounded-pill px-[14px] text-[14px] font-semibold text-ink transition-colors hover:bg-[#EDEBE5]"
    >
      {account ? "Dashboard" : "Sign in"}
    </Link>
  );
}
