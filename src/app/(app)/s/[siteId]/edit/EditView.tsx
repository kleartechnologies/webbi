"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { FooterNote, StickyFooter } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Button, ButtonLink, Icon, Spinner } from "@/components/ui";
import { callApi, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { hasUnpublishedChanges, publicSiteUrl, resumePath } from "@/lib/site/flow";
import type { SiteContent } from "@/lib/site/schema";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";
import { BusinessTab } from "./BusinessTab";
import { OfferingsTab } from "./OfferingsTab";
import { PhotosTab } from "./PhotosTab";
import { offeringsLabel } from "./sections";
import { SettingsTab } from "./SettingsTab";
import { StyleTab } from "./StyleTab";
import { useDraft, type SaveState } from "./useDraft";

export function EditView({ siteId }: { siteId: string }) {
  const site = useSite(siteId);
  return (
    <RequireAuth allow={["anonymous", "account"]}>
      <AppPage>
        {site === undefined ? (
          <Loading />
        ) : site === null ? (
          <SiteMissing />
        ) : site.draft ? (
          <Editor key={site.id} site={site} initial={site.draft} />
        ) : (
          <NoDraft site={site} />
        )}
      </AppPage>
    </RequireAuth>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-navy">
      <Spinner size={28} />
    </div>
  );
}

/** Deep link to /edit before generation finished: send them to the right step. */
function NoDraft({ site }: { site: Site }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(resumePath(site));
  }, [site, router]);
  return <Loading />;
}

type TabId = "business" | "offerings" | "photos" | "style" | "settings";

/** Which tab a validation issue path belongs to. */
function tabForIssue(path: string, site: SiteContent): TabId {
  if (path.startsWith("cta.") || path.startsWith("theme.")) return "style";
  if (path.startsWith("sections.")) {
    const index = Number(path.split(".")[1]);
    const type = site.sections[index]?.type;
    if (type === "offerings") return "offerings";
    if (type === "gallery") return "photos";
    return "business";
  }
  return "business";
}

/** Design 06: structured editing of the generated site, with instant preview and autosave. */
function Editor({ site, initial }: { site: Site; initial: SiteContent }) {
  const router = useRouter();
  const { user } = useAuth();
  const { draft, update, saveState, issues, flush } = useDraft(site.id, initial);
  const [tab, setTab] = useState<TabId>("business");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishNotice, setPublishNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const live = site.status === "published" && Boolean(site.slug);
  const backHref = live ? "/dashboard" : `/s/${site.id}/ready`;
  const backLabel = live ? "Dashboard" : "Preview";
  // Live sites: the draft is what the owner edits; visitors see `published`.
  const pendingChanges = live && (saveState !== "saved" || hasUnpublishedChanges(site));

  const tabs: { id: TabId; label: string }[] = [
    { id: "business", label: "Business" },
    { id: "offerings", label: offeringsLabel(draft) },
    { id: "photos", label: "Photos" },
    { id: "style", label: "Style" },
    { id: "settings", label: "Settings" },
  ];
  const tabsWithIssues = new Set(Object.keys(issues).map((path) => tabForIssue(path, draft)));

  /** Save, then go. Stays put when the draft can't be saved as-is. */
  const leave = async (href: string) => {
    setLeaving(true);
    const result = await flush();
    setLeaving(false);
    if (result === "invalid") {
      setNotice("Fix the highlighted fields first.");
      const first = Object.keys(issues)[0];
      if (first) setTab(tabForIssue(first, draft));
      return;
    }
    if (result === "error") {
      setNotice("Your latest changes couldn't be saved. Check your connection and try again.");
      return;
    }
    router.push(href);
  };

  /** Save, then copy the draft to the live page (paid sites only). */
  const publishChanges = async () => {
    setPublishing(true);
    setPublishNotice(null);
    const result = await flush();
    if (result === "invalid") {
      setNotice("Fix the highlighted fields first.");
      const first = Object.keys(issues)[0];
      if (first) setTab(tabForIssue(first, draft));
      setPublishing(false);
      return;
    }
    if (result === "error") {
      setNotice("Your latest changes couldn't be saved. Check your connection and try again.");
      setPublishing(false);
      return;
    }
    try {
      await callApi<{ status: "published"; slug: string }>("/api/publish/republish", { siteId: site.id });
      setPublishNotice({ kind: "ok", text: "Your live website is up to date." });
    } catch (error) {
      setPublishNotice({ kind: "error", text: errorMessage(error) });
    }
    setPublishing(false);
  };

  // A notice only matters while the draft is still unsaved.
  const visibleNotice = saveState === "saved" ? null : notice;
  // Once new edits land, "up to date" is no longer true.
  const visiblePublishNotice = publishNotice?.kind === "ok" && pendingChanges ? null : publishNotice;

  const uid = user?.uid ?? "";

  return (
    <>
      <div className="flex h-14 items-center justify-between px-3">
        <button
          type="button"
          onClick={() => void leave(backHref)}
          disabled={leaving}
          className="flex h-11 items-center gap-1 rounded-full pr-3 pl-2 text-[14px] font-bold text-ink hover:bg-[#EDEBE5]"
        >
          <Icon name="arrow_back" size={22} />
          {backLabel}
        </button>
        <span className="text-[15px] font-bold text-ink">Edit</span>
        <SaveIndicator state={saveState} onRetry={() => void flush()} />
      </div>

      <div className="px-5">
        <PreviewStrip site={draft} onOpen={() => setPreviewOpen(true)} />
      </div>

      <div className="sticky top-0 z-10 bg-ground pt-3 pb-2" style={{ background: "var(--color-ground)" }}>
        <div role="tablist" aria-label="Edit sections" className="flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative inline-flex h-9 shrink-0 items-center rounded-pill px-[14px] text-[13px] whitespace-nowrap transition-colors",
                  selected ? "bg-ink font-bold text-white" : "bg-line font-semibold text-ink hover:bg-line-input",
                )}
              >
                {t.label}
                {tabsWithIssues.has(t.id) ? (
                  <span aria-label="Needs attention" className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-2 pb-6 @container">
        {visibleNotice ? (
          <p role="alert" className="rounded-card bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">
            {visibleNotice}
          </p>
        ) : null}
        {tab === "business" ? <BusinessTab site={draft} update={update} issues={issues} uid={uid} siteId={site.id} /> : null}
        {tab === "offerings" ? <OfferingsTab site={draft} update={update} issues={issues} siteId={site.id} /> : null}
        {tab === "photos" ? <PhotosTab site={draft} update={update} siteId={site.id} /> : null}
        {tab === "style" ? <StyleTab site={draft} update={update} issues={issues} /> : null}
        {tab === "settings" ? <SettingsTab site={site} draft={draft} update={update} /> : null}
      </div>

      {live ? (
        <StickyFooter>
          {visiblePublishNotice ? (
            <p
              role="status"
              className={cn(
                "rounded-input px-4 py-3 text-[13px] font-semibold",
                visiblePublishNotice.kind === "ok" ? "bg-success-tint text-success" : "bg-danger-tint text-danger",
              )}
            >
              {visiblePublishNotice.text}
            </p>
          ) : null}
          <div className="flex gap-[10px]">
            <ButtonLink
              href={publicSiteUrl(site.slug as string)}
              target="_blank"
              rel="noopener"
              variant="secondary"
              icon="open_in_new"
              iconPosition="left"
              className="flex-1"
            >
              View live
            </ButtonLink>
            <Button
              className="flex-[1.4]"
              icon="published_with_changes"
              iconPosition="left"
              loading={publishing}
              disabled={!pendingChanges || leaving}
              onClick={() => void publishChanges()}
            >
              Publish changes
            </Button>
          </div>
          <FooterNote>
            {pendingChanges ? "Edits save automatically. Visitors see them once you publish." : "Everything you see here is live."}
          </FooterNote>
        </StickyFooter>
      ) : (
        <StickyFooter>
          <Button block icon="visibility" iconPosition="left" loading={leaving} onClick={() => void leave(backHref)}>
            See my website
          </Button>
          <FooterNote>Changes save automatically.</FooterNote>
        </StickyFooter>
      )}

      {previewOpen ? <PreviewOverlay site={draft} onClose={() => setPreviewOpen(false)} /> : null}
    </>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const base = "flex h-11 items-center gap-1 pr-2 pl-2 text-[13px] font-bold";
  switch (state) {
    case "saved":
      return (
        <span className={cn(base, "text-success")} role="status">
          <Icon name="check_circle" size={18} fill />
          Saved
        </span>
      );
    case "saving":
      return (
        <span className={cn(base, "text-muted")} role="status">
          <Spinner size={16} />
          Saving
        </span>
      );
    case "dirty":
      return (
        <span className={cn(base, "text-muted")} role="status">
          Editing
        </span>
      );
    case "invalid":
      return (
        <span className={cn(base, "text-amber")} role="status">
          <Icon name="warning" size={18} fill />
          Fix fields
        </span>
      );
    case "error":
      return (
        <button type="button" onClick={onRetry} className={cn(base, "rounded-full text-danger hover:bg-danger-tint")}>
          <Icon name="refresh" size={18} />
          Retry save
        </button>
      );
  }
}

const PHONE_WIDTH = 402;

/** "Live preview" strip: the top of the phone view, scaled to fit. Tap for the full preview. */
function PreviewStrip({ site, onOpen }: { site: SiteContent; onOpen: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.85);
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const ro = new ResizeObserver(() => setScale(f.clientWidth / PHONE_WIDTH));
    ro.observe(f);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open full preview"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="relative h-[200px] w-full cursor-pointer overflow-hidden rounded-panel border border-line bg-surface shadow-raised focus:outline-none focus-visible:shadow-focus"
    >
      <div ref={frame} className="absolute inset-0 overflow-hidden">
        <div
          className="pointer-events-none select-none"
          style={{ width: PHONE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <SiteRenderer site={site} mode="preview" stickyCta={false} />
        </div>
      </div>
      <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-pill bg-ink/80 px-[10px] py-1 text-[11px] font-bold text-white shadow-raised">
        <Icon name="visibility" size={14} />
        Live preview · Tap to open
      </span>
    </div>
  );
}

/** Full-screen scrolling preview of the current draft. */
function PreviewOverlay({ site, onClose }: { site: SiteContent; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 flex flex-col bg-ground">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-3">
        <span className="pl-2 text-[14px] font-bold text-ink">Preview</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 items-center gap-1 rounded-full px-3 text-[14px] font-bold text-navy hover:bg-navy-tint"
        >
          <Icon name="edit" size={18} />
          Back to edit
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto min-h-full w-full max-w-[560px] bg-surface">
          <SiteRenderer site={site} mode="preview" />
        </div>
      </div>
    </div>
  );
}
