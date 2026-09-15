"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { CenteredWordmark, FooterNote, StickyFooter } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { ButtonLink, Icon, Spinner, type IconName } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { PRICE_LABEL } from "@/lib/env";
import { resumePath, siteHost } from "@/lib/site/flow";
import type { SiteContent } from "@/lib/site/schema";
import { slugify } from "@/lib/site/slug";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";

export function ReadyView({ siteId }: { siteId: string }) {
  const site = useSite(siteId);
  return (
    <RequireAuth>
      <AppPage>
        {site === undefined ? (
          <div className="flex flex-1 items-center justify-center py-24 text-navy">
            <Spinner size={28} />
          </div>
        ) : site === null ? (
          <SiteMissing />
        ) : (
          <Ready site={site} />
        )}
      </AppPage>
    </RequireAuth>
  );
}

type View = "mobile" | "desktop";
const VIEWS: { id: View; icon: IconName; label: string }[] = [
  { id: "mobile", icon: "smartphone", label: "Mobile" },
  { id: "desktop", icon: "laptop_mac", label: "Desktop" },
];

/** Design 05: the reveal. Full, un-blurred, un-watermarked preview before any payment. */
function Ready({ site }: { site: Site }) {
  const router = useRouter();
  const { status } = useAuth();
  const [view, setView] = useState<View>("mobile");
  const draft = site.draft;

  useEffect(() => {
    if (!draft) router.replace(resumePath(site));
  }, [draft, site, router]);

  if (!draft) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-navy">
        <Spinner size={28} />
      </div>
    );
  }

  const slug = site.slug ?? slugify(draft.business.name);
  const url = `${siteHost()}/w/${slug}`;
  const publishHref = status === "account" ? `/s/${site.id}/publish` : `/s/${site.id}/account`;

  return (
    <>
      <CenteredWordmark />
      <div className="flex flex-1 flex-col gap-4 px-5 pt-2">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-[28px] leading-[1.1] tracking-[-0.03em]">
            Your Webbi is ready
            <span className="mt-1 h-[9px] w-[9px] shrink-0 rounded-full bg-amber" aria-hidden />
          </h1>
          <p className="text-[14px] leading-[1.45] text-muted">
            {draft.business.name} · <span className="font-bold text-ink">{url}</span>
          </p>
        </div>

        <div className="flex self-center rounded-pill bg-line p-[3px]" role="tablist" aria-label="Preview device">
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.id)}
                className={cn(
                  "flex h-[34px] items-center gap-[6px] rounded-pill px-4 text-[13px] font-bold transition-colors",
                  active ? "bg-surface text-ink shadow-raised" : "text-muted",
                )}
              >
                <Icon name={v.icon} size={18} />
                {v.label}
              </button>
            );
          })}
        </div>

        {view === "mobile" ? <MobilePreview site={draft} /> : <DesktopPreview site={draft} url={url} />}
      </div>

      <StickyFooter>
        <div className="flex gap-[10px]">
          <ButtonLink href={`/s/${site.id}/edit`} variant="secondary" icon="edit" iconPosition="left" className="flex-1">
            Edit
          </ButtonLink>
          <ButtonLink href={publishHref} className="flex-[1.4]">
            Publish · {PRICE_LABEL}
          </ButtonLink>
        </div>
        <FooterNote>Free to preview. Pay once to go live, no subscription.</FooterNote>
      </StickyFooter>
    </>
  );
}

function MobilePreview({ site }: { site: SiteContent }) {
  return (
    <div className="h-[540px] overflow-y-auto overscroll-contain rounded-[26px] border border-line shadow-floating [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <SiteRenderer site={site} mode="preview" maps />
    </div>
  );
}

const DESKTOP_WIDTH = 1100;

/** Browser-chrome frame with the desktop layout scaled to fit the column. */
function DesktopPreview({ site, url }: { site: SiteContent; url: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.34);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const f = frame.current;
    const i = inner.current;
    if (!f || !i) return;
    const ro = new ResizeObserver(() => {
      setScale(f.clientWidth / DESKTOP_WIDTH);
      setHeight(i.offsetHeight);
    });
    ro.observe(f);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-floating">
      <div className="flex items-center gap-2 border-b border-line bg-ground px-3 py-2">
        <span className="flex gap-[5px]" aria-hidden>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} className="h-[10px] w-[10px] rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="flex h-6 min-w-0 flex-1 items-center rounded-[6px] bg-surface px-2 font-mono text-[11px] text-muted">
          <span className="truncate">{url}</span>
        </span>
      </div>
      <div ref={frame} className="h-[500px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ height: height ? height * scale : undefined }}>
          <div ref={inner} className="origin-top-left" style={{ width: DESKTOP_WIDTH, transform: `scale(${scale})` }}>
            <SiteRenderer site={site} mode="preview" stickyCta={false} maps />
          </div>
        </div>
      </div>
    </div>
  );
}
