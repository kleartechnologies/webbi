"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { signOutUser } from "@/lib/auth/actions";
import { initials } from "@/lib/format";

export function AccountMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const label = user.displayName || user.email || "Account";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-tint text-[14px] font-extrabold text-navy hover:bg-[#E2E5F5]"
      >
        {initials(user.displayName || user.email)}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 w-64 overflow-hidden rounded-card border border-line bg-surface shadow-floating"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-[14px] font-bold text-ink">{label}</p>
            {user.email && user.displayName ? (
              <p className="truncate text-[12px] text-muted">{user.email}</p>
            ) : null}
          </div>
          <Link
            role="menuitem"
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-ink hover:bg-ground"
          >
            <Icon name="dashboard" size={20} className="text-navy" />
            Dashboard
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOutUser();
              router.push("/");
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-semibold text-ink hover:bg-ground"
          >
            <Icon name="logout" size={20} className="text-navy" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
