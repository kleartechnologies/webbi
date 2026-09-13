"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink, Icon, type IconName } from "@/components/ui";
import { PRICE_LABEL } from "@/lib/env";
import { formatEdited } from "@/lib/format";
import { hasUnpublishedChanges, publicSitePath, publicSiteUrl, resumePath, siteHost, siteName } from "@/lib/site/flow";
import { PRESETS, presetStyle } from "@/lib/site/presets";
import { slugify } from "@/lib/site/slug";
import { deleteDraftSite } from "@/lib/site/store";
import { resolveTemplateId } from "@/lib/site/templates";
import type { Site } from "@/lib/site/types";

function ActionTile({
  icon,
  label,
  href,
  onClick,
  external,
}: {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
}) {
  const className =
    "flex flex-col items-center gap-1.5 rounded-input bg-ground px-1 py-3 text-[11px] font-bold text-ink hover:bg-[#EDEBE5]";
  const inner = (
    <>
      <Icon name={icon} size={24} className="text-navy" />
      {label}
    </>
  );
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener" className={className}>
        {inner}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/** Preset-coloured banner until the real renderer thumbnail lands (Phase 6). */
function SiteBanner({ site }: { site: Site }) {
  const content = site.published ?? site.draft;
  const presetId = resolveTemplateId({ theme: content?.theme, business: { category: content?.business.category ?? site.generation?.understanding?.category } });
  const preset = PRESETS[presetId];
  const hero = content?.sections.find((s) => s.type === "hero");
  const image = hero && hero.type === "hero" ? hero.image : undefined;
  return (
    <div
      className="relative h-[150px] overflow-hidden"
      style={{ ...presetStyle(preset, content?.theme.accent), background: preset.ground }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col justify-end p-5">
          <span
            className="text-[26px] font-bold leading-[1.05] tracking-[-0.02em]"
            style={{ fontFamily: preset.font, color: preset.heroDark ? preset.accent : preset.ink }}
          >
            {siteName(site)}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_60%,#fff_100%)]" />
    </div>
  );
}

export function SiteCard({ site }: { site: Site }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = siteName(site);
  const published = site.status === "published" && site.slug;
  const url = site.slug ? publicSiteUrl(site.slug) : null;
  const displayUrl = site.slug ? `${siteHost()}${publicSitePath(site.slug)}` : `${siteHost()}/w/${slugify(name) || "your-business"}`;

  const share = async () => {
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="overflow-hidden rounded-panel border border-line bg-surface shadow-raised">
      <SiteBanner site={site} />
      <div className="flex flex-col gap-[14px] px-[18px] pb-[18px] pt-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-[3px]">
            <strong className="truncate text-[18px]">{name}</strong>
            <span className="truncate text-[13px] text-muted">{displayUrl}</span>
          </div>
          {published ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-success-tint px-[10px] py-1.5 text-[12px] font-bold text-success">
              <span className="h-[7px] w-[7px] rounded-full bg-success" />
              Published
            </span>
          ) : (
            <span className="whitespace-nowrap rounded-pill bg-[#FBF1DE] px-[10px] py-1.5 text-[12px] font-bold text-[#8A5A0E]">
              Draft
            </span>
          )}
        </div>

        {published ? (
          <div className="grid grid-cols-3 gap-2">
            <ActionTile icon="open_in_new" label="View" href={publicSitePath(site.slug as string)} external />
            <ActionTile icon="edit" label="Edit" href={`/s/${site.id}/edit`} />
            <ActionTile icon={copied ? "check" : "ios_share"} label={copied ? "Copied" : "Share"} onClick={share} />
          </div>
        ) : confirming ? (
          <div className="flex flex-col gap-2 rounded-input bg-danger-tint p-3">
            <p className="text-[13px] font-semibold text-ink">Delete this draft? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={deleting}
                onClick={async () => {
                  setDeleting(true);
                  await deleteDraftSite(site.id);
                }}
              >
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <ButtonLink href={resumePath(site)} size="md" className="flex-1" icon="arrow_forward" iconPosition="right">
              Continue
            </ButtonLink>
            <Button variant="ghost" size="md" icon="delete" aria-label="Delete draft" onClick={() => setConfirming(true)} />
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5 text-[12px] text-muted">
          <span>Last edited {formatEdited(site.updatedAt)}</span>
          {published && hasUnpublishedChanges(site) ? (
            <Link href={`/s/${site.id}/edit`} className="font-bold text-[#8A5A0E]">
              Unpublished edits
            </Link>
          ) : (
            <span>{site.paid ? `Paid · ${PRICE_LABEL} · lifetime` : "Free to preview"}</span>
          )}
        </div>
      </div>
    </article>
  );
}
