"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader, AppPage } from "@/components/app/AppHeader";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteCard } from "@/components/app/SiteCard";
import { Icon, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PRICE_LABEL } from "@/lib/env";
import { firstName, greeting } from "@/lib/format";
import { subscribeUserSites } from "@/lib/site/store";
import type { Site } from "@/lib/site/types";

const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

function SitesList({ uid }: { uid: string }) {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeUserSites(uid, setSites, (e) => {
      console.error(e);
      setError("Couldn't load your websites. Check your connection and refresh.");
    });
  }, [uid]);

  if (error) return <p className="rounded-input bg-danger-tint p-4 text-[14px] font-semibold text-danger">{error}</p>;
  if (!sites) {
    return (
      <div className="flex justify-center py-10 text-navy">
        <Spinner size={26} />
      </div>
    );
  }
  return (
    <>
      {sites.map((site) => (
        <SiteCard key={site.id} site={site} />
      ))}
      <Link
        href="/start"
        className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-input px-[18px] py-4 text-left hover:border-navy hover:bg-navy-tint/40"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-navy-tint text-navy">
          <Icon name="add" size={22} />
        </span>
        <span className="flex flex-col gap-0.5">
          <strong className="text-[15px] text-ink">
            {sites.length ? "Create another Webbi" : "Create your first Webbi"}
          </strong>
          <span className="text-[12px] text-muted">
            {sites.length ? `Second business or a branch · ${PRICE_LABEL} each` : "Tell us what you do. Takes about 2 minutes."}
          </span>
        </span>
      </Link>
    </>
  );
}

export function DashboardView() {
  const { user, status } = useAuth();
  const name = firstName(user?.displayName);

  return (
    <RequireAuth allow={["account", "anonymous"]}>
      <AppPage>
        <AppHeader />
        <div className="flex flex-col gap-[18px] px-5 pt-[22px]">
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] leading-[1.08] tracking-[-0.03em]">
              {greeting()}
              {name ? `, ${name}` : ""}
            </h1>
            <p className="text-[14px] text-muted">Here&apos;s your Webbi.</p>
          </div>
          {status === "anonymous" ? (
            <div className="flex items-start gap-3 rounded-input border border-line bg-surface p-4">
              <Icon name="info" size={22} fill className="mt-0.5 flex-none text-navy" />
              <p className="text-[13px] leading-[1.5] text-ink">
                You&apos;re building as a guest. Create an account when you publish so you can come back to
                this Webbi from any phone.
              </p>
            </div>
          ) : null}
          {user ? <SitesList uid={user.uid} /> : null}
        </div>
        <div className="mt-auto flex justify-center px-5 pb-safe pt-8">
          {SUPPORT ? (
            <a
              href={`https://wa.me/${SUPPORT.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 pb-6 text-[13px] font-semibold text-muted"
            >
              <Icon name="help" size={18} />
              Need help? WhatsApp us
            </a>
          ) : (
            <span className="pb-6" />
          )}
        </div>
      </AppPage>
    </RequireAuth>
  );
}
