import type { SiteContent } from "./schema";
import { siteStrings } from "./i18n";

/** wa.me deep link with an optional pre-filled message. */
export function whatsappUrl(number: string, message?: string): string {
  const digits = number.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telUrl(number: string): string {
  const digits = number.replace(/\D/g, "");
  return `tel:+${digits}`;
}

export function mailUrl(email: string): string {
  return `mailto:${email}`;
}

export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** Only http(s) URLs are ever rendered as links. */
export function safeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const SOCIAL_KINDS = ["instagram", "facebook", "tiktok"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];

interface SocialSpec {
  label: string;
  /** Hostnames that belong to the platform (lower-case, no port). */
  hosts: readonly string[];
  /** Canonical profile URL prefix. */
  base: string;
  /** What a bare username may look like on the platform. */
  handle: RegExp;
  /** Prefix the platform puts before usernames in URLs ("@" on TikTok). */
  at: string;
  /** What the platform's own canonical profile URL ends with ("/" on Instagram, nothing elsewhere). */
  tail: string;
}

const SOCIALS: Record<SocialKind, SocialSpec> = {
  instagram: {
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com", "m.instagram.com"],
    base: "https://www.instagram.com/",
    handle: /^[a-z0-9][a-z0-9._]{0,29}$/i,
    at: "",
    tail: "/",
  },
  facebook: {
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "www.fb.com", "fb.me"],
    base: "https://www.facebook.com/",
    handle: /^[a-z0-9][a-z0-9.-]{0,79}$/i,
    at: "",
    tail: "",
  },
  tiktok: {
    label: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
    base: "https://www.tiktok.com/@",
    handle: /^[a-z0-9][a-z0-9._]{0,29}$/i,
    at: "@",
    tail: "",
  },
};

/** Redirect-style hosts whose path is a code, not a username. */
const SHORT_LINK_HOSTS = new Set(["fb.me", "vm.tiktok.com", "vt.tiktok.com"]);

export function socialLabel(kind: SocialKind): string {
  return SOCIALS[kind].label;
}

/** A trailing "/" or "?…" after a handle typed as "instagram.com/amir/" is noise. */
function bareHandle(value: string): string {
  return value.replace(/^@/, "");
}

/**
 * Turns whatever the owner typed into the platform's canonical profile URL:
 *   "@amir.perodua"                → https://www.instagram.com/amir.perodua/
 *   "instagram.com/amir.perodua"   → https://www.instagram.com/amir.perodua/
 *   "https://www.instagram.com/p/…" → kept as typed (https, no fragment)
 * Anything that is not a plausible handle or an http(s) URL on that platform's
 * own domain becomes null — never a link to another site, never javascript:,
 * data: or protocol-relative URLs.
 */
export function socialUrl(kind: SocialKind, value: string | undefined | null): string | null {
  if (!value) return null;
  const spec = SOCIALS[kind];
  const trimmed = value.trim();
  if (!trimmed) return null;

  const looksLikeUrl = /^(https?:\/\/|\/\/|[a-z][a-z0-9+.-]*:)/i.test(trimmed);
  const startsWithHost = /^(www\.|m\.|web\.|vm\.|vt\.)?(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com)(\/|$)/i.test(trimmed);

  if (!looksLikeUrl && !startsWithHost) {
    // "@amir" or "amir" only; anything with a path, query or fragment is not a handle.
    if (/[/?#\s]/.test(trimmed)) return null;
    const handle = bareHandle(trimmed);
    return spec.handle.test(handle) ? `${spec.base}${handle}${spec.tail}` : null;
  }

  // Only http(s); "javascript:", "data:", "//evil.com" all fail here.
  const candidate = startsWithHost && !looksLikeUrl ? `https://${trimmed}` : trimmed;
  if (!/^https?:\/\//i.test(candidate)) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!spec.hosts.includes(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  // "instagram.com/amir/" or "tiktok.com/@amir" → the canonical profile URL.
  if (segments.length === 1 && !url.search && !SHORT_LINK_HOSTS.has(host)) {
    const handle = segments[0].replace(/^@/, "");
    const hasAt = segments[0].startsWith("@");
    if (spec.handle.test(handle) && (spec.at === "" ? !hasAt : hasAt)) return `${spec.base}${handle}${spec.tail}`;
  }
  // A post, reel, short link, "profile.php?id=…" etc.: keep it, but https and no fragment.
  url.protocol = "https:";
  url.hash = "";
  return url.toString();
}

export interface SocialLink {
  kind: SocialKind;
  label: string;
  url: string;
}

/** Valid, normalised social links for a site — empty when none are usable. */
export function socialLinks(business: Pick<SiteContent["business"], SocialKind>): SocialLink[] {
  const links: SocialLink[] = [];
  for (const kind of SOCIAL_KINDS) {
    const url = socialUrl(kind, business[kind]);
    if (url) links.push({ kind, label: SOCIALS[kind].label, url });
  }
  return links;
}

/** The phone number customers can call: explicit phone first, else WhatsApp. */
export function callNumber(site: SiteContent): string | null {
  return site.business.phone?.trim() || site.business.whatsapp || null;
}

/** Where the primary call-to-action goes, or null when nothing is configured. */
export function ctaHref(site: SiteContent): string | null {
  const { cta, business } = site;
  switch (cta.kind) {
    case "whatsapp":
      return business.whatsapp ? whatsappUrl(business.whatsapp, cta.message) : null;
    case "call": {
      const number = callNumber(site);
      return number ? telUrl(number) : null;
    }
    case "email":
      return business.email ? mailUrl(business.email) : null;
    case "link":
      return safeUrl(cta.href);
  }
}

/** WhatsApp link for a specific offering ("Hi, I'm interested in Proton X50"). */
export function offeringWhatsappUrl(site: SiteContent, itemName: string): string | null {
  if (!site.business.whatsapp) return null;
  const s = siteStrings(site.language);
  return whatsappUrl(site.business.whatsapp, `${s.interested} ${itemName}`);
}

/** Generic WhatsApp link used by the secondary buttons. */
export function chatUrl(site: SiteContent): string | null {
  if (!site.business.whatsapp) return null;
  const s = siteStrings(site.language);
  return whatsappUrl(site.business.whatsapp, `${s.hi} ${site.business.name}`);
}
