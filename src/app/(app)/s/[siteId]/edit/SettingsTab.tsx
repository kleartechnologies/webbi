"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon, Toggle } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { publicSitePath, siteHost } from "@/lib/site/flow";
import { LANGUAGES, type Language, type SiteContent } from "@/lib/site/schema";
import { slugify } from "@/lib/site/slug";
import { deleteDraftSite } from "@/lib/site/store";
import type { Site } from "@/lib/site/types";
import { Badge, SettingsRow } from "./EditorBits";
import type { Update } from "./useDraft";

interface Props {
  site: Site;
  draft: SiteContent;
  update: Update;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ms: "Bahasa Malaysia",
  mixed: "Bahasa Malaysia + English",
};

export function SettingsTab({ site, draft, update }: Props) {
  const router = useRouter();
  const live = site.status === "published" && Boolean(site.slug);
  const slug = site.slug ?? slugify(draft.business.name) ?? "your-business";
  const link = `${siteHost()}${publicSitePath(slug)}`;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const showCredit = draft.theme.showCredit !== false;

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      // The server deletes the draft's photos along with it.
      await deleteDraftSite(site.id);
      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      // A refusal (a payment is in, or couldn't be checked) says why; anything else stays generic.
      setDeleteError(error instanceof ApiError && error.status === 409 ? error.message : "Couldn't delete this Webbi. Try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[10px]">
      <SettingsRow
        label="Your link"
        value={link}
        trailing={live ? <Badge tone="success">Live</Badge> : <Badge>Not published</Badge>}
      />
      {!live ? (
        <p className="px-1 text-[12px] leading-[1.5] text-muted">
          Your link follows your business name. It&apos;s reserved for you when you publish.
        </p>
      ) : null}

      <div className="flex flex-col gap-[10px] rounded-card border border-line bg-surface px-4 py-[14px]">
        <span className="text-label font-bold uppercase text-muted">Site language</span>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const selected = draft.language === lang;
            return (
              <button
                key={lang}
                type="button"
                aria-pressed={selected}
                onClick={() => update((d) => ({ ...d, language: lang }))}
                className={cn(
                  "inline-flex h-9 items-center rounded-pill px-[14px] text-[13px] whitespace-nowrap transition-colors",
                  selected ? "bg-ink font-bold text-white" : "border border-line-input bg-surface font-semibold text-ink hover:border-navy",
                )}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] leading-[1.5] text-muted">Sets the labels on your site, like “Menu” or “Waktu operasi”.</p>
      </div>

      <SettingsRow
        label="Show “Built with Webbi”"
        value="Small footer credit"
        trailing={
          <Toggle
            checked={showCredit}
            label="Show Built with Webbi credit"
            onChange={(next) => update((d) => ({ ...d, theme: { ...d.theme, showCredit: next ? undefined : false } }))}
          />
        }
      />
      <SettingsRow
        label="Custom domain"
        value="Coming soon"
        disabled
        trailing={<Icon name="lock" size={20} className="text-placeholder" />}
      />

      <div className="flex flex-col gap-3 pt-3">
        {site.paid || live ? (
          <p className="px-1 text-[12px] leading-[1.5] text-muted">
            This Webbi is paid for, so it can&apos;t be deleted from here.
          </p>
        ) : confirming ? (
          <div className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger-tint px-4 py-4">
            <p className="text-[14px] leading-[1.5] text-ink">
              Delete <b>{draft.business.name}</b>? Your draft and its photos are removed. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" size="md" loading={deleting} onClick={() => void remove()} className="flex-1">
                Delete
              </Button>
              <Button variant="secondary" size="md" disabled={deleting} onClick={() => setConfirming(false)} className="flex-1">
                Keep it
              </Button>
            </div>
            {deleteError ? <p role="alert" className="text-[12px] font-semibold text-danger">{deleteError}</p> : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="self-start px-1 text-[14px] font-bold text-danger hover:underline"
          >
            Delete this Webbi
          </button>
        )}
      </div>
    </div>
  );
}
