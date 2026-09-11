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

const SOCIAL_HOSTS = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  tiktok: "https://tiktok.com/@",
} as const;

/** Accepts a full URL or a bare handle ("@rasakampung", "rasakampung"). */
export function socialUrl(kind: keyof typeof SOCIAL_HOSTS, value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return safeUrl(trimmed);
  const handle = trimmed.replace(/^@/, "").replace(/^(www\.)?(instagram|facebook|tiktok)\.com\//i, "");
  if (!/^[\w.-]{1,80}$/.test(handle)) return null;
  return `${SOCIAL_HOSTS[kind]}${handle}`;
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
