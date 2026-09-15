"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Wordmark } from "@/components/ui";
import { signOutUser } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/sites", "Websites"],
  ["/admin/payments", "Payments"],
  ["/admin/ai", "AI usage"],
  ["/admin/moderation", "Moderation"],
  ["/admin/system", "System"],
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ email, children }: { email: string | null; children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-ground" data-admin-shell>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 pt-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Wordmark href="/admin" label="Webbi owner overview" />
            <span className="rounded-pill bg-navy-tint px-2.5 py-0.5 text-[12px] font-bold text-navy">Owner</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {email ? <span className="hidden truncate text-[13px] text-muted sm:inline">{email}</span> : null}
            <Button
              variant="ghost"
              size="sm"
              loading={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOutUser().catch(() => {});
                // A full load, so nothing from the panel stays in memory.
                window.location.replace("/");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
        <nav aria-label="Owner sections" className="mx-auto w-full max-w-[1200px] overflow-x-auto px-4 sm:px-8">
          <ul className="flex gap-1 py-2">
            {NAV.map(([href, label]) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block whitespace-nowrap rounded-pill px-3 py-1.5 text-[13px] font-semibold",
                      active ? "bg-ink text-white" : "text-ink hover:bg-navy-tint",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-1 flex-col gap-7 px-4 py-6 sm:px-8">{children}</main>
      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-6 text-[12px] text-muted sm:px-8">
        Read only. Times are Malaysia time.
      </footer>
    </div>
  );
}
