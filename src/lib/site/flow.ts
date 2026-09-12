import type { Site } from "./types";
import { publicEnv } from "@/lib/env";

/** Display name for a site at any stage of the flow. */
export function siteName(site: Site): string {
  return (
    site.draft?.business.name ||
    site.generation?.understanding?.name ||
    "Untitled Webbi"
  );
}

export function siteHost(): string {
  return publicEnv.siteUrl.replace(/^https?:\/\//, "");
}

export function publicSitePath(slug: string): string {
  return `/w/${slug}`;
}

export function publicSiteUrl(slug: string): string {
  return `${publicEnv.siteUrl}${publicSitePath(slug)}`;
}

/** Where "Continue" should take the owner for a site in progress. */
export function resumePath(site: Site): string {
  const base = `/s/${site.id}`;
  if (site.status === "published") return `${base}/edit`;
  switch (site.generation?.status) {
    case "understanding":
    case "understood":
    case "error":
      return `${base}/confirm`;
    case "generating":
      return `${base}/generating`;
    case "ready":
      return site.draft ? `${base}/ready` : `${base}/confirm`;
    default:
      return `${base}/confirm`;
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Does a live site have edits its visitors can't see yet? */
export function hasUnpublishedChanges(site: Site): boolean {
  if (site.status !== "published" || !site.draft) return false;
  return stable(site.draft) !== stable(site.published);
}

/** Checkout return URL. `{CHECKOUT_SESSION_ID}` is filled in by the provider. */
export function checkoutReturnPath(siteId: string): string {
  return `/s/${siteId}/publish/return?session_id={CHECKOUT_SESSION_ID}`;
}
