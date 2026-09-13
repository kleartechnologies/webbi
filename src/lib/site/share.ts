import { publicSiteUrl, siteName } from "./flow";
import { slugify } from "./slug";
import type { Site } from "./types";

/**
 * Sharing a live website from the dashboard: the link, its QR code (PNG and SVG)
 * and the copy / native share actions.
 *
 * Everything is derived from the owner's own site record. The dashboard only
 * lists sites the signed-in account owns (subscribeUserSites filters on ownerUid
 * and the Firestore rules refuse any other read), and nothing here accepts a URL
 * from anywhere else.
 */
export interface ShareTarget {
  /** Business name, for the share title, alt text and file name. */
  name: string;
  /** The public website address, e.g. https://webbi.online/w/amir-perodua-sales-advisor. */
  url: string;
  slug: string;
}

/** Only a published website with a claimed link can be shared, the same rule as the card's View button. */
export function shareTarget(site: Site): ShareTarget | null {
  if (site.status !== "published" || !site.slug) return null;
  return { name: siteName(site), url: publicSiteUrl(site.slug), slug: site.slug };
}

export const SHARE_TEXT = "Check out my website";

export function shareData(target: ShareTarget): ShareData {
  return { title: target.name, text: SHARE_TEXT, url: target.url };
}

export function qrAlt(target: ShareTarget): string {
  return `QR code for ${target.name} website`;
}

export type QrFormat = "png" | "svg";

/** e.g. amir-perodua-sales-advisor-qr.png. Built from the business name, never from internal ids. */
export function qrFileName(target: ShareTarget, format: QrFormat): string {
  const clean = (s: string) => slugify(s).replace(/[^a-z0-9-]/g, "");
  const stem = clean(target.name) || clean(target.slug) || "website";
  return `${stem}-qr.${format}`;
}

/**
 * Scanning comes first: medium error correction, the standard four-module quiet
 * zone, and plain black on white. No logo or styling over the code.
 */
export const QR_MARGIN = 4;
const QR_BASE = {
  errorCorrectionLevel: "M",
  margin: QR_MARGIN,
  color: { dark: "#000000", light: "#ffffff" },
} as const;
/** Pixel size of the downloaded PNG: about 13 cm wide at 300 dpi. */
export const QR_PNG_SIZE = 1600;
/** Nominal size written on the SVG. It is a vector, so it prints sharp at any size. */
export const QR_SVG_SIZE = 1024;

export type QrLib = Pick<typeof import("qrcode"), "toString" | "toDataURL">;

export function qrSvg(lib: QrLib, url: string): Promise<string> {
  return lib.toString(url, { ...QR_BASE, type: "svg", width: QR_SVG_SIZE });
}

export function qrPngDataUrl(lib: QrLib, url: string): Promise<string> {
  return lib.toDataURL(url, { ...QR_BASE, type: "image/png", width: QR_PNG_SIZE });
}

/** Decodes a data: URL without fetch(), which the app's CSP doesn't allow for data: URLs. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function buildQrDownload(
  lib: QrLib,
  target: ShareTarget,
  format: QrFormat,
): Promise<{ fileName: string; blob: Blob }> {
  const fileName = qrFileName(target, format);
  if (format === "svg") {
    return { fileName, blob: new Blob([await qrSvg(lib, target.url)], { type: "image/svg+xml" }) };
  }
  return { fileName, blob: dataUrlToBlob(await qrPngDataUrl(lib, target.url)) };
}

/** Starts a browser download of a generated file. */
export function saveFile(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export type CopyResult = "copied" | "failed";
export type ShareResult = "shared" | "cancelled" | CopyResult;

type ClipboardLike = { writeText(text: string): Promise<void> };
type NavigatorLike = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: ClipboardLike;
};

export async function copyLink(url: string, clipboard: ClipboardLike | undefined): Promise<CopyResult> {
  if (!clipboard || typeof clipboard.writeText !== "function") return "failed";
  try {
    await clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function canNativeShare(nav: NavigatorLike | undefined, data: ShareData): boolean {
  if (!nav || typeof nav.share !== "function") return false;
  return typeof nav.canShare === "function" ? nav.canShare(data) : true;
}

/**
 * Opens the device share sheet where there is one. Anywhere else, or if the
 * sheet fails for a reason other than the owner closing it, the link is copied.
 */
export async function shareLink(target: ShareTarget, nav: NavigatorLike | undefined): Promise<ShareResult> {
  const data = shareData(target);
  if (nav && canNativeShare(nav, data)) {
    try {
      await nav.share!(data);
      return "shared";
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return "cancelled";
    }
  }
  return copyLink(target.url, nav?.clipboard);
}
