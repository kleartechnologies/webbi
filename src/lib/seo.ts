import type { Metadata } from "next";
import { PRICE_LABEL } from "@/lib/env";

/**
 * Search and sharing metadata for Webbi's own pages: the landing and the legal
 * pages. Customer websites under /w/ set their own and are not covered here.
 *
 * URLs are fixed to the production domain, not NEXT_PUBLIC_SITE_URL: the same
 * build also answers on the Netlify fallback domain, deploy previews and
 * localhost, and every copy has to point Google at webbi.online.
 */
export const OFFICIAL_ORIGIN = "https://webbi.online";

export const officialUrl = (path: string) => (path === "/" ? OFFICIAL_ORIGIN : `${OFFICIAL_ORIGIN}${path}`);

/** Official pages worth indexing. The product (/start, /signin, /dashboard, /s/…) is not. */
export const INDEXED_PAGES = ["/", "/privacy", "/terms"] as const;

/**
 * The landing's tab title per language. The English one is the server-rendered
 * title search engines index; the BM switch only changes the open tab.
 */
export const LANDING_TITLE = {
  en: "Webbi — Websites for Malaysian Businesses",
  ms: "Webbi – Website untuk bisnes kecil di Malaysia",
} as const;

export const LANDING_DESCRIPTION = `Webbi is a website builder for Malaysian businesses. Tell us what you do and get a professional website you can edit. Free to preview, ${PRICE_LABEL} to publish.`;

const SHARE_IMAGE = { url: `${OFFICIAL_ORIGIN}/og-image.png`, width: 1200, height: 630, alt: "Webbi" };

export const LANDING_METADATA: Metadata = {
  title: { absolute: LANDING_TITLE.en },
  description: LANDING_DESCRIPTION,
  alternates: { canonical: OFFICIAL_ORIGIN },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: OFFICIAL_ORIGIN,
    siteName: "Webbi",
    title: LANDING_TITLE.en,
    description: LANDING_DESCRIPTION,
    locale: "en_MY",
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE.en,
    description: LANDING_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
};

/** A legal page: its own title, canonical on webbi.online. */
export const legalMetadata = (title: string, path: (typeof INDEXED_PAGES)[number]): Metadata => ({
  title,
  alternates: { canonical: officialUrl(path) },
});

const ORGANIZATION_ID = `${OFFICIAL_ORIGIN}/#organization`;

/** Only what is true of Webbi today: name, domain, logo. No contact details, ratings or social profiles. */
export const LANDING_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Webbi",
      url: OFFICIAL_ORIGIN,
      logo: `${OFFICIAL_ORIGIN}/icon.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${OFFICIAL_ORIGIN}/#website`,
      name: "Webbi",
      url: OFFICIAL_ORIGIN,
      inLanguage: "en",
      publisher: { "@id": ORGANIZATION_ID },
    },
  ],
};
