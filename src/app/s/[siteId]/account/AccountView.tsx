"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { AuthForm, LegalNote, type AuthMode } from "@/components/app/AuthForm";
import { RequireAuth } from "@/components/app/RequireAuth";
import { Icon, Spinner } from "@/components/ui";
import type { Handoff } from "@/lib/auth/actions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getCategory } from "@/lib/site/categories";
import { siteHost, siteName } from "@/lib/site/flow";
import { PRESETS } from "@/lib/site/presets";
import { slugify } from "@/lib/site/slug";
import { copySiteToOwner, getSite, subscribeSite } from "@/lib/site/store";
import type { Site } from "@/lib/site/types";

/**
 * Step 07 in the design: "Create your account to publish". Shown after the
 * editor for guests; the draft chip reminds them nothing is lost.
 */
export function AccountView({ siteId }: { siteId: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [mode, setMode] = useState<AuthMode>("create");

  useEffect(() => {
    if (status === "loading" || status === "signed-out") return;
    return subscribeSite(siteId, setSite, () => setSite(null));
  }, [siteId, status]);

  // Already has an account → straight on to publish.
  useEffect(() => {
    if (status === "account" && site) router.replace(`/s/${site.id}/publish`);
  }, [status, site, router]);

  // If the guest signs in to an account that already exists, carry the draft over.
  const handoff: Handoff<Site | null> = {
    capture: () => getSite(siteId),
    restore: async (captured, uid) => {
      if (!captured) return;
      const newId = await copySiteToOwner(captured, uid);
      router.replace(`/s/${newId}/publish`);
    },
  };

  const preset = site
    ? PRESETS[site.draft?.theme.preset ?? getCategory(site.generation?.understanding?.category).preset]
    : null;

  return (
    <RequireAuth allow={["anonymous", "account"]}>
      <AppPage className="pb-safe">
        <div className="flex items-center px-3 pt-1">
          <button
            type="button"
            onClick={() => router.push(`/s/${siteId}/edit`)}
            aria-label="Back to editor"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-[#EDEBE5]"
          >
            <Icon name="arrow_back" size={24} />
          </button>
        </div>
        <div className="flex flex-col gap-[22px] px-6 pt-2">
          {site === undefined ? (
            <div className="flex h-[82px] items-center justify-center text-navy">
              <Spinner size={22} />
            </div>
          ) : site ? (
            <div className="flex items-center gap-[14px] rounded-[18px] border border-line bg-surface p-3">
              <span
                className="h-14 w-14 flex-none rounded-input"
                style={{
                  background: `repeating-linear-gradient(135deg, ${preset?.line} 0 8px, ${preset?.ground} 8px 16px)`,
                }}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <strong className="truncate text-[15px]">{siteName(site)}</strong>
                <span className="truncate text-[13px] text-muted">
                  {siteHost()}/w/{site.slug ?? slugify(siteName(site)) ?? "your-business"}
                </span>
              </div>
              <span className="ml-auto whitespace-nowrap rounded-pill bg-success-tint px-[9px] py-[5px] text-[11px] font-bold text-success">
                Saved as draft
              </span>
            </div>
          ) : (
            <p className="rounded-input bg-danger-tint p-4 text-[13px] font-semibold text-danger">
              We couldn&apos;t find this draft. It may belong to a different session.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <h1 className="text-[30px] leading-[1.08] tracking-[-0.03em]">
              {mode === "create" ? "Create your account to publish" : "Sign in to publish"}
            </h1>
            <p className="text-[14px] leading-[1.5] text-muted">
              So you can edit and republish anytime, from any phone.
            </p>
          </div>
          <AuthForm
            mode={mode}
            onModeChange={setMode}
            handoff={handoff}
            onSuccess={(result) => {
              if (!result.switched) router.replace(`/s/${siteId}/publish`);
            }}
          />
        </div>
        <div className="mt-auto px-6 pb-8 pt-8">
          <LegalNote />
        </div>
      </AppPage>
    </RequireAuth>
  );
}
