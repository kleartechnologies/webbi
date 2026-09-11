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
