import type { CSSProperties } from "react";
import { publicEnv } from "@/lib/env";

/** Host shown in the mock browser chrome (webbi.online in production). */
export const HOST = publicEnv.siteUrl.replace(/^https?:\/\//, "");

/** Address of a published Webbi, as the ready screen shows it. */
export function siteAddress(slug: string): string {
  return `${HOST}/w/${slug}`;
}

/** Inline CSS custom properties without the cast at every call site. */
export function vars(v: Record<string, string>): CSSProperties {
  return v as CSSProperties;
}
